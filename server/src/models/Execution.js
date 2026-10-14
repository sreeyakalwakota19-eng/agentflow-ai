const mongoose = require("mongoose");

const ExecutionStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  RETRYING: "RETRYING",
  PAUSED: "PAUSED",
  CANCELLED: "CANCELLED",
};

const executionSchema = new mongoose.Schema(
  {
    workflow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workflow",
      required: true,
      index: true,
    },
    // Immutable snapshot of the workflow at the moment of execution
    workflowSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ExecutionStatus),
      default: ExecutionStatus.PENDING,
      index: true,
    },
    inputs: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    outputs: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    nodeOutputs: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    error: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    plan: {
      executionOrder: [String],
      confidenceScore: Number,
      estimatedSteps: Number,
      details: [mongoose.Schema.Types.Mixed],
    },
    currentStepIndex: {
      type: Number,
      default: 0,
    },
    currentNodeId: {
      type: String,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    pausedAt: {
      type: Date,
      default: null,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

executionSchema.index({ owner: 1, createdAt: -1 });
executionSchema.index({ workflow: 1, status: 1 });

const Execution = mongoose.model("Execution", executionSchema);

module.exports = {
  Execution,
  ExecutionStatus,
};
