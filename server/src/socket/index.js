const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

const JWT_SECRET = process.env.JWT_SECRET || "agentflow_jwt_secret_key_default";

/**
 * Initializes Socket.IO server with authenticated middleware and room handling
 */
function initSocketServer(httpServer, { forceNew = false } = {}) {
  if (io && !forceNew) return io;
  if (io && forceNew) {
    try {
      io.close();
    } catch {}
    io = null;
  }

  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  // JWT Authentication Middleware for Socket Connections
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "") ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error("Authentication error: No JWT token provided"));
      }

      const secret = process.env.JWT_SECRET || "agentflow_jwt_secret_key_default";
      const decoded = jwt.verify(token, secret);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  // Socket Connection Handling
  io.on("connection", (socket) => {
    const userId = socket.user?.userId;
    console.log(`[Socket.IO] Client connected: ${socket.id} (User: ${userId || "unknown"})`);

    // Auto-join user's personal notification room
    if (userId) {
      socket.join(`user:${userId}`);
    }

    // Join Execution Room
    socket.on("join_execution", (executionId) => {
      if (!executionId) return;
      const room = `execution:${executionId}`;
      socket.join(room);
      console.log(`[Socket.IO] Socket ${socket.id} joined room ${room}`);

      socket.emit("joined_execution", {
        executionId,
        room,
        joinedAt: new Date().toISOString(),
      });
    });

    // Leave Execution Room
    socket.on("leave_execution", (executionId) => {
      if (!executionId) return;
      const room = `execution:${executionId}`;
      socket.leave(room);
      console.log(`[Socket.IO] Socket ${socket.id} left room ${room}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (Reason: ${reason})`);
    });
  });

  return io;
}

function getSocketServer() {
  return io;
}

/**
 * Emits an event to all clients watching a specific execution
 */
function emitExecutionEvent(executionId, eventName, payload) {
  if (!io || !executionId) return;
  const room = `execution:${executionId}`;
  io.to(room).emit(eventName, {
    executionId: String(executionId),
    ...payload,
  });
}

module.exports = {
  initSocketServer,
  getSocketServer,
  emitExecutionEvent,
};
