const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../src/server");
const { IntegrationAccount, AccountStatus } = require("../src/models/IntegrationAccount");
const { encryptToken, decryptToken } = require("../src/utils/encryption");
const { getProvider } = require("../src/integrations");

process.env.JWT_SECRET = "test_jwt_secret_key_123456789";

async function runIntegrationProviderTests() {
  console.log("\n=======================================================");
  console.log("  AGENTFLOW AI - INTEGRATION & GMAIL PROVIDER TESTS   ");
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

    // Test 1: AES-256-GCM Token Encryption and Decryption at Rest
    console.log("Test 1: AES-256-GCM Encryption, Decryption, and Tamper-Resistance");
    const rawToken = "ya29.a0AfH6SMD_secret_google_oauth_token_987654321";
    const encrypted = encryptToken(rawToken);

    const isEncryptedFormat = encrypted.includes(":") && encrypted !== rawToken;
    const decrypted = decryptToken(encrypted);

    // Tamper test
    let tamperDetected = false;
    try {
      const tampered = encrypted.slice(0, -4) + "ffff";
      decryptToken(tampered);
    } catch {
      tamperDetected = true;
    }

    if (isEncryptedFormat && decrypted === rawToken && tamperDetected) {
      console.log("  [PASS] Tokens encrypted using AES-256-GCM with authentication tag.");
      console.log("         Ciphertext sample:", encrypted.slice(0, 32) + "...");
      passedCount++;
    } else {
      console.error("  [FAIL] Token encryption test failed:", { isEncryptedFormat, decrypted, tamperDetected });
    }

    // Register & Login User
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Integration User", email: "integrations@agentflow.ai", password: "Password123!" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "integrations@agentflow.ai", password: "Password123!" });
    const token = loginRes.body.token;
    const userId = loginRes.body.user.id || loginRes.body.user._id;

    // Test 2: OAuth Start Endpoint & State Token Generation
    console.log("\nTest 2: GET /api/integrations/oauth/gmail/start generates authorization URL & signed state");
    const oauthStartRes = await request(app)
      .get("/api/integrations/oauth/gmail/start")
      .set("Authorization", `Bearer ${token}`);

    if (
      oauthStartRes.status === 200 &&
      oauthStartRes.body.success === true &&
      oauthStartRes.body.authUrl.includes("accounts.google.com") &&
      oauthStartRes.body.stateToken
    ) {
      console.log("  [PASS] OAuth start generated Google URL with signed state token.");
      passedCount++;
    } else {
      console.error("  [FAIL] OAuth start failed:", oauthStartRes.status, oauthStartRes.body);
    }

    const stateToken = oauthStartRes.body.stateToken;

    // Test 3: OAuth Callback & Encrypted Token Persistence
    console.log("\nTest 3: GET /api/integrations/oauth/gmail/callback exchanges code & persists encrypted credentials");
    const callbackRes = await request(app)
      .get(`/api/integrations/oauth/gmail/callback?code=mock_auth_code_123&state=${stateToken}`)
      .set("Accept", "application/json");

    const savedAccount = await IntegrationAccount.findOne({ user: userId, provider: "gmail" }).select(
      "+encryptedAccessToken +encryptedRefreshToken"
    );

    if (
      callbackRes.status === 200 &&
      savedAccount &&
      savedAccount.status === AccountStatus.CONNECTED &&
      savedAccount.accountEmail === "operator@gmail.com" &&
      savedAccount.encryptedAccessToken &&
      !savedAccount.encryptedAccessToken.includes("mock_gmail_access_token") // Is encrypted!
    ) {
      console.log("  [PASS] OAuth callback completed and tokens stored as AES-256 ciphertext.");
      console.log("         Connected Account:", savedAccount.accountEmail);
      passedCount++;
    } else {
      console.error("  [FAIL] OAuth callback failed:", callbackRes.status, callbackRes.body);
    }

    // Test 4: Integrations List & Status Map
    console.log("\nTest 4: GET /api/integrations and GET /api/integrations/status");
    const listRes = await request(app).get("/api/integrations").set("Authorization", `Bearer ${token}`);
    const statusRes = await request(app).get("/api/integrations/status").set("Authorization", `Bearer ${token}`);

    const gmailItem = listRes.body.integrations.find((i) => i.id === "gmail");

    if (
      listRes.status === 200 &&
      statusRes.status === 200 &&
      gmailItem.isConnected === true &&
      gmailItem.accountEmail === "operator@gmail.com" &&
      statusRes.body.status.gmail === true &&
      statusRes.body.status.slack === false
    ) {
      console.log("  [PASS] Integrations list and status endpoints reflect connected Gmail state.");
      passedCount++;
    } else {
      console.error("  [FAIL] Integrations list/status failed:", listRes.body, statusRes.body);
    }

    // Test 5: Gmail Send and Read Actions
    console.log("\nTest 5: POST /api/integrations/gmail/execute (send_email & read_email)");
    const sendRes = await request(app)
      .post("/api/integrations/gmail/execute")
      .set("Authorization", `Bearer ${token}`)
      .send({
        action: "send_email",
        params: {
          recipient: "lead@clientcorp.com",
          subject: "Your Agentflow AI Workspace is Ready",
          body: "Hello, welcome to Agentflow AI automated operations.",
        },
      });

    const readRes = await request(app)
      .post("/api/integrations/gmail/execute")
      .set("Authorization", `Bearer ${token}`)
      .send({
        action: "read_email",
        params: { query: "is:unread" },
      });

    if (
      sendRes.status === 200 &&
      sendRes.body.result.success === true &&
      sendRes.body.result.messageId &&
      readRes.status === 200 &&
      readRes.body.result.messages.length > 0
    ) {
      console.log("  [PASS] Gmail actions send_email and read_email executed successfully.");
      console.log("         Message ID:", sendRes.body.result.messageId);
      passedCount++;
    } else {
      console.error("  [FAIL] Gmail action execution failed:", sendRes.body, readRes.body);
    }

    // Test 6: Auto-Refresh on Expired Access Token
    console.log("\nTest 6: Expired access token auto-refreshes seamlessly before action execution");
    // Manually expire the token
    savedAccount.tokenExpiresAt = new Date(Date.now() - 10000);
    await savedAccount.save();

    const refreshExecRes = await request(app)
      .post("/api/integrations/gmail/execute")
      .set("Authorization", `Bearer ${token}`)
      .send({
        action: "send_email",
        params: { recipient: "partner@example.com", subject: "Refreshed token alert", body: "Token refreshed" },
      });

    const updatedAccount = await IntegrationAccount.findById(savedAccount._id);

    if (
      refreshExecRes.status === 200 &&
      refreshExecRes.body.result.success === true &&
      updatedAccount.tokenExpiresAt.getTime() > Date.now()
    ) {
      console.log("  [PASS] Expired token was automatically refreshed and action succeeded.");
      passedCount++;
    } else {
      console.error("  [FAIL] Token refresh failed:", refreshExecRes.body);
    }

    // Test 7: Disconnect Provider & Not Connected Error Handling
    console.log("\nTest 7: Disconnect Gmail and verify 'Not Connected' error handling");
    const disconnectRes = await request(app)
      .post("/api/integrations/gmail/disconnect")
      .set("Authorization", `Bearer ${token}`);

    const afterDisconnectExec = await request(app)
      .post("/api/integrations/gmail/execute")
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "send_email", params: { recipient: "a@b.com", subject: "hi" } });

    if (
      disconnectRes.status === 200 &&
      afterDisconnectExec.status === 400 &&
      afterDisconnectExec.body.message.includes("not connected")
    ) {
      console.log("  [PASS] Disconnect cleanly removed credentials and rejected unauthenticated actions.");
      passedCount++;
    } else {
      console.error("  [FAIL] Disconnect test failed:", disconnectRes.body, afterDisconnectExec.body);
    }

    console.log("\n=======================================================");
    console.log(`  RESULTS: ${passedCount} / ${totalCount} INTEGRATION TESTS PASSED`);
    console.log("=======================================================\n");

    if (passedCount === totalCount) {
      process.exitCode = 0;
    } else {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Integration test error:", error);
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

runIntegrationProviderTests();
