const { Notification, NotificationType } = require("../models/Notification");

/**
 * Creates and persists a high-level notification and broadcasts via Socket.IO
 */
async function createNotification({
  recipient,
  type = NotificationType.SYSTEM,
  title,
  message,
  executionId = null,
  workflowId = null,
  metadata = {},
}) {
  if (!recipient || !title || !message) {
    throw new Error("Recipient, title, and message are required for notification creation");
  }

  const notification = await Notification.create({
    recipient,
    type,
    title,
    message,
    execution: executionId,
    workflow: workflowId,
    read: false,
    metadata,
  });

  try {
    const { getSocketServer } = require("../socket");
    const io = getSocketServer();
    if (io) {
      // Broadcast to user-specific room
      io.to(`user:${String(recipient)}`).emit("new_notification", notification.toObject());
    }
  } catch {}

  return notification;
}

/**
 * Retrieves paginated notifications with unread count for an operator
 */
async function getNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
  const filter = { recipient: userId };
  if (unreadOnly) {
    filter.read = false;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .populate("workflow", "name version")
      .populate("execution", "status durationMs")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: userId, read: false }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
}

/**
 * Marks a single notification as read
 */
async function markAsRead(notificationId, userId) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { read: true, readAt: new Date() },
    { new: true }
  ).lean();

  if (!notification) {
    const error = new Error("Notification not found");
    error.status = 404;
    throw error;
  }

  const unreadCount = await Notification.countDocuments({ recipient: userId, read: false });

  return {
    notification,
    unreadCount,
  };
}

/**
 * Marks all unread notifications as read for a user
 */
async function markAllAsRead(userId) {
  await Notification.updateMany(
    { recipient: userId, read: false },
    { read: true, readAt: new Date() }
  );

  return {
    success: true,
    unreadCount: 0,
  };
}

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  NotificationType,
};
