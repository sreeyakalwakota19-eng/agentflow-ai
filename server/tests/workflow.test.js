const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../src/server");

process.env.JWT_SECRET = "test_jwt_secret_key_123456789";

async function runWorkflowTests() {
  console.log("\n=============================================");
  console.log("  AGENTFLOW AI - WORKFLOW CRUD TEST SUITE   ");
  console.log("=============================================\n");

  let mongoServer;
  let passedCount = 0;
  const totalCount = 12;

  try {
    console.log("Starting in-memory MongoDB server...");
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log("Connected to in-memory database successfully.\n");

    // 1. Create two test users (User A & User B)
    const userARes = await request(app)
      .post("/api/auth/register")
      .send({ name: "Operator A", email: "userA@agentflow.ai", password: "Password123!" });
    
    const userALogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "userA@agentflow.ai", password: "Password123!" });
    const tokenA = userALogin.body.token;

    const userBRes = await request(app)
      .post("/api/auth/register")
      .send({ name: "Operator B", email: "userB@agentflow.ai", password: "Password123!" });
    
    const userBLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "userB@agentflow.ai", password: "Password123!" });
    const tokenB = userBLogin.body.token;

    let workflowId = null;

    // Test 1: Unauthorized access without token
    console.log("Test 1: Reject unauthenticated request to /api/workflows");
    const unauthRes = await request(app).get("/api/workflows");
    if (unauthRes.status === 401 && unauthRes.body.success === false) {
      console.log("  [PASS] Unauthenticated access rejected with 401 Unauthorized.");
      passedCount++;
    } else {
      console.error("  [FAIL] Expected 401 Unauthorized, got:", unauthRes.status);
    }

    // Test 2: Validation rejection on empty name
    console.log("\nTest 2: Validation error on empty workflow name");
    const badCreateRes = await request(app)
      .post("/api/workflows")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "", status: "draft" });
    if (badCreateRes.status === 400 && badCreateRes.body.success === false) {
      console.log("  [PASS] Empty workflow name rejected with 400 Validation Error.");
      passedCount++;
    } else {
      console.error("  [FAIL] Expected 400 Validation Error, got:", badCreateRes.status);
    }

    // Test 3: Create Workflow (POST /api/workflows)
    console.log("\nTest 3: Create workflow (POST /api/workflows)");
    const createPayload = {
      name: "Customer Support Automation",
      description: "Auto-triage support tickets with AI",
      status: "draft",
      tags: ["support", "ai", "email"],
      triggerConfig: { type: "webhook", config: { path: "/support-hook" } },
      nodes: [
        { id: "node-1", type: "trigger", position: { x: 100, y: 100 }, data: { label: "Incoming Email" } },
        { id: "node-2", type: "ai", position: { x: 300, y: 100 }, data: { label: "Analyze Sentiment" } },
      ],
      edges: [{ id: "edge-1-2", source: "node-1", target: "node-2" }],
    };

    const createRes = await request(app)
      .post("/api/workflows")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(createPayload);

    if (
      createRes.status === 201 &&
      createRes.body.success === true &&
      createRes.body.workflow.name === createPayload.name &&
      createRes.body.workflow.version === 1 &&
      createRes.body.workflow.status === "draft" &&
      createRes.body.workflow.nodes.length === 2 &&
      createRes.body.workflow.tags.length === 3
    ) {
      workflowId = createRes.body.workflow._id;
      console.log("  [PASS] Workflow created successfully with version 1, nodes, and tags.");
      passedCount++;
    } else {
      console.error("  [FAIL] Workflow creation failed:", createRes.status, createRes.body);
    }

    // Test 4: List Workflows (GET /api/workflows)
    console.log("\nTest 4: List workflows with pagination (GET /api/workflows)");
    const listRes = await request(app)
      .get("/api/workflows?page=1&limit=10")
      .set("Authorization", `Bearer ${tokenA}`);

    if (
      listRes.status === 200 &&
      listRes.body.success === true &&
      Array.isArray(listRes.body.workflows) &&
      listRes.body.workflows.length === 1 &&
      listRes.body.pagination.total === 1
    ) {
      console.log("  [PASS] Workflows listed with pagination metadata.");
      passedCount++;
    } else {
      console.error("  [FAIL] Listing workflows failed:", listRes.status, listRes.body);
    }

    // Test 5: Search/Filter Workflows (GET /api/workflows?search=Support)
    console.log("\nTest 5: Search & filter workflows by query");
    const searchRes = await request(app)
      .get("/api/workflows?search=Customer")
      .set("Authorization", `Bearer ${tokenA}`);

    if (searchRes.status === 200 && searchRes.body.workflows.length === 1) {
      console.log("  [PASS] Search filter matched workflow by name query.");
      passedCount++;
    } else {
      console.error("  [FAIL] Search filter failed:", searchRes.status, searchRes.body);
    }

    // Test 6: Get Workflow by ID (GET /api/workflows/:id)
    console.log("\nTest 6: Get single workflow by ID (GET /api/workflows/:id)");
    const getRes = await request(app)
      .get(`/api/workflows/${workflowId}`)
      .set("Authorization", `Bearer ${tokenA}`);

    if (
      getRes.status === 200 &&
      getRes.body.success === true &&
      getRes.body.workflow._id === workflowId
    ) {
      console.log("  [PASS] Retrieved single workflow successfully.");
      passedCount++;
    } else {
      console.error("  [FAIL] Get workflow by ID failed:", getRes.status, getRes.body);
    }

    // Test 7: Update Workflow and Increment Version (PUT /api/workflows/:id)
    console.log("\nTest 7: Update workflow and verify version auto-increment (PUT /api/workflows/:id)");
    const updateRes = await request(app)
      .put(`/api/workflows/${workflowId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        name: "Customer Support Automation v2",
        status: "active",
        nodes: [
          { id: "node-1", type: "trigger", position: { x: 100, y: 100 }, data: { label: "Incoming Email" } },
          { id: "node-2", type: "ai", position: { x: 300, y: 100 }, data: { label: "Analyze Sentiment" } },
          { id: "node-3", type: "action", position: { x: 500, y: 100 }, data: { label: "Send Slack Alert" } },
        ],
      });

    if (
      updateRes.status === 200 &&
      updateRes.body.success === true &&
      updateRes.body.workflow.name === "Customer Support Automation v2" &&
      updateRes.body.workflow.status === "active" &&
      updateRes.body.workflow.version === 2 &&
      updateRes.body.workflow.nodes.length === 3
    ) {
      console.log("  [PASS] Workflow updated, status set to active, version bumped to 2.");
      passedCount++;
    } else {
      console.error("  [FAIL] Updating workflow failed:", updateRes.status, updateRes.body);
    }

    // Test 8: Duplicate Workflow (POST /api/workflows/:id/duplicate)
    console.log("\nTest 8: Duplicate workflow (POST /api/workflows/:id/duplicate)");
    const dupRes = await request(app)
      .post(`/api/workflows/${workflowId}/duplicate`)
      .set("Authorization", `Bearer ${tokenA}`);

    let duplicatedId = null;
    if (
      dupRes.status === 201 &&
      dupRes.body.success === true &&
      dupRes.body.workflow.name === "Customer Support Automation v2 (Copy)" &&
      dupRes.body.workflow.status === "draft" &&
      dupRes.body.workflow.version === 1
    ) {
      duplicatedId = dupRes.body.workflow._id;
      console.log("  [PASS] Workflow duplicated with draft status and version 1.");
      passedCount++;
    } else {
      console.error("  [FAIL] Duplicating workflow failed:", dupRes.status, dupRes.body);
    }

    // Test 9: User Ownership Isolation - User B cannot view User A's workflow
    console.log("\nTest 9: Ownership check - User B cannot view User A's workflow");
    const userBAccessRes = await request(app)
      .get(`/api/workflows/${workflowId}`)
      .set("Authorization", `Bearer ${tokenB}`);

    if (userBAccessRes.status === 403 && userBAccessRes.body.success === false) {
      console.log("  [PASS] User B access forbidden with 403 Access Denied.");
      passedCount++;
    } else {
      console.error("  [FAIL] Ownership check failed, status:", userBAccessRes.status);
    }

    // Test 10: User Ownership Isolation - User B cannot delete User A's workflow
    console.log("\nTest 10: Ownership check - User B cannot delete User A's workflow");
    const userBDeleteRes = await request(app)
      .delete(`/api/workflows/${workflowId}`)
      .set("Authorization", `Bearer ${tokenB}`);

    if (userBDeleteRes.status === 403 && userBDeleteRes.body.success === false) {
      console.log("  [PASS] User B delete forbidden with 403 Access Denied.");
      passedCount++;
    } else {
      console.error("  [FAIL] Delete ownership check failed, status:", userBDeleteRes.status);
    }

    // Test 11: Delete Workflow (DELETE /api/workflows/:id)
    console.log("\nTest 11: Delete workflow as owner (DELETE /api/workflows/:id)");
    const deleteRes = await request(app)
      .delete(`/api/workflows/${workflowId}`)
      .set("Authorization", `Bearer ${tokenA}`);

    if (deleteRes.status === 200 && deleteRes.body.success === true) {
      console.log("  [PASS] Workflow deleted successfully.");
      passedCount++;
    } else {
      console.error("  [FAIL] Deleting workflow failed:", deleteRes.status, deleteRes.body);
    }

    // Test 12: Verify Deleted Workflow Returns 404
    console.log("\nTest 12: Verify deleted workflow cannot be retrieved");
    const getDeletedRes = await request(app)
      .get(`/api/workflows/${workflowId}`)
      .set("Authorization", `Bearer ${tokenA}`);

    if (getDeletedRes.status === 404 && getDeletedRes.body.success === false) {
      console.log("  [PASS] Deleted workflow lookup returned 404 Not Found.");
      passedCount++;
    } else {
      console.error("  [FAIL] Expected 404 Not Found, got:", getDeletedRes.status);
    }

    console.log("\n=============================================");
    console.log(`  RESULTS: ${passedCount} / ${totalCount} WORKFLOW TESTS PASSED`);
    console.log("=============================================\n");

    if (passedCount === totalCount) {
      process.exitCode = 0;
    } else {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Test execution error:", error);
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

runWorkflowTests();
