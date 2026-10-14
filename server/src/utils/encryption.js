const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte encryption key from environment or JWT_SECRET
 */
function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "default_agentflow_encryption_secret_key_32b";
  return crypto.createHash("sha256").update(String(secret)).digest();
}

/**
 * Encrypts plaintext string using AES-256-GCM
 * Output format: iv:ciphertext:authTag (hex)
 */
function encryptToken(plaintext) {
  if (!plaintext) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${encrypted}:${authTag.toString("hex")}`;
}

/**
 * Decrypts AES-256-GCM encrypted token
 */
function decryptToken(encryptedData) {
  if (!encryptedData) return null;

  try {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      throw new Error("Malformed encrypted token payload");
    }

    const [ivHex, cipherHex, authTagHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    throw new Error(`Token decryption failed: ${err.message}`);
  }
}

module.exports = {
  encryptToken,
  decryptToken,
};
