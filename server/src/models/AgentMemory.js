const mongoose = require("mongoose");

const agentMemorySchema = new mongoose.Schema(
  {
    execution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Execution",
      required: true,
      index: true,
    },
    agent: {
      type: String,
      required: true,
    },
    key: {
      type: String,
      required: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    context: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

agentMemorySchema.index({ execution: 1, agent: 1, key: 1 }, { unique: true });

const AgentMemory = mongoose.model("AgentMemory", agentMemorySchema);

module.exports = {
  AgentMemory,
};
