const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../src/server");
const { validateAndNormalizeWorkflow } = require("../src/services/aiGeneratorService");

process.env.JWT_SECRET = "test_jwt_secret_key_123456789";

async function runAiGeneratorTests() {
  console.log("\n==================================================");
  console.log("  AGENTFLOW AI - AI WORKFLOW GENERATION TEST SUITE ");
  console.log("==================================================\n");

  let mongoServer;
  let passedCount = 0;
  const totalCount = 7;

  try {
    console.log("Starting in-memory MongoDB server...");
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log("Connected to in-memory database successfully.\n");

    // Register & Login Test Operator
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Operator AI", email: "ai.operator@agentflow.ai", password: "Password123!" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "ai.operator@agentflow.ai", password: "Password123!" });
    const token = loginRes.body.token;

    // Test 1: Generate Email Workflow
    console.log("Test 1: Prompt - 'send an email to customer after ticket resolution'");
    const emailRes = await request(app)
      .post("/api/workflows/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "send an email to customer after ticket resolution" });

    if (
      emailRes.status === 200 &&
      emailRes.body.success === true &&
      emailRes.body.workflow &&
      emailRes.body.workflow.nodes.some((n) => n.data.type === "action" || n.data.type === "trigger") &&
      emailRes.body.workflow.nodes.some((n) => n.data?.config?.service === "email" || n.data?.label.toLowerCase().includes("email")) &&
      emailRes.body.workflow.edges.length > 0
    ) {
      console.log("  [PASS] Email workflow generated with valid Trigger & Email Action nodes.");
      console.log("         Workflow Name:", emailRes.body.workflow.name);
      passedCount++;
    } else {
      console.error("  [FAIL] Email workflow generation failed:", emailRes.status, emailRes.body);
    }

    // Test 2: Generate Slack Notification Workflow
    console.log("\nTest 2: Prompt - 'send a Slack notification to #devops when deploy finishes'");
    const slackRes = await request(app)
      .post("/api/workflows/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "send a Slack notification to #devops when deploy finishes" });

    if (
      slackRes.status === 200 &&
      slackRes.body.success === true &&
      slackRes.body.workflow.nodes.some((n) => n.data?.config?.service === "slack" || n.data?.label.toLowerCase().includes("slack")) &&
      slackRes.body.workflow.edges.length > 0
    ) {
      console.log("  [PASS] Slack notification workflow generated with Slack Action node.");
      console.log("         Workflow Name:", slackRes.body.workflow.name);
      passedCount++;
    } else {
      console.error("  [FAIL] Slack workflow generation failed:", slackRes.status, slackRes.body);
    }

    // Test 3: Generate Google Sheets Append Workflow
    console.log("\nTest 3: Prompt - 'append new form submissions data to Google Sheets'");
    const sheetsRes = await request(app)
      .post("/api/workflows/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "append new form submissions data to Google Sheets" });

    if (
      sheetsRes.status === 200 &&
      sheetsRes.body.success === true &&
      sheetsRes.body.workflow.nodes.some((n) => n.data?.config?.service === "sheets" || n.data?.label.toLowerCase().includes("sheet")) &&
      sheetsRes.body.workflow.edges.length > 0
    ) {
      console.log("  [PASS] Google Sheets workflow generated with Sheets Action node.");
      console.log("         Workflow Name:", sheetsRes.body.workflow.name);
      passedCount++;
    } else {
      console.error("  [FAIL] Sheets workflow generation failed:", sheetsRes.status, sheetsRes.body);
    }

    // Test 4: Generate Multi-Step Complex AI & Logic Workflow
    console.log("\nTest 4: Prompt - 'multi-step customer support ticket: evaluate sentiment with AI, if urgent alert Slack else log to Sheets'");
    const multiStepRes = await request(app)
      .post("/api/workflows/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        prompt:
          "multi-step customer support ticket: evaluate sentiment with AI, if urgent alert Slack else log to Sheets",
      });

    if (
      multiStepRes.status === 200 &&
      multiStepRes.body.success === true &&
      multiStepRes.body.workflow.nodes.some((n) => n.type === "trigger") &&
      multiStepRes.body.workflow.nodes.some((n) => n.type === "ai") &&
      multiStepRes.body.workflow.nodes.some((n) => n.type === "logic") &&
      multiStepRes.body.workflow.nodes.filter((n) => n.type === "action").length >= 2 &&
      multiStepRes.body.workflow.edges.length >= 3
    ) {
      console.log("  [PASS] Multi-step workflow generated with Trigger, AI Agent, Logic branching, and multiple Actions.");
      console.log("         Nodes count:", multiStepRes.body.workflow.nodes.length, "| Edges count:", multiStepRes.body.workflow.edges.length);
      passedCount++;
    } else {
      console.error("  [FAIL] Multi-step workflow generation failed:", multiStepRes.status, multiStepRes.body);
    }

    // Test 5: Ambiguous / Short Request Fallback
    console.log("\nTest 5: Prompt - 'optimize my daily workflow tasks'");
    const genericRes = await request(app)
      .post("/api/workflows/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "optimize my daily workflow tasks" });

    if (
      genericRes.status === 200 &&
      genericRes.body.success === true &&
      genericRes.body.workflow.nodes.length >= 2 &&
      genericRes.body.workflow.edges.length >= 1
    ) {
      console.log("  [PASS] Ambiguous prompt successfully produced a structured valid workflow draft.");
      console.log("         Workflow Name:", genericRes.body.workflow.name);
      passedCount++;
    } else {
      console.error("  [FAIL] Ambiguous prompt test failed:", genericRes.status, genericRes.body);
    }

    // Test 6: Malformed Input Rejection (empty prompt)
    console.log("\nTest 6: Validation rejection on empty prompt");
    const emptyRes = await request(app)
      .post("/api/workflows/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "" });

    if (emptyRes.status === 400 && emptyRes.body.success === false) {
      console.log("  [PASS] Empty prompt rejected with 400 Validation Error.");
      passedCount++;
    } else {
      console.error("  [FAIL] Empty prompt check failed:", emptyRes.status, emptyRes.body);
    }

    // Test 7: Direct Schema Validator Enforcement
    console.log("\nTest 7: Direct Schema Validation & Normalization unit verification");
    const testRaw = {
      name: "Custom Schema Test",
      nodes: [
        { id: "act-1", type: "action", data: { label: "Do Work" } }, // Missing trigger
      ],
      edges: [],
    };
    const normalized = validateAndNormalizeWorkflow(testRaw, "test prompt");

    if (
      normalized.name === "Custom Schema Test" &&
      normalized.nodes.some((n) => n.type === "trigger") && // Auto-added trigger
      normalized.edges.length === 1 && // Auto-connected
      normalized.version === 1
    ) {
      console.log("  [PASS] Schema validator normalized and sanitized structure correctly.");
      passedCount++;
    } else {
      console.error("  [FAIL] Schema validator test failed:", normalized);
    }

    console.log("\n==================================================");
    console.log(`  RESULTS: ${passedCount} / ${totalCount} AI GENERATOR TESTS PASSED`);
    console.log("==================================================\n");

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

runAiGeneratorTests();
