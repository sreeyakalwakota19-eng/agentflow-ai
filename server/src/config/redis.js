const Redis = require("ioredis");

function getRedisConfig() {
  if (process.env.REDIS_URL) {
    const isTls = process.env.REDIS_URL.startsWith("rediss://") || process.env.REDIS_TLS === "true";
    return {
      url: process.env.REDIS_URL,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      ...(isTls && { tls: { rejectUnauthorized: false } }),
    };
  }

  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      // Exponential backoff for reconnection up to 2 seconds
      return Math.min(times * 200, 2000);
    },
  };
}

let redisClient = null;

function getRedisClient() {
  if (!redisClient) {
    const config = getRedisConfig();
    redisClient = config.url ? new Redis(config.url, config) : new Redis(config);

    redisClient.on("error", (err) => {
      // Suppress noisy logs in dev when Redis is not running
      if (process.env.NODE_ENV !== "production") {
        // Handled gracefully by development fallback
      } else {
        console.error("[Redis] Connection error:", err.message);
      }
    });
  }
  return redisClient;
}

async function isRedisAvailable() {
  try {
    const client = getRedisClient();
    const pong = await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Redis ping timeout")), 500)),
    ]);
    return pong === "PONG";
  } catch {
    return false;
  }
}

module.exports = {
  getRedisConfig,
  getRedisClient,
  isRedisAvailable,
};
