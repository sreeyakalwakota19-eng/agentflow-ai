const GmailProvider = require("./GmailProvider");
const SlackProvider = require("./SlackProvider");
const DiscordProvider = require("./DiscordProvider");
const GoogleSheetsProvider = require("./GoogleSheetsProvider");

const providers = {
  gmail: new GmailProvider(),
  slack: new SlackProvider(),
  discord: new DiscordProvider(),
  google_sheets: new GoogleSheetsProvider(),
};

function getProvider(providerName) {
  const provider = providers[String(providerName).toLowerCase()];
  if (!provider) {
    throw new Error(`Integration provider '${providerName}' is not supported`);
  }
  return provider;
}

function getSupportedProviders() {
  return [
    {
      id: "gmail",
      name: "Gmail",
      category: "email",
      description: "Send and read emails directly with your Google Workspace or Gmail account.",
      icon: "Mail",
      supportedActions: ["send_email", "read_email"],
      authType: "oauth2",
    },
    {
      id: "slack",
      name: "Slack",
      category: "messaging",
      description: "Post messages, create channels, and broadcast alerts in Slack workspaces.",
      icon: "MessageSquare",
      supportedActions: ["send_message", "post_alert"],
      authType: "oauth2",
    },
    {
      id: "discord",
      name: "Discord",
      category: "messaging",
      description: "Trigger webhooks and dispatch alerts to Discord server channels.",
      icon: "Zap",
      supportedActions: ["send_message"],
      authType: "oauth2",
    },
    {
      id: "google_sheets",
      name: "Google Sheets",
      category: "database",
      description: "Append rows, update spreadsheets, and query Google Sheets records.",
      icon: "FileSpreadsheet",
      supportedActions: ["append_row", "read_rows"],
      authType: "oauth2",
    },
  ];
}

module.exports = {
  providers,
  getProvider,
  getSupportedProviders,
};
