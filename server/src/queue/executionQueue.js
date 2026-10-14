const { Queue } = require("bullmq");
const { getRedisConfig, isRedisAvailable } = require("../config/redis");
const { orchestrator } = require("../orchestrator/ExecutionOrchestrator");

const QUEUE_NAME = "workflow-executions";

let executionQueue = null;
let useFallback = false;

function getExecutionQueue() {
  if (!executionQueue && !useFallback) {
    try {
      const redisConfig = getRedisConfig();
      executionQueue = new Queue(QUEUE_NAME, {
        connection: redisConfig,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      });

      executionQueue.on("error", (err) => {
        if (process.env.NODE_ENV !== "production") {
          useFallback = true;
          console.warn(
            `[BullMQ Queue] Redis connection unavailable (${err.message}). Falling back to local development in-memory queue. [NOTICE: Development fallback is NOT production-grade or multi-worker safe].`
          );
        } else {
          console.error("[BullMQ Queue] Error:", err.message);
        }
      });
    } catch (err) {
      useFallback = true;
      console.warn(
        `[BullMQ Queue] Could not initialize BullMQ (${err.message}). Using local in-memory fallback.`
      );
    }
  }
  return executionQueue;
}

/**
 * Enqueues an execution job to BullMQ or local fallback runner
 */
async function enqueueExecution(executionId, options = {}) {
  const attempts = options.maxRetries ? options.maxRetries + 1 : 3;

  const redisOk = await isRedisAvailable();

  if (redisOk) {
    try {
      const queue = getExecutionQueue();
      const job = await queue.add(
        "run-workflow",
        {
          executionId: String(executionId),
          enqueuedAt: new Date().toISOString(),
        },
        {
          attempts,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          priority: options.priority || 10,
        }
      );

      console.log(`[Queue] Enqueued execution ${executionId} as BullMQ job ${job.id}`);
      return { success: true, mode: "bullmq", jobId: job.id };
    } catch (err) {
      console.warn(`[Queue] BullMQ add failed (${err.message}), falling back to async dev runner.`);
    }
  }

  // Development asynchronous fallback
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[Queue:DevFallback] Processing execution ${executionId} in development async worker. [Notice: Local fallback only]`
    );
  }

  setImmediate(async () => {
    try {
      await orchestrator.runExecution(executionId);
    } catch (err) {
      console.error(`[Queue:DevFallback] Execution ${executionId} failed:`, err.message);
    }
  });

  return { success: true, mode: "dev_fallback", jobId: `local_${Date.now()}` };
}

/**
 * Gracefully shuts down the queue
 */
async function closeQueue() {
  if (executionQueue) {
    try {
      await executionQueue.close();
      executionQueue = null;
      console.log("[Queue] BullMQ queue closed successfully.");
    } catch (err) {
      console.error("[Queue] Error closing queue:", err.message);
    }
  }
}

module.exports = {
  getExecutionQueue,
  enqueueExecution,
  closeQueue,
  QUEUE_NAME,
};
