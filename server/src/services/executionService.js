const { Execution, ExecutionStatus } = require("../models/Execution");
const { ExecutionLog } = require("../models/ExecutionLog");
const { Workflow } = require("../models/Workflow");
const { enqueueExecution } = require("../queue/executionQueue");
const { orchestrator } = require("../orchestrator/ExecutionOrchestrator");

/**
 * Creates and triggers a new workflow execution with an immutable snapshot
 */
async function createExecution(userId, { workflowId, inputs = {}, maxRetries = 3 }) {
  const workflow = await Workflow.findById(workflowId);
  if (!workflow) {
    const error = new Error("Workflow not found");
    error.status = 404;
    throw error;
  }

  // Create immutable snapshot of the workflow definition
  const workflowSnapshot = {
    _id: workflow._id,
    name: workflow.name,
    description: workflow.description,
    version: workflow.version,
    triggerConfig: workflow.triggerConfig,
    nodes: workflow.nodes,
    edges: workflow.edges,
    tags: workflow.tags,
  };

  const execution = await Execution.create({
    workflow: workflow._id,
    workflowSnapshot,
    owner: userId,
    status: ExecutionStatus.PENDING,
    inputs,
    maxRetries,
  });

  // Enqueue execution to BullMQ / Redis background worker
  await enqueueExecution(execution._id, { maxRetries });

  return execution;
}

/**
 * Lists executions with pagination and filtering
 */
async function getExecutions(userId, query = {}, userRole = "operator") {
  const { page = 1, limit = 10, workflowId, status, sortBy = "createdAt", sortOrder = "desc" } = query;

  const filter = {};

  if (userRole !== "admin") {
    filter.owner = userId;
  }

  if (workflowId) {
    filter.workflow = workflowId;
  }

  if (status && Object.values(ExecutionStatus).includes(status.toUpperCase())) {
    filter.status = status.toUpperCase();
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortDirection };

  const [executions, total] = await Promise.all([
    Execution.find(filter)
      .populate("workflow", "name status version")
      .populate("owner", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Execution.countDocuments(filter),
  ]);

  return {
    executions,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
}

/**
 * Retrieves single execution detail with ownership verification
 */
async function getExecutionById(executionId, userId, userRole = "operator") {
  const execution = await Execution.findById(executionId)
    .populate("workflow", "name status version")
    .populate("owner", "name email")
    .lean();

  if (!execution) {
    const error = new Error("Execution not found");
    error.status = 404;
    throw error;
  }

  if (userRole !== "admin" && String(execution.owner._id || execution.owner) !== String(userId)) {
    const error = new Error("Access denied: You do not own this execution");
    error.status = 403;
    throw error;
  }

  return execution;
}

/**
 * Retrieves execution event logs timeline
 */
async function getExecutionLogs(executionId, userId, userRole = "operator") {
  await getExecutionById(executionId, userId, userRole);
  return await ExecutionLog.find({ execution: executionId }).sort({ timestamp: 1 }).lean();
}

/**
 * Pauses an execution
 */
async function pauseExecution(executionId, userId, userRole = "operator") {
  await getExecutionById(executionId, userId, userRole);
  return await orchestrator.pauseExecution(executionId);
}

/**
 * Resumes an execution
 */
async function resumeExecution(executionId, userId, userRole = "operator") {
  await getExecutionById(executionId, userId, userRole);
  return await orchestrator.resumeExecution(executionId);
}

/**
 * Cancels an execution
 */
async function cancelExecution(executionId, userId, userRole = "operator") {
  await getExecutionById(executionId, userId, userRole);
  return await orchestrator.cancelExecution(executionId);
}

module.exports = {
  createExecution,
  getExecutions,
  getExecutionById,
  getExecutionLogs,
  pauseExecution,
  resumeExecution,
  cancelExecution,
};
