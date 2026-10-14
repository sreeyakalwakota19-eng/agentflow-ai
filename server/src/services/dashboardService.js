const { Workflow } = require("../models/Workflow");
const { Execution, ExecutionStatus } = require("../models/Execution");
const { ExecutionLog } = require("../models/ExecutionLog");

async function getDashboardStats(userId, userRole = "operator") {
  const filter = userRole === "admin" ? {} : { owner: userId };

  const [
    workflowCount,
    executionCount,
    successCount,
    failedCount,
    runningCount,
    recentExecutions,
    failedExecutions,
  ] = await Promise.all([
    Workflow.countDocuments(filter),
    Execution.countDocuments(filter),
    Execution.countDocuments({ ...filter, status: ExecutionStatus.COMPLETED }),
    Execution.countDocuments({ ...filter, status: ExecutionStatus.FAILED }),
    Execution.countDocuments({
      ...filter,
      status: { $in: [ExecutionStatus.RUNNING, ExecutionStatus.RETRYING] },
    }),
    Execution.find(filter)
      .populate("workflow", "name version")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Execution.find({ ...filter, status: ExecutionStatus.FAILED })
      .populate("workflow", "name version")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  // Calculate success rate
  const completedOrFailed = successCount + failedCount;
  const successRate =
    completedOrFailed > 0 ? Math.round((successCount / completedOrFailed) * 100) : 100;

  // Retrieve recent agent activity logs
  const executionIds = recentExecutions.map((e) => e._id);
  const liveAgentActivity = await ExecutionLog.find({ execution: { $in: executionIds } })
    .sort({ timestamp: -1 })
    .limit(8)
    .lean();

  return {
    workflowCount,
    executionCount,
    successCount,
    failedCount,
    runningCount,
    successRate,
    recentExecutions,
    failedExecutions,
    liveAgentActivity,
  };
}

module.exports = {
  getDashboardStats,
};
