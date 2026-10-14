const { Execution, ExecutionStatus } = require("../models/Execution");
const PlannerAgent = require("../agents/PlannerAgent");
const ExecutionAgent = require("../agents/ExecutionAgent");
const ValidationAgent = require("../agents/ValidationAgent");
const { RecoveryAgent } = require("../agents/RecoveryAgent");
const MonitoringAgent = require("../agents/MonitoringAgent");

/**
 * ExecutionOrchestrator
 * Master controller for five-agent workflow execution lifecycle.
 */
class ExecutionOrchestrator {
  constructor() {
    this.monitoringAgent = new MonitoringAgent();
    this.validationAgent = new ValidationAgent(this.monitoringAgent);
    this.plannerAgent = new PlannerAgent(this.monitoringAgent);
    this.executionAgent = new ExecutionAgent(this.monitoringAgent, this.validationAgent);
    this.recoveryAgent = new RecoveryAgent(this.monitoringAgent);

    // Active execution control flags (for in-flight cancellation/pause)
    this.activeControls = new Map();
  }

  /**
   * Starts or resumes a workflow execution
   */
  async runExecution(executionId) {
    const execution = await Execution.findById(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (
      execution.status === ExecutionStatus.COMPLETED ||
      execution.status === ExecutionStatus.CANCELLED
    ) {
      return execution;
    }

    const workflowSnapshot = execution.workflowSnapshot;
    if (!workflowSnapshot) {
      throw new Error("Execution has no immutable workflow snapshot");
    }

    // Set status to RUNNING
    const startTime = execution.startedAt || new Date();
    execution.status = ExecutionStatus.RUNNING;
    execution.startedAt = startTime;
    execution.error = null;
    await execution.save();

    try {
      const { emitExecutionEvent } = require("../socket");
      emitExecutionEvent(execution._id, "execution_status", {
        status: ExecutionStatus.RUNNING,
        startedAt: startTime,
      });
    } catch {}

    await this.monitoringAgent.logEvent(
      execution._id,
      "Orchestrator",
      "EXECUTION_STARTED",
      "info",
      {
        workflowId: execution.workflow,
        status: ExecutionStatus.RUNNING,
        startedAt: startTime,
      }
    );

    // Step 1: Planner Agent - Create execution plan if not already planned
    if (!execution.plan || !execution.plan.executionOrder || execution.plan.executionOrder.length === 0) {
      const plan = await this.plannerAgent.createPlan(execution, workflowSnapshot);
      execution.plan = plan;
      await execution.save();
    }

    const nodes = workflowSnapshot.nodes || [];
    const edges = workflowSnapshot.edges || [];
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const executionOrder = execution.plan.executionOrder;

    // Track active branch execution path
    const nodeOutputs = execution.nodeOutputs || new Map();
    let currentPayload = { ...execution.inputs };
    let activeBranch = null; // 'true' | 'false' for logic branches
    let stepIndex = execution.currentStepIndex || 0;

    while (stepIndex < executionOrder.length) {
      // Check cancellation or pause requests
      const controlState = this.activeControls.get(String(executionId));
      if (controlState === "CANCEL") {
        execution.status = ExecutionStatus.CANCELLED;
        execution.completedAt = new Date();
        execution.durationMs = Date.now() - new Date(startTime).getTime();
        await execution.save();
        this.activeControls.delete(String(executionId));

        await this.monitoringAgent.logEvent(execution._id, "Orchestrator", "EXECUTION_CANCELLED", "warn", {
          stepIndex,
        });
        return execution;
      }

      if (controlState === "PAUSE") {
        execution.status = ExecutionStatus.PAUSED;
        execution.pausedAt = new Date();
        execution.currentStepIndex = stepIndex;
        await execution.save();
        this.activeControls.delete(String(executionId));

        await this.monitoringAgent.logEvent(execution._id, "Orchestrator", "EXECUTION_PAUSED", "info", {
          pausedAtStep: stepIndex,
        });
        return execution;
      }

      const nodeId = executionOrder[stepIndex];
      const node = nodeMap.get(nodeId);

      if (!node) {
        stepIndex++;
        continue;
      }

      // Check if this node should be skipped due to branch condition
      if (activeBranch !== null) {
        // Find edge connecting to this node
        const incomingEdge = edges.find((e) => e.target === nodeId);
        if (incomingEdge && incomingEdge.sourceHandle && incomingEdge.sourceHandle !== activeBranch) {
          await this.monitoringAgent.logEvent(
            execution._id,
            "Orchestrator",
            "NODE_SKIPPED_BRANCH",
            "debug",
            {
              nodeId,
              activeBranch,
              edgeHandle: incomingEdge.sourceHandle,
            },
            nodeId
          );
          stepIndex++;
          continue;
        }
      }

      execution.currentNodeId = nodeId;
      execution.currentStepIndex = stepIndex;
      await execution.save();

      // Step Execution with Recovery Loop
      let stepSuccess = false;
      let nodeResult = null;

      while (!stepSuccess) {
        try {
          nodeResult = await this.executionAgent.executeNode(execution._id, node, currentPayload, {
            previousOutputs: nodeOutputs,
          });

          // Store node output
          nodeOutputs.set(nodeId, nodeResult);
          execution.nodeOutputs = nodeOutputs;
          currentPayload = { ...currentPayload, ...nodeResult };

          // If this was a logic node, record active branch direction
          if (node.type === "logic" && nodeResult.branch) {
            activeBranch = nodeResult.branch;
          }

          stepSuccess = true;
          execution.retryCount = 0; // Reset retry counter on success
        } catch (stepError) {
          // Recovery Agent handles failure classification and retry logic
          const recovery = await this.recoveryAgent.handleFailure(execution, node, stepError, {
            isValidationFailure: stepError.isValidationFailure,
          });

          if (recovery.decision === "retry_with_backoff") {
            execution.status = ExecutionStatus.RETRYING;
            execution.retryCount = recovery.retryCount;
            await execution.save();

            // Wait backoff time
            await new Promise((resolve) => setTimeout(resolve, recovery.backoffMs));
          } else {
            // Escalation - Terminate execution as FAILED
            execution.status = ExecutionStatus.FAILED;
            execution.error = {
              nodeId,
              message: stepError.message,
              category: recovery.category,
              explanation: recovery.explanation,
            };
            execution.completedAt = new Date();
            execution.durationMs = Date.now() - new Date(startTime).getTime();
            await execution.save();

            try {
              const { emitExecutionEvent } = require("../socket");
              emitExecutionEvent(execution._id, "execution_status", {
                status: ExecutionStatus.FAILED,
                error: execution.error,
                durationMs: execution.durationMs,
                completedAt: execution.completedAt,
              });
            } catch {}

            // Trigger concise user-facing Failure / Escalation notification
            try {
              const { createNotification, NotificationType } = require("../services/notificationService");
              const isEscalation = recovery.decision === "escalate";
              await createNotification({
                recipient: execution.owner,
                type: isEscalation ? NotificationType.ESCALATION : NotificationType.FAILURE,
                title: isEscalation
                  ? `Workflow Escalated: ${workflowSnapshot.name}`
                  : `Workflow Failed: ${workflowSnapshot.name}`,
                message: isEscalation
                  ? `Step "${node.data?.label || nodeId}" escalated (${recovery.category}): ${recovery.explanation || stepError.message}`
                  : `Step "${node.data?.label || nodeId}" failed: ${stepError.message}`,
                executionId: execution._id,
                workflowId: execution.workflow,
                metadata: { error: execution.error, failedAtNode: nodeId },
              });
            } catch (notifErr) {
              console.error("[Orchestrator] Notification creation failed:", notifErr.message);
            }

            await this.monitoringAgent.logEvent(
              execution._id,
              "Orchestrator",
              "EXECUTION_FAILED",
              "error",
              {
                error: execution.error,
                failedAtNode: nodeId,
              },
              nodeId
            );

            return execution;
          }
        }
      }

      stepIndex++;
    }

    // Step 5: All steps completed successfully
    const completedAt = new Date();
    execution.status = ExecutionStatus.COMPLETED;
    execution.currentStepIndex = stepIndex;
    execution.currentNodeId = null;
    execution.outputs = currentPayload;
    execution.completedAt = completedAt;
    execution.durationMs = completedAt.getTime() - new Date(startTime).getTime();
    await execution.save();

    try {
      const { emitExecutionEvent } = require("../socket");
      emitExecutionEvent(execution._id, "execution_status", {
        status: ExecutionStatus.COMPLETED,
        outputs: execution.outputs,
        durationMs: execution.durationMs,
        completedAt: execution.completedAt,
      });
    } catch {}

    // Trigger concise user-facing Success notification
    try {
      const { createNotification, NotificationType } = require("../services/notificationService");
      await createNotification({
        recipient: execution.owner,
        type: NotificationType.SUCCESS,
        title: `Workflow Completed`,
        message: `Workflow "${workflowSnapshot.name}" completed successfully in ${execution.durationMs}ms.`,
        executionId: execution._id,
        workflowId: execution.workflow,
        metadata: { durationMs: execution.durationMs, totalSteps: execution.plan?.executionOrder?.length || 0 },
      });
    } catch (notifErr) {
      console.error("[Orchestrator] Notification creation failed:", notifErr.message);
    }

    await this.monitoringAgent.logEvent(
      execution._id,
      "Orchestrator",
      "EXECUTION_COMPLETED",
      "info",
      {
        outputs: execution.outputs,
        totalSteps: execution.plan.executionOrder.length,
        durationMs: execution.durationMs,
      }
    );

    return execution;
  }

  /**
   * Pauses an active execution
   */
  async pauseExecution(executionId) {
    this.activeControls.set(String(executionId), "PAUSE");
    const execution = await Execution.findById(executionId);
    if (execution && execution.status === ExecutionStatus.PENDING) {
      execution.status = ExecutionStatus.PAUSED;
      execution.pausedAt = new Date();
      await execution.save();
    }
    return execution;
  }

  /**
   * Resumes a paused execution
   */
  async resumeExecution(executionId) {
    this.activeControls.delete(String(executionId));
    return await this.runExecution(executionId);
  }

  /**
   * Cancels an execution
   */
  async cancelExecution(executionId) {
    this.activeControls.set(String(executionId), "CANCEL");
    const execution = await Execution.findById(executionId);
    if (execution && (execution.status === ExecutionStatus.PENDING || execution.status === ExecutionStatus.PAUSED)) {
      execution.status = ExecutionStatus.CANCELLED;
      execution.completedAt = new Date();
      await execution.save();
    }
    return execution;
  }
}

const orchestratorInstance = new ExecutionOrchestrator();

module.exports = {
  ExecutionOrchestrator,
  orchestrator: orchestratorInstance,
};
