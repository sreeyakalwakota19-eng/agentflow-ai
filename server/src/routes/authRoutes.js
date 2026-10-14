const express = require("express");
const { body } = require("express-validator");

const {
  register,
  login,
  me,
} = require("../controllers/authController");

const { authenticate } = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/errorHandler");
const { authLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

const registerValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("A valid email address is required"),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
];

const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("A valid email address is required"),

  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];

router.post("/register", authLimiter, registerValidation, validateRequest, register);
router.post("/login", authLimiter, loginValidation, validateRequest, login);
router.get("/me", authenticate, me);

module.exports = router;