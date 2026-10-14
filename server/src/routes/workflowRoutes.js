const express = require("express");
const { body, param } = require("express-validator");

const {
  generate,
  create,
  list,
  getById,
  update,
  duplicate,
  remove,
} = require("../controllers/workflowController");

const { authenticate } = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/errorHandler");
const { aiLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Require authentication for all workflow endpoints
router.use(authenticate);

const generateValidation = [
  body("prompt")
    .trim()
    .notEmpty()
    .withMessage("Natural language prompt is required")
    .isLength({ min: 2, max: 2000 })
    .withMessage("Prompt must be between 2 and 2000 characters"),
];

const createValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Workflow name is required")
    .isLength({ min: 1, max: 120 })
    .withMessage("Workflow name must be between 1 and 120 characters"),

  body("status")
    .optional()
    .isIn(["draft", "active", "paused", "archived"])
    .withMessage("Status must be draft, active, paused, or archived"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array of strings"),
];

const updateValidation = [
  param("id").isMongoId().withMessage("Invalid workflow ID format"),

  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Workflow name cannot be empty")
    .isLength({ min: 1, max: 120 })
    .withMessage("Workflow name must be between 1 and 120 characters"),

  body("status")
    .optional()
    .isIn(["draft", "active", "paused", "archived"])
    .withMessage("Status must be draft, active, paused, or archived"),

  body("nodes").optional().isArray().withMessage("Nodes must be an array"),
  body("edges").optional().isArray().withMessage("Edges must be an array"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
];

const idValidation = [
  param("id").isMongoId().withMessage("Invalid workflow ID format"),
];

router.post("/generate", aiLimiter, generateValidation, validateRequest, generate);
router.post("/", createValidation, validateRequest, create);
router.get("/", list);
router.get("/:id", idValidation, validateRequest, getById);
router.put("/:id", updateValidation, validateRequest, update);
router.post("/:id/duplicate", idValidation, validateRequest, duplicate);
router.delete("/:id", idValidation, validateRequest, remove);

module.exports = router;
