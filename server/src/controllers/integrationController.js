const {
  getIntegrations,
  getIntegrationStatus,
  startOAuth,
  handleOAuthCallback,
  executeProviderAction,
  disconnectProvider,
} = require("../services/integrationService");

async function list(req, res, next) {
  try {
    const integrations = await getIntegrations(req.user.userId);
    res.status(200).json({
      success: true,
      integrations,
    });
  } catch (error) {
    next(error);
  }
}

async function status(req, res, next) {
  try {
    const statusMap = await getIntegrationStatus(req.user.userId);
    res.status(200).json({
      success: true,
      status: statusMap,
    });
  } catch (error) {
    next(error);
  }
}

async function startOAuthFlow(req, res, next) {
  try {
    const result = await startOAuth(req.user.userId, req.params.provider);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

async function oauthCallback(req, res, next) {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`/api/integrations/oauth/error?error=${encodeURIComponent(oauthError)}`);
    }

    const result = await handleOAuthCallback(req.params.provider, code, state);

    // If client URL is configured, redirect to the frontend integrations page
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    if (req.accepts("html") && !req.xhr) {
      return res.redirect(
        `${clientUrl}/integrations?status=connected&provider=${req.params.provider}&email=${encodeURIComponent(
          result.accountEmail || ""
        )}`
      );
    }

    res.status(200).json({
      success: true,
      message: `Successfully connected ${req.params.provider}`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

async function oauthError(req, res) {
  const errorMsg = req.query.error || "OAuth Authorization Failed";
  res.status(400).json({
    success: false,
    message: errorMsg,
  });
}

async function executeAction(req, res, next) {
  try {
    const { action, params } = req.body;
    const result = await executeProviderAction(req.user.userId, req.params.provider, action, params);
    res.status(200).json({
      success: true,
      result,
    });
  } catch (error) {
    next(error);
  }
}

async function disconnect(req, res, next) {
  try {
    const result = await disconnectProvider(req.user.userId, req.params.provider);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  status,
  startOAuthFlow,
  oauthCallback,
  oauthError,
  executeAction,
  disconnect,
};
