const { validationResult } = require("express-validator");

function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  next();
}

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || (err.code === 11000 ? 409 : 500);

  // Only log unexpected server errors (500s) to keep logs clean and prevent any sensitive data leakage
  if (statusCode >= 500) {
    console.error("Internal Server Error:", err.message);
  }

  let message = err.message || "Internal server error";

  if (err.code === 11000) {
    message = "An account with this email already exists";
  }

  if (statusCode === 500 && process.env.NODE_ENV === "production") {
    message = "Internal server error";
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.errors && { errors: err.errors }),
  });
}

module.exports = {
  validateRequest,
  errorHandler,
};