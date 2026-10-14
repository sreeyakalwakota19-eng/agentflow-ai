const express = require("express");
const { param, body } = require("express-validator");

const {
  list,
  status,
  startOAuthFlow,
  oauthCallback,
  oauthError,
  executeAction,
  disconnect,
} = require("../controllers/integrationController");

const { authenticate } = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/errorHandler");

const router = express.Router();

const providerParamValidation = [
  param("provider")
    .isIn(["gmail", "slack", "discord", "sheets"])
    .withMessage("Provider must be one of: gmail, slack, discord, sheets"),
];

const executeValidation = [
  ...providerParamValidation,
  body("action").trim().notEmpty().withMessage("Action name is required"),
  body("params").optional().isObject().withMessage("Params must be an object"),
];

// Public OAuth Callback & Error Routes
router.get("/oauth/error", oauthError);
router.get("/oauth/:provider/callback", providerParamValidation, validateRequest, oauthCallback);

// Authenticated Integration Management Routes
router.get("/", authenticate, list);
router.get("/status", authenticate, status);
router.get("/oauth/:provider/start", authenticate, providerParamValidation, validateRequest, startOAuthFlow);
router.post("/:provider/execute", authenticate, executeValidation, validateRequest, executeAction);
router.delete("/:provider", authenticate, providerParamValidation, validateRequest, disconnect);
router.post("/:provider/disconnect", authenticate, providerParamValidation, validateRequest, disconnect);

module.exports = router;
