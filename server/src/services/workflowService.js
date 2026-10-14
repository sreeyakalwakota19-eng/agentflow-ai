const mongoose = require("mongoose");
const Workflow = require("../models/Workflow");

async function createWorkflow(ownerId, data) {
  const { name, description, status, triggerConfig, nodes, edges, tags } = data;

  const workflow = await Workflow.create({
    name: name ? name.trim() : "Untitled Workflow",
    description: description ? description.trim() : "",
    owner: ownerId,
    status: status || "draft",
    triggerConfig: triggerConfig || { type: "manual", config: {} },
    nodes: Array.isArray(nodes) ? nodes : [],
    edges: Array.isArray(edges) ? edges : [],
    tags: Array.isArray(tags) ? tags.map((t) => t.trim()).filter(Boolean) : [],
    version: 1,
  });

  return workflow;
}

async function getWorkflows(ownerId, query = {}, userRole = "operator") {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  // Filter criteria - operators can only see their own workflows
  const filter = userRole === "admin" && query.all === "true" ? {} : { owner: ownerId };

  // Status filter
  if (query.status) {
    filter.status = query.status;
  }

  // Tags filter
  if (query.tag) {
    filter.tags = query.tag;
  } else if (query.tags) {
    const tagList = Array.isArray(query.tags) ? query.tags : query.tags.split(",");
    filter.tags = { $in: tagList.map((t) => t.trim()) };
  }

  // Search filter by name or description
  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), "i");
    filter.$or = [{ name: searchRegex }, { description: searchRegex }];
  }

  const [workflows, total] = await Promise.all([
    Workflow.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("owner", "name email role"),
    Workflow.countDocuments(filter),
  ]);

  return {
    workflows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

async function getWorkflowById(workflowId, ownerId, userRole = "operator") {
  if (!mongoose.Types.ObjectId.isValid(workflowId)) {
    const error = new Error("Invalid workflow ID");
    error.statusCode = 400;
    throw error;
  }

  const workflow = await Workflow.findById(workflowId).populate("owner", "name email role");

  if (!workflow) {
    const error = new Error("Workflow not found");
    error.statusCode = 404;
    throw error;
  }

  // Ownership check
  const workflowOwnerId = workflow.owner._id ? workflow.owner._id.toString() : workflow.owner.toString();
  if (workflowOwnerId !== ownerId.toString() && userRole !== "admin") {
    const error = new Error("Access denied: You do not have permission to view this workflow");
    error.statusCode = 403;
    throw error;
  }

  return workflow;
}

async function updateWorkflow(workflowId, ownerId, updateData, userRole = "operator") {
  const workflow = await getWorkflowById(workflowId, ownerId, userRole);

  const { name, description, status, triggerConfig, nodes, edges, tags } = updateData;

  let structureChanged = false;

  if (name !== undefined) workflow.name = name.trim();
  if (description !== undefined) workflow.description = description.trim();
  if (status !== undefined) workflow.status = status;
  if (tags !== undefined && Array.isArray(tags)) {
    workflow.tags = tags.map((t) => t.trim()).filter(Boolean);
  }

  if (triggerConfig !== undefined) {
    workflow.triggerConfig = triggerConfig;
    structureChanged = true;
  }

  if (nodes !== undefined && Array.isArray(nodes)) {
    workflow.nodes = nodes;
    structureChanged = true;
  }

  if (edges !== undefined && Array.isArray(edges)) {
    workflow.edges = edges;
    structureChanged = true;
  }

  // Increment version if graph nodes, edges, or trigger configuration changed
  if (structureChanged) {
    workflow.version = (workflow.version || 1) + 1;
  }

  await workflow.save();
  return workflow;
}

async function duplicateWorkflow(workflowId, ownerId, userRole = "operator") {
  const original = await getWorkflowById(workflowId, ownerId, userRole);

  const duplicated = await Workflow.create({
    name: `${original.name} (Copy)`,
    description: original.description,
    owner: ownerId,
    status: "draft",
    triggerConfig: original.triggerConfig,
    nodes: original.nodes,
    edges: original.edges,
    tags: original.tags,
    version: 1,
  });

  return duplicated;
}

async function deleteWorkflow(workflowId, ownerId, userRole = "operator") {
  const workflow = await getWorkflowById(workflowId, ownerId, userRole);

  await Workflow.findByIdAndDelete(workflow._id);

  return {
    id: workflow._id,
    success: true,
    message: "Workflow deleted successfully",
  };
}

module.exports = {
  createWorkflow,
  getWorkflows,
  getWorkflowById,
  updateWorkflow,
  duplicateWorkflow,
  deleteWorkflow,
};
