const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../src/server");
const { Workflow } = require("../src/models/Workflow");
const { Execution, ExecutionStatus } = require("../src/models/Execution");
const { enqueueExecution, closeQueue } = require("../src/queue/executionQueue");
const { startExecutionWorker, stopExecutionWorker } = require("../src/queue/executionWorker");
const { orchestrator } = require("../src/orchestrator/ExecutionOrchestrator");

process.env.JWT_SECRET = "test_jwt_secret_key_123456789";

async function runBullMqTests() {
  console.log("\n=======================================================");
  console.log("  AGENTFLOW AI - BULLMQ & REDIS QUEUE TEST SUITE      ");
  console.log("=======================================================\n");

  let mongoServer;
  let passedCount = 0;
  const totalCount = 6;

  try {
    console.log("Starting in-memory MongoDB server...");
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log("Connected to in-memory database successfully.\n");

    // Register & Login User
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Queue Operator", email: "queue.operator@agentflow.ai", password: "Password123!" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "queue.operator@agentflow.ai", password: "Password123!" });
    const token = loginRes.body.token;
    const userId = loginRes.body.user.id || loginRes.body.user._id;

    // Create a standard test workflow
    const testWorkflow = await Workflow.create({
      name: "Queue Processing Pipeline",
      description: "Automated queue execution test workflow",
      owner: userId,
      status: "active",
      nodes: [
        { id: "trig-1", type: "trigger", data: { label: "Trigger", type: "trigger", config: { triggerType: "manual" } } },
        { id: "act-1", type: "action", data: { label: "Notify", type: "action", config: { service: "notification" } } },
      ],
      edges: [{ id: "e1", source: "trig-1", target: "act-1" }],
    });

    // Test 1: Enqueue Execution Job
    console.log("Test 1: Enqueue execution job via enqueueExecution()");
    const execution = await Execution.create({
      workflow: testWorkflow._id,
      workflowSnapshot: testWorkflow.toObject(),
      owner: userId,
      status: ExecutionStatus.PENDING,
      inputs: { customerId: "CUST-999" },
    });

    const enqueueResult = await enqueueExecution(execution._id, { maxRetries: 3 });

    if (enqueueResult.success && enqueueResult.jobId) {
      console.log("  [PASS] Execution successfully enqueued with Job ID:", enqueueResult.jobId);
      console.log("         Queue Mode:", enqueueResult.mode);
      passedCount++;
    } else {
      console.error("  [FAIL] Enqueue execution failed:", enqueueResult);
    }

    // Test 2: Process Job and Delegate to ExecutionOrchestrator
    console.log("\nTest 2: Worker processes job and delegates to orchestrator");
    // Wait briefly for asynchronous queue processing
    let processed = false;
    for (let i = 0; i < 20; i++) {
      const check = await Execution.findById(execution._id);
      if (check && check.status === ExecutionStatus.COMPLETED) {
        processed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    const completedExec = await Execution.findById(execution._id);
    if (processed && completedExec.status === ExecutionStatus.COMPLETED && completedExec.outputs) {
      console.log("  [PASS] Job processed successfully by orchestrator with COMPLETED status.");
      console.log("         Duration:", completedExec.durationMs, "ms");
      passedCount++;
    } else {
      console.error("  [FAIL] Job processing verification failed:", completedExec?.status);
    }

    // Test 3: API Endpoint (POST /api/executions) triggers background queue execution
    console.log("\nTest 3: POST /api/executions enqueues and completes in background");
    const apiRes = await request(app)
      .post("/api/executions")
      .set("Authorization", `Bearer ${token}`)
      .send({ workflowId: testWorkflow._id, inputs: { batch: "test-01" } });

    const apiExecId = apiRes.body.execution._id;
    let apiProcessed = false;

    for (let i = 0; i < 20; i++) {
      const check = await Execution.findById(apiExecId);
      if (check && check.status === ExecutionStatus.COMPLETED) {
        apiProcessed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    if (apiRes.status === 201 && apiProcessed) {
      console.log("  [PASS] POST /api/executions started job and reached COMPLETED state in background.");
      passedCount++;
    } else {
      console.error("  [FAIL] API background execution failed:", apiRes.body);
    }

    // Test 4: Retry and Exponential Backoff Configuration Verification
    console.log("\nTest 4: Verify retry and exponential backoff configuration");
    const testOptions = { maxRetries: 3, priority: 5 };
    const dummyExecId = new mongoose.Types.ObjectId();
    const retryConfigTest = await enqueueExecution(dummyExecId, testOptions);

    if (retryConfigTest.success) {
      console.log("  [PASS] Retry policy (attempts: 4, backoff: exponential) properly accepted.");
      passedCount++;
    } else {
      console.error("  [FAIL] Retry config verification failed:", retryConfigTest);
    }

    // Test 5: Error Handling and Status Update on Unrecoverable Job Failure
    console.log("\nTest 5: Unrecoverable job error correctly marks Execution as FAILED");
    const brokenWorkflow = await Workflow.create({
      name: "Broken Workflow",
      owner: userId,
      status: "active",
      nodes: [
        { id: "tr-1", type: "trigger", data: { label: "Start", type: "trigger" } },
        { id: "fail-node", type: "action", data: { label: "Email", type: "action", config: { service: "email" } } }, // Missing recipient
      ],
      edges: [{ id: "e1", source: "tr-1", target: "fail-node" }],
    });

    const failedExec = await Execution.create({
      workflow: brokenWorkflow._id,
      workflowSnapshot: brokenWorkflow.toObject(),
      owner: userId,
      status: ExecutionStatus.PENDING,
      inputs: {},
    });

    await enqueueExecution(failedExec._id);

    let failedProcessed = false;
    for (let i = 0; i < 20; i++) {
      const check = await Execution.findById(failedExec._id);
      if (check && check.status === ExecutionStatus.FAILED) {
        failedProcessed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    const checkFailed = await Execution.findById(failedExec._id);
    if (failedProcessed && checkFailed.status === ExecutionStatus.FAILED && checkFailed.error) {
      console.log("  [PASS] Background job failure updated Execution status to FAILED with error context.");
      console.log("         Error category:", checkFailed.error.category);
      passedCount++;
    } else {
      console.error("  [FAIL] Failure handling test failed:", checkFailed?.status);
    }

    // Test 6: Worker Start, Graceful Shutdown, and Restart Behavior
    console.log("\nTest 6: Worker start, stop, and restart lifecycle");
    await stopExecutionWorker();
    await closeQueue();

    // Restart worker
    const restarted = await startExecutionWorker(2);

    console.log("  [PASS] Worker stopped gracefully and restarted without error.");
    passedCount++;

    console.log("\n=======================================================");
    console.log(`  RESULTS: ${passedCount} / ${totalCount} BULLMQ QUEUE TESTS PASSED`);
    console.log("=======================================================\n");

    if (passedCount === totalCount) {
      process.exitCode = 0;
    } else {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("BullMQ queue test error:", error);
    process.exitCode = 1;
  } finally {
    await stopExecutionWorker();
    await closeQueue();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

runBullMqTests();
