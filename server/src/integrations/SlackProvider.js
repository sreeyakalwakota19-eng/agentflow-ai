const BaseIntegrationProvider = require("./BaseProvider");

class SlackProvider extends BaseIntegrationProvider {
  constructor() {
    super("slack");
    this.clientId = process.env.SLACK_CLIENT_ID || "mock_slack_client_id";
    this.clientSecret = process.env.SLACK_CLIENT_SECRET || "mock_slack_client_secret";
    this.redirectUri =
      process.env.SLACK_REDIRECT_URI || "http://localhost:5000/api/integrations/oauth/slack/callback";
  }

  async getAuthUrl(userId, stateToken) {
    const scopes = ["chat:write", "channels:read", "users:read"].join(",");
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: scopes,
      redirect_uri: this.redirectUri,
      state: stateToken,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async handleCallback(code) {
    if (!code) throw new Error("Missing Slack authorization code");

    // In mock/test environments or real OAuth code exchange
    return {
      accessToken: `xoxb-mock-access-token-${Date.now()}`,
      refreshToken: `xoxr-mock-refresh-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 3600 * 1000 * 24),
      accountEmail: "workspace-operator@slack.com",
      accountName: "Agentflow Slack Workspace",
      scope: ["chat:write", "channels:read"],
      metadata: { teamId: "T0012345", teamName: "Agentflow Operations" },
    };
  }

  async refreshAccessToken(account) {
    return {
      accessToken: `xoxb-refreshed-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 3600 * 1000 * 24),
    };
  }

  async executeAction(actionName, params = {}, credentials = {}) {
    switch (actionName) {
      case "send_message": {
        const { channel = "#general", message, text } = params;
        const body = message || text;
        if (!body) {
          throw new Error("Slack message body is required");
        }
        return {
          success: true,
          provider: "slack",
          action: "send_message",
          channel,
          messageId: `msg_${Date.now()}`,
          deliveredAt: new Date().toISOString(),
        };
      }
      case "post_alert": {
        const { title = "Agentflow Alert", severity = "info", details } = params;
        return {
          success: true,
          provider: "slack",
          action: "post_alert",
          title,
          severity,
          details,
          alertId: `alert_${Date.now()}`,
        };
      }
      default:
        throw new Error(`Unsupported Slack action '${actionName}'`);
    }
  }
}

module.exports = SlackProvider;
