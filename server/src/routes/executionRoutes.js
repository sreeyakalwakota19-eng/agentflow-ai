const express = require("express");
const { body, param } = require("express-validator");

const {
  create,
  list,
  getById,
  getLogs,
  pause,
  resume,
  cancel,
} = require("../controllers/executionController");

const { authenticate } = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/errorHandler");

const router = express.Router();

// Require authentication for all execution routes
router.use(authenticate);

const createValidation = [
  body("workflowId")
    .notEmpty()
    .withMessage("Workflow ID is required")
    .isMongoId()
    .withMessage("Invalid workflow ID format"),

  body("inputs")
    .optional()
    .isObject()
    .withMessage("Inputs must be an object"),

  body("maxRetries")
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage("Max retries must be between 0 and 10"),
];

const idValidation = [
  param("id").isMongoId().withMessage("Invalid execution ID format"),
];

router.post("/", createValidation, validateRequest, create);
router.get("/", list);
router.get("/:id", idValidation, validateRequest, getById);
router.get("/:id/logs", idValidation, validateRequest, getLogs);
router.post("/:id/pause", idValidation, validateRequest, pause);
router.post("/:id/resume", idValidation, validateRequest, resume);
router.post("/:id/cancel", idValidation, validateRequest, cancel);

module.exports = router;
