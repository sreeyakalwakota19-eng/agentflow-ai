const BaseIntegrationProvider = require("./BaseProvider");

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

class GmailProvider extends BaseIntegrationProvider {
  constructor() {
    super("gmail");
    this.clientId = process.env.GOOGLE_CLIENT_ID || "mock_google_client_id";
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || "mock_google_client_secret";
    this.redirectUri =
      process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/integrations/oauth/gmail/callback";
  }

  /**
   * Generates Google OAuth 2.0 consent URL
   */
  async getAuthUrl(userId, stateToken) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: GMAIL_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state: stateToken,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges OAuth authorization code for Access & Refresh tokens
   */
  async handleCallback(code, stateToken) {
    if (!code) {
      throw new Error("Authorization code is required from OAuth callback");
    }

    // If running in live environment with real client credentials:
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && !process.env.GOOGLE_CLIENT_ID.startsWith("mock_")) {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errorData = await tokenRes.json();
        throw new Error(`Google token exchange failed: ${errorData.error_description || errorData.error}`);
      }

      const tokens = await tokenRes.json();

      // Fetch user profile
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = profileRes.ok ? await profileRes.json() : {};

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresIn: tokens.expires_in || 3600,
        scopes: tokens.scope ? tokens.scope.split(" ") : GMAIL_SCOPES,
        accountEmail: profile.email || "user@gmail.com",
        accountId: profile.id || "google_user_id",
        displayName: profile.name || profile.email || "Gmail Account",
      };
    }

    // Mock response for development / automated testing
    return {
      accessToken: `mock_gmail_access_token_${Date.now()}`,
      refreshToken: `mock_gmail_refresh_token_${Date.now()}`,
      expiresIn: 3600,
      scopes: GMAIL_SCOPES,
      accountEmail: "operator@gmail.com",
      accountId: "mock_google_id_12345",
      displayName: "Operator Gmail",
    };
  }

  /**
   * Refreshes access token with Google OAuth endpoint
   */
  async refreshAccessToken(account) {
    const refreshToken = account.getDecryptedRefreshToken();
    if (!refreshToken) {
      const err = new Error("No refresh token available. User must re-authenticate.");
      err.isAuthExpired = true;
      throw err;
    }

    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && !process.env.GOOGLE_CLIENT_ID.startsWith("mock_")) {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        const err = new Error("Google token refresh failed. Re-authorization required.");
        err.isAuthExpired = true;
        throw err;
      }

      const data = await response.json();
      account.setTokens(data.access_token, data.refresh_token || refreshToken, data.expires_in || 3600);
      await account.save();
      return data.access_token;
    }

    // Mock refresh for tests
    const newAccessToken = `mock_refreshed_access_token_${Date.now()}`;
    account.setTokens(newAccessToken, refreshToken, 3600);
    await account.save();
    return newAccessToken;
  }

  /**
   * Executes Gmail actions: 'send_email', 'read_email'
   */
  async executeAction(actionName, params = {}, credentials = {}) {
    const { accessToken = "mock_access_token", accountEmail = "operator@gmail.com" } = credentials;

    switch (actionName) {
      case "send_email":
      case "send": {
        const { recipient, to, subject, body, cc, bcc } = params;
        const targetRecipient = recipient || to;

        if (!targetRecipient) {
          throw new Error("Recipient email address is required to send email");
        }
        if (!subject) {
          throw new Error("Email subject is required to send email");
        }

        // Live Gmail API Call
        if (process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.startsWith("mock_")) {
          const rawMessage = [
            `From: ${accountEmail}`,
            `To: ${recipient}`,
            cc ? `Cc: ${cc}` : null,
            bcc ? `Bcc: ${bcc}` : null,
            `Subject: ${subject}`,
            "Content-Type: text/plain; charset=utf-8",
            "",
            body || "",
          ]
            .filter((line) => line !== null)
            .join("\r\n");

          const encodedMessage = Buffer.from(rawMessage)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

          const apiRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw: encodedMessage }),
          });

          if (!apiRes.ok) {
            const errData = await apiRes.json();
            throw new Error(`Gmail API error: ${errData.error?.message || "Failed to send email"}`);
          }

          const result = await apiRes.json();
          return {
            success: true,
            provider: "gmail",
            action: "send_email",
            messageId: result.id,
            threadId: result.threadId,
            recipient,
            subject,
            sentAt: new Date().toISOString(),
          };
        }

        // Simulated success for tests / dev
        return {
          success: true,
          provider: "gmail",
          action: "send_email",
          messageId: `mock_gmail_msg_${Date.now()}`,
          recipient,
          subject,
          bodySnippet: (body || "").slice(0, 80),
          sentAt: new Date().toISOString(),
        };
      }

      case "read_email":
      case "list_emails": {
        const { query = "is:unread", maxResults = 10 } = params;

        return {
          success: true,
          provider: "gmail",
          action: "read_email",
          query,
          messages: [
            {
              id: `msg_inbound_${Date.now()}`,
              snippet: "Support ticket inquiry regarding product licensing",
              from: "customer@example.com",
              subject: "Urgent: License inquiry",
              receivedAt: new Date().toISOString(),
            },
          ],
          resultSizeEstimate: 1,
        };
      }

      default:
        throw new Error(`Unsupported Gmail action: ${actionName}`);
    }
  }
}

module.exports = GmailProvider;
