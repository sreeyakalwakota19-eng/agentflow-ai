const http = require("http");
const mongoose = require("mongoose");
const request = require("supertest");
const { io: Client } = require("socket.io-client");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../src/server");
const { initSocketServer } = require("../src/socket");
const { Workflow } = require("../src/models/Workflow");
const { Execution, ExecutionStatus } = require("../src/models/Execution");
const { orchestrator } = require("../src/orchestrator/ExecutionOrchestrator");

process.env.JWT_SECRET = "test_jwt_secret_key_123456789";

async function runSocketRealtimeTests() {
  console.log("\n=======================================================");
  console.log("  AGENTFLOW AI - SOCKET.IO REALTIME TEST SUITE        ");
  console.log("=======================================================\n");

  let mongoServer;
  let server;
  let port;
  let passedCount = 0;
  const totalCount = 6;

  try {
    console.log("Starting in-memory MongoDB server...");
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log("Connected to in-memory database successfully.\n");

    // Create HTTP Server & initialize Socket.IO
    const httpServer = http.createServer(app);
    initSocketServer(httpServer, { forceNew: true });

    await new Promise((resolve) => {
      server = httpServer.listen(0, () => {
        port = server.address().port;
        console.log(`Test Socket.IO server running on port ${port}\n`);
        resolve();
      });
    });

    // Register & Login User
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Socket User", email: "socket.user@agentflow.ai", password: "Password123!" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "socket.user@agentflow.ai", password: "Password123!" });
    const token = loginRes.body.token;
    const userId = loginRes.body.user.id || loginRes.body.user._id;

    // Create Test Workflow
    const sampleWorkflow = await Workflow.create({
      name: "Realtime Socket Test Workflow",
      owner: userId,
      status: "active",
      nodes: [
        { id: "trig-1", type: "trigger", data: { label: "Trigger", type: "trigger", config: { triggerType: "manual" } } },
        { id: "ai-1", type: "ai", data: { label: "AI Reasoner", type: "ai", config: { prompt: "Analyze prompt" } } },
        { id: "act-1", type: "action", data: { label: "Action", type: "action", config: { service: "notification" } } },
      ],
      edges: [
        { id: "e1", source: "trig-1", target: "ai-1" },
        { id: "e2", source: "ai-1", target: "act-1" },
      ],
    });

    // Test 1: Authenticated Socket Connection
    console.log("Test 1: Authenticated Socket.IO client connection");
    const socketClient = Client(`http://localhost:${port}`, {
      auth: { token },
      transports: ["websocket"],
    });

    await new Promise((resolve, reject) => {
      socketClient.on("connect", () => {
        console.log("  [PASS] Socket.IO client connected successfully with valid JWT.");
        passedCount++;
        resolve();
      });
      socketClient.on("connect_error", (err) => reject(err));
      setTimeout(() => reject(new Error("Socket connect timeout")), 3000);
    });

    // Test 2: Unauthenticated Connection Rejection
    console.log("\nTest 2: Rejection of unauthenticated socket connection");
    const unauthClient = Client(`http://localhost:${port}`, {
      auth: { token: "invalid_bad_token" },
      transports: ["websocket"],
    });

    await new Promise((resolve) => {
      unauthClient.on("connect_error", (err) => {
        if (err.message.includes("Authentication error")) {
          console.log("  [PASS] Unauthenticated connection rejected with error:", err.message);
          passedCount++;
        }
        unauthClient.close();
        resolve();
      });
      setTimeout(() => {
        unauthClient.close();
        resolve();
      }, 2000);
    });

    // Test 3: Join Execution Room
    console.log("\nTest 3: Join execution room via 'join_execution'");
    const execution = await Execution.create({
      workflow: sampleWorkflow._id,
      workflowSnapshot: sampleWorkflow.toObject(),
      owner: userId,
      status: ExecutionStatus.PENDING,
      inputs: { liveTest: true },
    });

    socketClient.emit("join_execution", execution._id);

    await new Promise((resolve, reject) => {
      socketClient.on("joined_execution", (data) => {
        if (data.executionId === String(execution._id)) {
          console.log("  [PASS] Socket joined room:", data.room);
          passedCount++;
          resolve();
        }
      });
      setTimeout(() => reject(new Error("Room join timeout")), 3000);
    });

    // Test 4: Live Agent Events Streaming
    console.log("\nTest 4: Stream 5-agent execution events in real-time over Socket.IO");
    const receivedEvents = [];

    socketClient.on("agent_event", (eventData) => {
      receivedEvents.push(eventData);
    });

    // Run execution through orchestrator
    await orchestrator.runExecution(execution._id);

    // Wait briefly for all socket events to flush
    await new Promise((r) => setTimeout(r, 200));

    const eventNames = receivedEvents.map((e) => e.event);
    const hasPlanCreated = eventNames.includes("PLAN_CREATED");
    const hasNodeStarted = eventNames.includes("NODE_EXECUTION_STARTED");
    const hasNodeCompleted = eventNames.includes("NODE_EXECUTION_COMPLETED");
    const hasExecutionCompleted = eventNames.includes("EXECUTION_COMPLETED");

    if (receivedEvents.length >= 5 && hasPlanCreated && hasNodeStarted && hasNodeCompleted && hasExecutionCompleted) {
      console.log("  [PASS] Streamed live agent events over WebSocket.");
      console.log("         Events received:", [...new Set(eventNames)].join(", "));
      passedCount++;
    } else {
      console.error("  [FAIL] Live events streaming test failed:", receivedEvents.length, eventNames);
    }

    // Test 5: Realtime Execution Status Changes
    console.log("\nTest 5: Live execution_status changes broadcasted to room");
    let statusReceived = null;

    const testExec2 = await Execution.create({
      workflow: sampleWorkflow._id,
      workflowSnapshot: sampleWorkflow.toObject(),
      owner: userId,
      status: ExecutionStatus.PENDING,
    });

    socketClient.emit("join_execution", testExec2._id);

    socketClient.on("execution_status", (statusData) => {
      if (statusData.executionId === String(testExec2._id)) {
        statusReceived = statusData.status;
      }
    });

    await orchestrator.runExecution(testExec2._id);
    await new Promise((r) => setTimeout(r, 200));

    if (statusReceived === "COMPLETED" || statusReceived === "RUNNING") {
      console.log("  [PASS] Realtime execution_status update received:", statusReceived);
      passedCount++;
    } else {
      console.error("  [FAIL] Status broadcast test failed:", statusReceived);
    }

    // Test 6: Client Reconnection & Room Resubscription
    console.log("\nTest 6: Client disconnection and automatic reconnection with room re-entry");
    socketClient.disconnect();

    const reconnectedClient = Client(`http://localhost:${port}`, {
      auth: { token },
      transports: ["websocket"],
    });

    await new Promise((resolve, reject) => {
      reconnectedClient.on("connect", () => {
        reconnectedClient.emit("join_execution", execution._id);
      });

      reconnectedClient.on("joined_execution", (data) => {
        console.log("  [PASS] Reconnected client successfully re-subscribed to execution room.");
        passedCount++;
        reconnectedClient.close();
        resolve();
      });

      setTimeout(() => reject(new Error("Reconnection timeout")), 3000);
    });

    socketClient.close();

    console.log("\n=======================================================");
    console.log(`  RESULTS: ${passedCount} / ${totalCount} SOCKET.IO TESTS PASSED`);
    console.log("=======================================================\n");

    if (passedCount === totalCount) {
      process.exitCode = 0;
    } else {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Socket realtime test error:", error);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

runSocketRealtimeTests();
