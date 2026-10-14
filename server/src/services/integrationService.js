const jwt = require("jsonwebtoken");
const { IntegrationAccount, AccountStatus } = require("../models/IntegrationAccount");
const { getProvider, getSupportedProviders } = require("../integrations");

const JWT_SECRET = process.env.JWT_SECRET || "agentflow_jwt_secret_key_default";

/**
 * Lists all integrations with user's connection status
 */
async function getIntegrations(userId) {
  const supported = getSupportedProviders();
  const accounts = await IntegrationAccount.find({ user: userId }).lean();

  const accountMap = new Map(accounts.map((a) => [a.provider, a]));

  return supported.map((prov) => {
    const account = accountMap.get(prov.id);
    return {
      ...prov,
      isConnected: account ? account.status === AccountStatus.CONNECTED : false,
      status: account ? account.status : AccountStatus.DISCONNECTED,
      accountEmail: account?.accountEmail || null,
      displayName: account?.displayName || null,
      lastSyncedAt: account?.lastSyncedAt || null,
    };
  });
}

/**
 * Returns a summary status map of connected providers
 */
async function getIntegrationStatus(userId) {
  const accounts = await IntegrationAccount.find({ user: userId }).lean();
  const statusMap = {
    gmail: false,
    slack: false,
    discord: false,
    sheets: false,
  };

  accounts.forEach((acc) => {
    statusMap[acc.provider] = acc.status === AccountStatus.CONNECTED;
  });

  return statusMap;
}

/**
 * Generates OAuth authorization URL with signed state token
 */
async function startOAuth(userId, providerName) {
  const provider = getProvider(providerName);

  // Sign a short-lived state token containing userId and provider (10 minutes)
  const stateToken = jwt.sign(
    { userId: String(userId), provider: providerName, nonce: Math.random().toString(36).substring(7) },
    JWT_SECRET,
    { expiresIn: "10m" }
  );

  const authUrl = await provider.getAuthUrl(userId, stateToken);

  return {
    provider: providerName,
    authUrl,
    stateToken,
  };
}

/**
 * Handles OAuth callback and securely persists encrypted tokens
 */
async function handleOAuthCallback(providerName, code, stateToken) {
  if (!stateToken) {
    throw new Error("Missing state parameter in OAuth callback");
  }

  let decoded;
  try {
    decoded = jwt.verify(stateToken, JWT_SECRET);
  } catch (err) {
    throw new Error("Invalid or expired OAuth state parameter");
  }

  if (decoded.provider !== providerName) {
    throw new Error("OAuth provider mismatch in callback state");
  }

  const userId = decoded.userId;
  const provider = getProvider(providerName);

  // Exchange code for tokens
  const tokenData = await provider.handleCallback(code, stateToken);

  // Find or create IntegrationAccount
  let account = await IntegrationAccount.findOne({ user: userId, provider: providerName }).select(
    "+encryptedAccessToken +encryptedRefreshToken"
  );

  if (!account) {
    account = new IntegrationAccount({
      user: userId,
      provider: providerName,
    });
  }

  account.accountId = tokenData.accountId || "";
  account.accountEmail = tokenData.accountEmail || "";
  account.displayName = tokenData.displayName || "";
  account.scopes = tokenData.scopes || [];
  account.lastSyncedAt = new Date();

  account.setTokens(tokenData.accessToken, tokenData.refreshToken, tokenData.expiresIn);
  await account.save();

  return {
    success: true,
    provider: providerName,
    accountEmail: account.accountEmail,
    status: account.status,
  };
}

/**
 * Executes an action on an external integration with token auto-refresh
 */
async function executeProviderAction(userId, providerName, actionName, params = {}) {
  const provider = getProvider(providerName);

  const account = await IntegrationAccount.findOne({
    user: userId,
    provider: providerName,
  }).select("+encryptedAccessToken +encryptedRefreshToken");

  if (!account || account.status !== AccountStatus.CONNECTED) {
    const error = new Error(`Provider '${providerName}' is not connected. Please authenticate via OAuth.`);
    error.status = 400;
    error.isNotConnected = true;
    throw error;
  }

  // Check token expiry and auto-refresh if needed
  let accessToken = account.getDecryptedAccessToken();
  if (account.isTokenExpired()) {
    try {
      accessToken = await provider.refreshAccessToken(account);
    } catch (refreshErr) {
      account.status = AccountStatus.EXPIRED;
      await account.save();

      const error = new Error(`Authentication expired for ${providerName}. Re-authorization required.`);
      error.status = 401;
      error.isAuthExpired = true;
      throw error;
    }
  }

  const credentials = {
    accessToken,
    accountEmail: account.accountEmail,
  };

  return await provider.executeAction(actionName, params, credentials);
}

/**
 * Disconnects provider and cleans up credentials
 */
async function disconnectProvider(userId, providerName) {
  const account = await IntegrationAccount.findOne({ user: userId, provider: providerName });
  if (!account) {
    return { success: true, message: "Provider already disconnected" };
  }

  await IntegrationAccount.deleteOne({ _id: account._id });
  return { success: true, message: `Successfully disconnected ${providerName}` };
}

module.exports = {
  getIntegrations,
  getIntegrationStatus,
  startOAuth,
  handleOAuthCallback,
  executeProviderAction,
  disconnectProvider,
};
