const BaseIntegrationProvider = require("./BaseProvider");

class GoogleSheetsProvider extends BaseIntegrationProvider {
  constructor() {
    super("google_sheets");
    this.clientId = process.env.GOOGLE_SHEETS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "mock_sheets";
    this.clientSecret =
      process.env.GOOGLE_SHEETS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "mock_sheets_secret";
    this.redirectUri =
      process.env.GOOGLE_SHEETS_REDIRECT_URI ||
      "http://localhost:5000/api/integrations/oauth/google_sheets/callback";
  }

  async getAuthUrl(userId, stateToken) {
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(
      this.redirectUri
    )}&response_type=code&scope=https://www.googleapis.com/auth/spreadsheets&state=${stateToken}`;
  }

  async handleCallback(code) {
    return {
      accessToken: `sheets_access_${Date.now()}`,
      refreshToken: `sheets_refresh_${Date.now()}`,
      expiresAt: new Date(Date.now() + 3600 * 1000 * 24),
      accountEmail: "sheets-user@gmail.com",
      accountName: "Google Sheets Workspace",
      scope: ["https://www.googleapis.com/auth/spreadsheets"],
      metadata: { service: "sheets" },
    };
  }

  async refreshAccessToken(account) {
    return {
      accessToken: `sheets_refreshed_${Date.now()}`,
      expiresAt: new Date(Date.now() + 3600 * 1000 * 24),
    };
  }

  async executeAction(actionName, params = {}) {
    switch (actionName) {
      case "append_row": {
        const { spreadsheetId = "mock_sheet_123", range = "Sheet1!A1", values } = params;
        const rowData = values || params.data || ["Automated row", new Date().toISOString()];
        return {
          success: true,
          provider: "google_sheets",
          action: "append_row",
          spreadsheetId,
          range,
          updatedRows: 1,
          appendedData: rowData,
        };
      }
      case "read_rows": {
        const { spreadsheetId = "mock_sheet_123", range = "Sheet1!A1:Z100" } = params;
        return {
          success: true,
          provider: "google_sheets",
          action: "read_rows",
          spreadsheetId,
          range,
          rows: [
            ["ID", "Name", "Status"],
            ["1", "Alpha Agent", "ACTIVE"],
            ["2", "Beta Agent", "COMPLETED"],
          ],
        };
      }
      default:
        throw new Error(`Unsupported Google Sheets action '${actionName}'`);
    }
  }
}

module.exports = GoogleSheetsProvider;
