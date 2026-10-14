const mongoose = require("mongoose");

const workflowSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Workflow name is required"],
      trim: true,
      minlength: [1, "Workflow name cannot be empty"],
      maxlength: [120, "Workflow name cannot exceed 120 characters"],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Workflow owner is required"],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ["draft", "active", "paused", "archived"],
        message: "Status must be draft, active, paused, or archived",
      },
      default: "draft",
      index: true,
    },
    triggerConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        type: "manual",
        config: {},
      }),
    },
    nodes: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    edges: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for query optimization
workflowSchema.index({ owner: 1, status: 1, updatedAt: -1 });

const Workflow = mongoose.model("Workflow", workflowSchema);

module.exports = Workflow;
module.exports.Workflow = Workflow;
