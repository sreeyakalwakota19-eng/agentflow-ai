const BaseIntegrationProvider = require("./BaseProvider");

class DiscordProvider extends BaseIntegrationProvider {
  constructor() {
    super("discord");
    this.clientId = process.env.DISCORD_CLIENT_ID || "mock_discord";
    this.clientSecret = process.env.DISCORD_CLIENT_SECRET || "mock_discord_secret";
    this.redirectUri =
      process.env.DISCORD_REDIRECT_URI ||
      "http://localhost:5000/api/integrations/oauth/discord/callback";
  }

  async getAuthUrl(userId, stateToken) {
    return `https://discord.com/api/oauth2/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(
      this.redirectUri
    )}&response_type=code&scope=webhook.incoming&state=${stateToken}`;
  }

  async handleCallback(code) {
    return {
      accessToken: `discord_token_${Date.now()}`,
      refreshToken: `discord_refresh_${Date.now()}`,
      expiresAt: new Date(Date.now() + 3600 * 1000 * 24),
      accountEmail: "bot@discord.gg",
      accountName: "Agentflow Discord Guild",
      scope: ["webhook.incoming"],
      metadata: { guildId: "G998877", channelId: "C112233" },
    };
  }

  async refreshAccessToken(account) {
    return {
      accessToken: `discord_refreshed_${Date.now()}`,
      expiresAt: new Date(Date.now() + 3600 * 1000 * 24),
    };
  }

  async executeAction(actionName, params = {}) {
    switch (actionName) {
      case "send_message": {
        const { content, message, webhookUrl } = params;
        const text = content || message;
        if (!text) {
          throw new Error("Discord message content is required");
        }
        return {
          success: true,
          provider: "discord",
          action: "send_message",
          content: text,
          messageId: `discord_msg_${Date.now()}`,
          dispatchedAt: new Date().toISOString(),
        };
      }
      default:
        throw new Error(`Unsupported Discord action '${actionName}'`);
    }
  }
}

module.exports = DiscordProvider;
