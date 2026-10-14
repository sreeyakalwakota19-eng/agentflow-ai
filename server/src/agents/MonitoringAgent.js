const EventEmitter = require("events");
const { ExecutionLog } = require("../models/ExecutionLog");

/**
 * MonitoringAgent
 * Central telemetry and observation agent.
 * Records timeline events to MongoDB ExecutionLog and broadcasts events for Socket.IO.
 */
class MonitoringAgent extends EventEmitter {
  constructor() {
    super();
    this.name = "MonitoringAgent";
  }

  /**
   * Logs structured agent event to database and emits to realtime listeners
   */
  async logEvent(executionId, agentName, eventName, level = "info", data = {}, nodeId = null, nodeType = null) {
    const timestamp = new Date();

    const logEntry = {
      execution: executionId,
      agent: agentName,
      level,
      event: eventName,
      nodeId,
      nodeType,
      data,
      timestamp,
    };

    try {
      // Persist to ExecutionLog collection
      await ExecutionLog.create(logEntry);
    } catch (err) {
      console.error(`[MonitoringAgent] Failed to persist log entry:`, err.message);
    }

    // Broadcast event for WebSocket / Socket.IO streaming
    this.emit("agent_event", {
      executionId: String(executionId),
      ...logEntry,
    });

    try {
      const { emitExecutionEvent } = require("../socket");
      emitExecutionEvent(executionId, "agent_event", logEntry);
    } catch {
      // Safe fallback if socket server is not yet initialized
    }

    return logEntry;
  }

  /**
   * Retrieves full execution timeline from logs
   */
  async getExecutionTimeline(executionId) {
    return await ExecutionLog.find({ execution: executionId }).sort({ timestamp: 1 }).lean();
  }
}

module.exports = MonitoringAgent;
