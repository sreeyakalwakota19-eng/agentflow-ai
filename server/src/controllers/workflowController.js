const {
  createWorkflow,
  getWorkflows,
  getWorkflowById,
  updateWorkflow,
  duplicateWorkflow,
  deleteWorkflow,
} = require("../services/workflowService");

const { generateWorkflow } = require("../services/aiGeneratorService");

async function generate(req, res, next) {
  try {
    const workflow = await generateWorkflow(req.body.prompt);
    res.status(200).json({
      success: true,
      message: "Workflow generated successfully",
      workflow,
    });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const workflow = await createWorkflow(req.user.userId, req.body);
    res.status(201).json({
      success: true,
      message: "Workflow created successfully",
      workflow,
    });
  } catch (error) {
    next(error);
  }
}

async function list(req, res, next) {
  try {
    const result = await getWorkflows(req.user.userId, req.query, req.user.role);
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
    const workflow = await getWorkflowById(req.params.id, req.user.userId, req.user.role);
    res.status(200).json({
      success: true,
      workflow,
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const workflow = await updateWorkflow(
      req.params.id,
      req.user.userId,
      req.body,
      req.user.role
    );
    res.status(200).json({
      success: true,
      message: "Workflow updated successfully",
      workflow,
    });
  } catch (error) {
    next(error);
  }
}

async function duplicate(req, res, next) {
  try {
    const workflow = await duplicateWorkflow(
      req.params.id,
      req.user.userId,
      req.user.role
    );
    res.status(201).json({
      success: true,
      message: "Workflow duplicated successfully",
      workflow,
    });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const result = await deleteWorkflow(
      req.params.id,
      req.user.userId,
      req.user.role
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generate,
  create,
  list,
  getById,
  update,
  duplicate,
  remove,
};
