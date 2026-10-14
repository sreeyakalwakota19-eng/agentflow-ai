const {
  createExecution,
  getExecutions,
  getExecutionById,
  getExecutionLogs,
  pauseExecution,
  resumeExecution,
  cancelExecution,
} = require("../services/executionService");

async function create(req, res, next) {
  try {
    const execution = await createExecution(req.user.userId, req.body);
    res.status(201).json({
      success: true,
      message: "Execution started successfully",
      execution,
    });
  } catch (error) {
    next(error);
  }
}

async function list(req, res, next) {
  try {
    const result = await getExecutions(req.user.userId, req.query, req.user.role);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const execution = await getExecutionById(req.params.id, req.user.userId, req.user.role);
    res.status(200).json({
      success: true,
      execution,
    });
  } catch (error) {
    next(error);
  }
}

async function getLogs(req, res, next) {
  try {
    const logs = await getExecutionLogs(req.params.id, req.user.userId, req.user.role);
    res.status(200).json({
      success: true,
      logs,
    });
  } catch (error) {
    next(error);
  }
}

async function pause(req, res, next) {
  try {
    const execution = await pauseExecution(req.params.id, req.user.userId, req.user.role);
    res.status(200).json({
      success: true,
      message: "Execution paused",
      execution,
    });
  } catch (error) {
    next(error);
  }
}

async function resume(req, res, next) {
  try {
    const execution = await resumeExecution(req.params.id, req.user.userId, req.user.role);
    res.status(200).json({
      success: true,
      message: "Execution resumed",
      execution,
    });
  } catch (error) {
    next(error);
  }
}

async function cancel(req, res, next) {
  try {
    const execution = await cancelExecution(req.params.id, req.user.userId, req.user.role);
    res.status(200).json({
      success: true,
      message: "Execution cancelled",
      execution,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  create,
  list,
  getById,
  getLogs,
  pause,
  resume,
  cancel,
};
