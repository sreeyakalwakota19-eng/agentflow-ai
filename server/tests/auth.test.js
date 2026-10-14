const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../src/server");

// Ensure JWT_SECRET is set for testing
process.env.JWT_SECRET = "test_jwt_secret_key_123456789";

async function runTests() {
  console.log("\n=========================================");
  console.log("  AGENTFLOW AI - AUTH & AUTHZ TEST SUITE ");
  console.log("=========================================\n");

  let mongoServer;
  let passedCount = 0;
  let totalCount = 7;

  try {
    // 1. Setup in-memory MongoDB
    console.log("Starting in-memory MongoDB server...");
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log("Connected to in-memory database successfully.\n");

    const testUser = {
      name: "Operator Alice",
      email: "alice@agentflow.ai",
      password: "SuperSecretPassword123!",
    };

    let authToken = null;
    let registeredUserId = null;

    // Test 1: Valid Registration
    console.log("Test 1: Valid registration");
    const regRes = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    if (
      regRes.status === 201 &&
      regRes.body.success === true &&
      regRes.body.user.email === testUser.email &&
      regRes.body.user.role === "operator" &&
      regRes.body.user.password === undefined
    ) {
      console.log("  [PASS] Registration succeeded with 201 Created and password excluded.");
      registeredUserId = regRes.body.user.id;
      passedCount++;
    } else {
      console.error("  [FAIL] Registration failed:", regRes.status, regRes.body);
    }

    // Test 2: Duplicate Registration
    console.log("\nTest 2: Duplicate registration");
    const dupRes = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    if (dupRes.status === 409 && dupRes.body.success === false) {
      console.log("  [PASS] Duplicate registration rejected with 409 Conflict.");
      passedCount++;
    } else {
      console.error("  [FAIL] Duplicate registration check failed:", dupRes.status, dupRes.body);
    }

    // Test 3: Valid Login
    console.log("\nTest 3: Valid login");
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    if (
      loginRes.status === 200 &&
      loginRes.body.success === true &&
      typeof loginRes.body.token === "string" &&
      loginRes.body.user.email === testUser.email &&
      loginRes.body.user.password === undefined
    ) {
      console.log("  [PASS] Login succeeded with 200 OK, JWT returned, and password excluded.");
      authToken = loginRes.body.token;
      passedCount++;
    } else {
      console.error("  [FAIL] Valid login failed:", loginRes.status, loginRes.body);
    }

    // Test 4: Invalid Password
    console.log("\nTest 4: Invalid password");
    const badPassRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: "WrongPassword999!",
      });

    if (badPassRes.status === 401 && badPassRes.body.success === false) {
      console.log("  [PASS] Invalid password rejected with 401 Unauthorized.");
      passedCount++;
    } else {
      console.error("  [FAIL] Invalid password check failed:", badPassRes.status, badPassRes.body);
    }

    // Test 5: Invalid Token
    console.log("\nTest 5: Invalid token");
    const badTokenRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid.token.value");

    if (badTokenRes.status === 401 && badTokenRes.body.success === false) {
      console.log("  [PASS] Invalid token rejected with 401 Unauthorized.");
      passedCount++;
    } else {
      console.error("  [FAIL] Invalid token check failed:", badTokenRes.status, badTokenRes.body);
    }

    // Test 6: Missing Token
    console.log("\nTest 6: Missing token");
    const noTokenRes = await request(app).get("/api/auth/me");

    if (noTokenRes.status === 401 && noTokenRes.body.success === false) {
      console.log("  [PASS] Missing token rejected with 401 Unauthorized.");
      passedCount++;
    } else {
      console.error("  [FAIL] Missing token check failed:", noTokenRes.status, noTokenRes.body);
    }

    // Test 7: Valid /me Request
    console.log("\nTest 7: Valid /me request");
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${authToken}`);

    if (
      meRes.status === 200 &&
      meRes.body.success === true &&
      meRes.body.user.email === testUser.email &&
      meRes.body.user.role === "operator" &&
      meRes.body.user.id === registeredUserId &&
      meRes.body.user.password === undefined
    ) {
      console.log("  [PASS] GET /api/auth/me succeeded with authenticated user details.");
      passedCount++;
    } else {
      console.error("  [FAIL] Valid /me request failed:", meRes.status, meRes.body);
    }

    console.log("\n=========================================");
    console.log(`  RESULTS: ${passedCount} / ${totalCount} TESTS PASSED`);
    console.log("=========================================\n");

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

runTests();
