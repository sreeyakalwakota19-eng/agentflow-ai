const express = require("express");
const { param } = require("express-validator");
const {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/notificationController");
const { authenticate } = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/errorHandler");

const router = express.Router();

router.use(authenticate);

const idValidation = [
  param("id").isMongoId().withMessage("Invalid notification ID format"),
];

router.get("/", listNotifications);
router.patch("/:id/read", idValidation, validateRequest, markNotificationRead);
router.post("/read-all", markAllNotificationsRead);

module.exports = router;
