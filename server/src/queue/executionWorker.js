const { Worker } = require("bullmq");
const { getRedisConfig, isRedisAvailable } = require("../config/redis");
const { orchestrator } = require("../orchestrator/ExecutionOrchestrator");
const { QUEUE_NAME } = require("./executionQueue");

let executionWorker = null;

/**
 * Creates and starts the BullMQ background worker
 */
async function startExecutionWorker(concurrency = 5) {
  if (executionWorker) {
    return executionWorker;
  }

  const redisOk = await isRedisAvailable();
  if (!redisOk) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[Worker] Redis unavailable in local dev. Worker standby mode active (tasks handled by dev fallback)."
      );
    }
    return null;
  }

  const redisConfig = getRedisConfig();

  executionWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { executionId } = job.data;
      console.log(
        `[Worker] Processing Job ${job.id} (Execution ${executionId}) - Attempt ${job.attemptsMade + 1}/${
          job.opts.attempts || 3
        }`
      );

      // Delegate directly to the master ExecutionOrchestrator
      const result = await orchestrator.runExecution(executionId);

      if (result.status === "FAILED") {
        const errorMsg = result.error?.message || "Execution finished with status FAILED";
        throw new Error(errorMsg);
      }

      return {
        executionId,
        status: result.status,
        durationMs: result.durationMs,
      };
    },
    {
      connection: redisConfig,
      concurrency,
    }
  );

  // Worker Lifecycle Events
  executionWorker.on("completed", (job) => {
    console.log(
      `[Worker] Job ${job.id} (Execution ${job.data.executionId}) COMPLETED successfully in ${
        job.returnvalue?.durationMs || 0
      }ms`
    );
  });

  executionWorker.on("failed", (job, err) => {
    console.warn(
      `[Worker] Job ${job?.id} (Execution ${job?.data?.executionId}) FAILED on attempt ${
        job?.attemptsMade
      }: ${err.message}`
    );
  });

  executionWorker.on("error", (err) => {
    console.error(`[Worker] Internal worker error: ${err.message}`);
  });

  console.log(`[Worker] BullMQ Execution Worker started (Concurrency: ${concurrency}).`);
  return executionWorker;
}

/**
 * Gracefully shuts down the background worker
 */
async function stopExecutionWorker() {
  if (executionWorker) {
    try {
      console.log("[Worker] Shutting down execution worker gracefully...");
      await executionWorker.close();
      executionWorker = null;
      console.log("[Worker] Execution worker closed.");
    } catch (err) {
      console.error("[Worker] Error stopping execution worker:", err.message);
    }
  }
}

module.exports = {
  startExecutionWorker,
  stopExecutionWorker,
};
