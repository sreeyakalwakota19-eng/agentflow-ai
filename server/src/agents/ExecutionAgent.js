const { executeNodeService } = require("../executors");
const { AgentMemory } = require("../models/AgentMemory");

/**
 * ExecutionAgent
 * Executes individual workflow nodes through service adapters.
 * Manages runtime data passing between nodes and interfaces with AgentMemory.
 */
class ExecutionAgent {
  constructor(monitoringAgent, validationAgent) {
    this.name = "ExecutionAgent";
    this.monitoringAgent = monitoringAgent;
    this.validationAgent = validationAgent;
  }

  /**
   * Executes a single node within the workflow graph
   */
  async executeNode(executionId, node, inputPayload, context = {}) {
    await this.monitoringAgent.logEvent(
      executionId,
      this.name,
      "NODE_EXECUTION_STARTED",
      "info",
      {
        nodeId: node.id,
        nodeType: node.type,
        label: node.data?.label,
        inputs: inputPayload,
      },
      node.id,
      node.type
    );

    // 1. Validation Pre-Check
    const validation = await this.validationAgent.validateNodeInputs(executionId, node, inputPayload);
    if (!validation.valid) {
      const err = new Error(
        `Validation failed for node ${node.id}: ${validation.missingFields.concat(validation.errors).join(", ")}`
      );
      err.isValidationFailure = true;
      err.missingFields = validation.missingFields;
      throw err;
    }

    // 2. Execute Node through Service Adapters
    const startTime = Date.now();
    const result = await executeNodeService(node, inputPayload, context);
    const duration = Date.now() - startTime;

    // 3. Validation Post-Check
    await this.validationAgent.validateNodeOutputs(executionId, node, result);

    // 4. Save Node Memory
    try {
      await AgentMemory.findOneAndUpdate(
        { execution: executionId, agent: this.name, key: `node_${node.id}` },
        {
          execution: executionId,
          agent: this.name,
          key: `node_${node.id}`,
          value: result,
          context: { durationMs: duration, timestamp: new Date() },
        },
        { upsert: true, new: true }
      );
    } catch (memErr) {
      console.warn(`[ExecutionAgent] Could not persist memory:`, memErr.message);
    }

    await this.monitoringAgent.logEvent(
      executionId,
      this.name,
      "NODE_EXECUTION_COMPLETED",
      "info",
      {
        nodeId: node.id,
        nodeType: node.type,
        durationMs: duration,
        result,
      },
      node.id,
      node.type
    );

    return result;
  }
}

module.exports = ExecutionAgent;
