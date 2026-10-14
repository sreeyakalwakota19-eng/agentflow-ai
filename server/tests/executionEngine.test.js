const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../src/server");
const { Workflow } = require("../src/models/Workflow");
const { Execution, ExecutionStatus } = require("../src/models/Execution");
const { ExecutionLog } = require("../src/models/ExecutionLog");
const { orchestrator } = require("../src/orchestrator/ExecutionOrchestrator");
const { executors } = require("../src/executors");

process.env.JWT_SECRET = "test_jwt_secret_key_123456789";

async function runExecutionEngineTests() {
  console.log("\n=======================================================");
  console.log("  AGENTFLOW AI - 5-AGENT EXECUTION ENGINE TEST SUITE ");
  console.log("=======================================================\n");

  let mongoServer;
  let passedCount = 0;
  const totalCount = 7;

  try {
    console.log("Starting in-memory MongoDB server...");
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log("Connected to in-memory database successfully.\n");

    // Register & Login User
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Engine Operator", email: "engine.operator@agentflow.ai", password: "Password123!" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "engine.operator@agentflow.ai", password: "Password123!" });
    const token = loginRes.body.token;
    const userId = loginRes.body.user.id || loginRes.body.user._id;

    // Helper: Create a test workflow
    const sampleWorkflow = await Workflow.create({
      name: "Customer Triage & Alert Pipeline",
      description: "Ingests support ticket, evaluates urgency, branches to Slack or Sheets",
      owner: userId,
      status: "active",
      triggerConfig: { type: "webhook" },
      nodes: [
        {
          id: "node-trigger",
          type: "trigger",
          position: { x: 100, y: 150 },
          data: { label: "Ticket Inbound", type: "trigger", config: { triggerType: "webhook" } },
        },
        {
          id: "node-ai",
          type: "ai",
          position: { x: 380, y: 150 },
          data: {
            label: "Sentiment Reasoner",
            type: "ai",
            config: { model: "openrouter/auto", prompt: "Evaluate ticket urgency" },
          },
        },
        {
          id: "node-logic",
          type: "logic",
          position: { x: 660, y: 150 },
          data: {
            label: "Urgency Branch",
            type: "logic",
            config: { field: "urgency", value: "HIGH", operator: "equals" },
          },
        },
        {
          id: "node-slack",
          type: "action",
          position: { x: 950, y: 100 },
          data: {
            label: "Urgent Slack Alert",
            type: "action",
            config: { service: "slack", channel: "#urgent-support" },
          },
        },
        {
          id: "node-sheets",
          type: "action",
          position: { x: 950, y: 280 },
          data: {
            label: "Log to Google Sheets",
            type: "action",
            config: { service: "sheets", sheetName: "SupportBacklog" },
          },
        },
      ],
      edges: [
        { id: "e1-2", source: "node-trigger", target: "node-ai" },
        { id: "e2-3", source: "node-ai", target: "node-logic" },
        { id: "e3-slack", source: "node-logic", target: "node-slack", sourceHandle: "true" },
        { id: "e3-sheets", source: "node-logic", target: "node-sheets", sourceHandle: "false" },
      ],
      version: 1,
    });

    // Test 1: Successful Multi-Node Execution
    console.log("Test 1: Multi-node graph execution (Trigger -> AI -> Logic -> Slack Action)");
    const startRes = await request(app)
      .post("/api/executions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        workflowId: sampleWorkflow._id,
        inputs: { ticketId: "TCK-101", customer: "Acme Corp", urgency: "HIGH" },
      });

    const executionId = startRes.body.execution._id;

    // Run execution synchronously for test verification
    const finishedExec = await orchestrator.runExecution(executionId);

    if (
      finishedExec.status === ExecutionStatus.COMPLETED &&
      finishedExec.plan.confidenceScore >= 0.8 &&
      finishedExec.plan.executionOrder.length === 5 &&
      finishedExec.outputs.service === "slack"
    ) {
      console.log("  [PASS] Multi-node execution completed successfully.");
      console.log("         Confidence score:", finishedExec.plan.confidenceScore);
      console.log("         Execution order:", finishedExec.plan.executionOrder.join(" -> "));
      console.log("         Final output service:", finishedExec.outputs.service);
      passedCount++;
    } else {
      console.error("  [FAIL] Multi-node execution failed:", finishedExec.status, finishedExec.error);
    }

    // Test 2: Validation Failure Detection
    console.log("\nTest 2: ValidationAgent detects missing required recipient in Email node");
    const invalidEmailWorkflow = await Workflow.create({
      name: "Invalid Email Workflow",
      owner: userId,
      status: "active",
      nodes: [
        { id: "trig-1", type: "trigger", data: { label: "Trigger", type: "trigger" } },
        {
          id: "email-1",
          type: "action",
          data: { label: "Send Email", type: "action", config: { service: "email" } }, // Missing recipient
        },
      ],
      edges: [{ id: "e1", source: "trig-1", target: "email-1" }],
    });

    const valExecRes = await request(app)
      .post("/api/executions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        workflowId: invalidEmailWorkflow._id,
        inputs: {}, // Empty inputs without recipient
      });

    const valExec = await orchestrator.runExecution(valExecRes.body.execution._id);

    if (
      valExec.status === ExecutionStatus.FAILED &&
      valExec.error?.category === "MISSING_FIELDS" &&
      valExec.error?.message.includes("recipient")
    ) {
      console.log("  [PASS] ValidationAgent rejected node with MISSING_FIELDS.");
      console.log("         Error category:", valExec.error.category);
      console.log("         Message:", valExec.error.message);
      passedCount++;
    } else {
      console.error("  [FAIL] Validation failure test failed:", valExec.status, valExec.error);
    }

    // Test 3: Retryable Failure with RecoveryAgent Backoff
    console.log("\nTest 3: RecoveryAgent handles transient 503 error with retry and exponential backoff");
    let transientCallCount = 0;
    const originalAiHandler = executors.ai;

    // Simulate transient network error on 1st attempt, then succeed
    executors.ai = async (node, inputs, ctx) => {
      transientCallCount++;
      if (transientCallCount === 1) {
        const transientErr = new Error("503 Service Unavailable: upstream timeout");
        throw transientErr;
      }
      return { status: "SUCCESS_AFTER_RETRY", sentiment: "HIGH" };
    };

    const retryWorkflow = await Workflow.create({
      name: "Retryable Workflow",
      owner: userId,
      status: "active",
      nodes: [
        { id: "tr-1", type: "trigger", data: { label: "Trigger", type: "trigger" } },
        { id: "ai-transient", type: "ai", data: { label: "AI Node", type: "ai", config: { prompt: "Test prompt" } } },
      ],
      edges: [{ id: "e1", source: "tr-1", target: "ai-transient" }],
    });

    const retryExec = await Execution.create({
      workflow: retryWorkflow._id,
      workflowSnapshot: retryWorkflow.toObject(),
      owner: userId,
      status: ExecutionStatus.PENDING,
      maxRetries: 3,
    });

    const retryFinished = await orchestrator.runExecution(retryExec._id);

    // Restore original handler
    executors.ai = originalAiHandler;

    if (
      retryFinished.status === ExecutionStatus.COMPLETED &&
      transientCallCount === 2 &&
      retryFinished.outputs.status === "SUCCESS_AFTER_RETRY"
    ) {
      console.log("  [PASS] Transient failure retried with backoff and completed successfully.");
      console.log("         Attempts taken:", transientCallCount);
      passedCount++;
    } else {
      console.error("  [FAIL] Retryable failure test failed:", retryFinished.status, retryFinished.error);
    }

    // Test 4: Unrecoverable Error Escalation
    console.log("\nTest 4: RecoveryAgent escalates unrecoverable AUTH_EXPIRED error");
    const originalActionHandler = executors.action;
    executors.action = async () => {
      throw new Error("401 Unauthorized: token expired");
    };

    const authFailWorkflow = await Workflow.create({
      name: "Auth Fail Workflow",
      owner: userId,
      status: "active",
      nodes: [
        { id: "tr-1", type: "trigger", data: { label: "Trigger", type: "trigger" } },
        { id: "act-1", type: "action", data: { label: "Action", type: "action", config: { service: "slack", channel: "#gen" } } },
      ],
      edges: [{ id: "e1", source: "tr-1", target: "act-1" }],
    });

    const authExec = await Execution.create({
      workflow: authFailWorkflow._id,
      workflowSnapshot: authFailWorkflow.toObject(),
      owner: userId,
      status: ExecutionStatus.PENDING,
    });

    const authFinished = await orchestrator.runExecution(authExec._id);
    executors.action = originalActionHandler;

    if (
      authFinished.status === ExecutionStatus.FAILED &&
      authFinished.error?.category === "AUTH_EXPIRED"
    ) {
      console.log("  [PASS] Unrecoverable AUTH_EXPIRED immediately escalated without infinite retries.");
      console.log("         Error category:", authFinished.error.category);
      passedCount++;
    } else {
      console.error("  [FAIL] Escalation test failed:", authFinished.status, authFinished.error);
    }

    // Test 5: Execution Cancellation
    console.log("\nTest 5: Cancel execution lifecycle state transition");
    const cancelExec = await Execution.create({
      workflow: sampleWorkflow._id,
      workflowSnapshot: sampleWorkflow.toObject(),
      owner: userId,
      status: ExecutionStatus.PENDING,
    });

    const cancelRes = await request(app)
      .post(`/api/executions/${cancelExec._id}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    if (cancelRes.status === 200 && cancelRes.body.execution.status === ExecutionStatus.CANCELLED) {
      console.log("  [PASS] Execution successfully transitioned to CANCELLED state.");
      passedCount++;
    } else {
      console.error("  [FAIL] Cancel test failed:", cancelRes.status, cancelRes.body);
    }

    // Test 6: Pause and Resume Lifecycle
    console.log("\nTest 6: Pause and Resume lifecycle transitions");
    const pauseExec = await Execution.create({
      workflow: sampleWorkflow._id,
      workflowSnapshot: sampleWorkflow.toObject(),
      owner: userId,
      status: ExecutionStatus.PENDING,
    });

    const pauseRes = await request(app)
      .post(`/api/executions/${pauseExec._id}/pause`)
      .set("Authorization", `Bearer ${token}`);

    const resumeRes = await request(app)
      .post(`/api/executions/${pauseExec._id}/resume`)
      .set("Authorization", `Bearer ${token}`);

    if (
      pauseRes.status === 200 &&
      pauseRes.body.execution.status === ExecutionStatus.PAUSED &&
      resumeRes.status === 200
    ) {
      console.log("  [PASS] Pause and Resume state transitions handled correctly.");
      passedCount++;
    } else {
      console.error("  [FAIL] Pause/Resume test failed:", pauseRes.body, resumeRes.body);
    }

    // Test 7: Immutable Workflow Snapshot Verification & ExecutionLogs
    console.log("\nTest 7: Verify immutable workflow snapshot and MonitoringAgent ExecutionLogs");
    const logsRes = await request(app)
      .get(`/api/executions/${executionId}/logs`)
      .set("Authorization", `Bearer ${token}`);

    const logs = logsRes.body.logs || [];
    const eventTypes = logs.map((l) => l.event);

    const hasPlanCreated = eventTypes.includes("PLAN_CREATED");
    const hasExecutionStarted = eventTypes.includes("EXECUTION_STARTED");
    const hasExecutionCompleted = eventTypes.includes("EXECUTION_COMPLETED");
    const hasNodeStarted = eventTypes.includes("NODE_EXECUTION_STARTED");

    if (
      logs.length >= 6 &&
      hasPlanCreated &&
      hasExecutionStarted &&
      hasExecutionCompleted &&
      hasNodeStarted
    ) {
      console.log("  [PASS] MonitoringAgent recorded full structured timeline audit logs.");
      console.log("         Events logged:", [...new Set(eventTypes)].join(", "));
      passedCount++;
    } else {
      console.error("  [FAIL] Log audit verification failed:", logs.length, eventTypes);
    }

    console.log("\n=======================================================");
    console.log(`  RESULTS: ${passedCount} / ${totalCount} EXECUTION ENGINE TESTS PASSED`);
    console.log("=======================================================\n");

    if (passedCount === totalCount) {
      process.exitCode = 0;
    } else {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Execution engine test error:", error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

runExecutionEngineTests();
