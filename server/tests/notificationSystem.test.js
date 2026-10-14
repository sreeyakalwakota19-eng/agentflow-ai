const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../src/server");
const { Workflow } = require("../src/models/Workflow");
const { Execution, ExecutionStatus } = require("../src/models/Execution");
const { Notification, NotificationType } = require("../src/models/Notification");
const { ExecutionLog } = require("../src/models/ExecutionLog");
const { orchestrator } = require("../src/orchestrator/ExecutionOrchestrator");

process.env.JWT_SECRET = "test_jwt_secret_key_123456789";

async function runNotificationTests() {
  console.log("\n=======================================================");
  console.log("  AGENTFLOW AI - NOTIFICATION SYSTEM TEST SUITE        ");
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
      .send({ name: "Notif Operator", email: "notif.operator@agentflow.ai", password: "Password123!" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "notif.operator@agentflow.ai", password: "Password123!" });
    const token = loginRes.body.token;
    const userId = loginRes.body.user.id || loginRes.body.user._id;

    // Test 1: Successful Execution produces concise SUCCESS notification
    console.log("Test 1: Successful execution creates SUCCESS notification");
    const successWorkflow = await Workflow.create({
      name: "Daily Ingestion Pipeline",
      owner: userId,
      status: "active",
      nodes: [
        { id: "trig-1", type: "trigger", data: { label: "Trigger", type: "trigger", config: { triggerType: "manual" } } },
        { id: "act-1", type: "action", data: { label: "Notify", type: "action", config: { service: "notification" } } },
      ],
      edges: [{ id: "e1", source: "trig-1", target: "act-1" }],
    });

    const successExec = await Execution.create({
      workflow: successWorkflow._id,
      workflowSnapshot: successWorkflow.toObject(),
      owner: userId,
      status: ExecutionStatus.PENDING,
      inputs: { batch: "A-1" },
    });

    await orchestrator.runExecution(successExec._id);

    const successNotif = await Notification.findOne({
      execution: successExec._id,
      type: NotificationType.SUCCESS,
    });

    if (successNotif && successNotif.title === "Workflow Completed" && successNotif.read === false) {
      console.log("  [PASS] SUCCESS notification created with title:", successNotif.title);
      console.log("         Message:", successNotif.message);
      passedCount++;
    } else {
      console.error("  [FAIL] SUCCESS notification test failed:", successNotif);
    }

    // Test 2: Failed Execution with Escalation produces ESCALATION notification
    console.log("\nTest 2: Unrecoverable execution failure creates ESCALATION notification");
    const brokenWorkflow = await Workflow.create({
      name: "Broken Customer Outreach",
      owner: userId,
      status: "active",
      nodes: [
        { id: "tr-1", type: "trigger", data: { label: "Start", type: "trigger" } },
        { id: "act-err", type: "action", data: { label: "Send Email", type: "action", config: { service: "email" } } }, // Missing recipient
      ],
      edges: [{ id: "e1", source: "tr-1", target: "act-err" }],
    });

    const failedExec = await Execution.create({
      workflow: brokenWorkflow._id,
      workflowSnapshot: brokenWorkflow.toObject(),
      owner: userId,
      status: ExecutionStatus.PENDING,
      inputs: {},
    });

    await orchestrator.runExecution(failedExec._id);

    const escalationNotif = await Notification.findOne({
      execution: failedExec._id,
      type: NotificationType.ESCALATION,
    });

    if (escalationNotif && escalationNotif.read === false) {
      console.log("  [PASS] ESCALATION notification created with category triage.");
      console.log("         Message:", escalationNotif.message);
      passedCount++;
    } else {
      console.error("  [FAIL] ESCALATION notification test failed:", escalationNotif);
    }

    // Test 3: GET /api/notifications returns user notifications with unread count
    console.log("\nTest 3: GET /api/notifications returns items and accurate unread count");
    const listRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);

    if (listRes.status === 200 && listRes.body.notifications.length === 2 && listRes.body.unreadCount === 2) {
      console.log("  [PASS] GET /api/notifications returned 2 unread notifications.");
      passedCount++;
    } else {
      console.error("  [FAIL] GET /api/notifications test failed:", listRes.body);
    }

    // Test 4: PATCH /api/notifications/:id/read marks single notification as read
    console.log("\nTest 4: PATCH /api/notifications/:id/read marks notification as read");
    const patchRes = await request(app)
      .patch(`/api/notifications/${successNotif._id}/read`)
      .set("Authorization", `Bearer ${token}`);

    if (patchRes.status === 200 && patchRes.body.notification.read === true && patchRes.body.unreadCount === 1) {
      console.log("  [PASS] Notification marked as read and unread count decremented to 1.");
      passedCount++;
    } else {
      console.error("  [FAIL] Mark as read test failed:", patchRes.body);
    }

    // Test 5: POST /api/notifications/read-all clears all unread notifications
    console.log("\nTest 5: POST /api/notifications/read-all clears all unread notifications");
    const readAllRes = await request(app)
      .post("/api/notifications/read-all")
      .set("Authorization", `Bearer ${token}`);

    const verifyCheck = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);

    if (readAllRes.status === 200 && verifyCheck.body.unreadCount === 0) {
      console.log("  [PASS] POST /api/notifications/read-all set unreadCount to 0.");
      passedCount++;
    } else {
      console.error("  [FAIL] Read all test failed:", readAllRes.body, verifyCheck.body);
    }

    // Test 6: Verify distinction between ExecutionLog (telemetry) and Notification (user-facing)
    console.log("\nTest 6: Verify ExecutionLog vs Notification architectural separation");
    const executionLogsCount = await ExecutionLog.countDocuments({ execution: successExec._id });
    const notificationCount = await Notification.countDocuments({ execution: successExec._id });

    if (executionLogsCount >= 5 && notificationCount === 1) {
      console.log("  [PASS] Architecture clean: 1 concise user-facing Notification generated vs", executionLogsCount, "granular telemetry ExecutionLogs.");
      passedCount++;
    } else {
      console.error("  [FAIL] Architecture separation test failed:", executionLogsCount, notificationCount);
    }

    console.log("\n=======================================================");
    console.log(`  RESULTS: ${passedCount} / ${totalCount} NOTIFICATION TESTS PASSED`);
    console.log("=======================================================\n");

    if (passedCount === totalCount) {
      process.exitCode = 0;
    } else {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Notification test error:", error);
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

runNotificationTests();
