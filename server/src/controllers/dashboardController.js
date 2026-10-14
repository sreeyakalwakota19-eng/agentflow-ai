const { getDashboardStats } = require("../services/dashboardService");

async function stats(req, res, next) {
  try {
    const data = await getDashboardStats(req.user.userId, req.user.role);
    res.status(200).json({
      success: true,
      stats: data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  stats,
};
