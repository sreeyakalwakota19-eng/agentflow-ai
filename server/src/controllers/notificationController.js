const {
  getNotifications,
  markAsRead,
  markAllAsRead,
} = require("../services/notificationService");

async function listNotifications(req, res, next) {
  try {
    const { page, limit, unreadOnly } = req.query;
    const result = await getNotifications(req.user.userId, {
      page,
      limit,
      unreadOnly: unreadOnly === "true",
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

async function markNotificationRead(req, res, next) {
  try {
    const { id } = req.params;
    const result = await markAsRead(id, req.user.userId);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

async function markAllNotificationsRead(req, res, next) {
  try {
    const result = await markAllAsRead(req.user.userId);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
