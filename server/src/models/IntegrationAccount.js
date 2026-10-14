const mongoose = require("mongoose");
const { encryptToken, decryptToken } = require("../utils/encryption");

const IntegrationProvider = {
  GMAIL: "gmail",
  SLACK: "slack",
  DISCORD: "discord",
  SHEETS: "sheets",
};

const AccountStatus = {
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  EXPIRED: "expired",
  ERROR: "error",
};

const integrationAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: Object.values(IntegrationProvider),
      required: true,
      index: true,
    },
    accountId: {
      type: String,
      default: "",
    },
    accountEmail: {
      type: String,
      default: "",
    },
    displayName: {
      type: String,
      default: "",
    },
    // Encrypted token fields (AES-256-GCM)
    encryptedAccessToken: {
      type: String,
      required: true,
      select: false, // Never return tokens in regular queries
    },
    encryptedRefreshToken: {
      type: String,
      default: null,
      select: false,
    },
    tokenExpiresAt: {
      type: Date,
      default: null,
    },
    scopes: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(AccountStatus),
      default: AccountStatus.CONNECTED,
      index: true,
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index per user per provider
integrationAccountSchema.index({ user: 1, provider: 1 }, { unique: true });

// Helper methods for token encryption/decryption
integrationAccountSchema.methods.setTokens = function (accessToken, refreshToken, expiresInSeconds) {
  this.encryptedAccessToken = encryptToken(accessToken);
  if (refreshToken) {
    this.encryptedRefreshToken = encryptToken(refreshToken);
  }
  if (expiresInSeconds) {
    this.tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  }
  this.status = AccountStatus.CONNECTED;
};

integrationAccountSchema.methods.getDecryptedAccessToken = function () {
  if (!this.encryptedAccessToken) return null;
  return decryptToken(this.encryptedAccessToken);
};

integrationAccountSchema.methods.getDecryptedRefreshToken = function () {
  if (!this.encryptedRefreshToken) return null;
  return decryptToken(this.encryptedRefreshToken);
};

integrationAccountSchema.methods.isTokenExpired = function () {
  if (!this.tokenExpiresAt) return false;
  // Consider expired if within 60 seconds of expiry
  return Date.now() >= this.tokenExpiresAt.getTime() - 60000;
};

const IntegrationAccount = mongoose.model("IntegrationAccount", integrationAccountSchema);

module.exports = {
  IntegrationAccount,
  IntegrationProvider,
  AccountStatus,
};
