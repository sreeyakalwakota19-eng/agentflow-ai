const mongoose = require("mongoose");

const executionLogSchema = new mongoose.Schema(
  {
    execution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Execution",
      required: true,
      index: true,
    },
    agent: {
      type: String,
      enum: [
        "PlannerAgent",
        "ExecutionAgent",
        "ValidationAgent",
        "RecoveryAgent",
        "MonitoringAgent",
        "Orchestrator",
      ],
      required: true,
    },
    level: {
      type: String,
      enum: ["info", "warn", "error", "debug"],
      default: "info",
    },
    event: {
      type: String,
      required: true,
      index: true,
    },
    nodeId: {
      type: String,
      default: null,
    },
    nodeType: {
      type: String,
      default: null,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

executionLogSchema.index({ execution: 1, timestamp: 1 });

const ExecutionLog = mongoose.model("ExecutionLog", executionLogSchema);

module.exports = {
  ExecutionLog,
};
