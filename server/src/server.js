const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");

require("dotenv").config();

const { connectDatabase, getDatabaseStatus } = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const workflowRoutes = require("./routes/workflowRoutes");
const executionRoutes = require("./routes/executionRoutes");
const integrationRoutes = require("./routes/integrationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const { errorHandler } = require("./middleware/errorHandler");
const { initSocketServer } = require("./socket");
const { startExecutionWorker, stopExecutionWorker } = require("./queue/executionWorker");
const { closeQueue } = require("./queue/executionQueue");

const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.IO Server
const io = initSocketServer(httpServer);

const PORT = process.env.PORT || 5000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

const { apiLimiter } = require("./middleware/rateLimiter");

app.use(express.json());
app.use(morgan("dev"));
app.use(compression());
app.use("/api", apiLimiter);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/api/health", (req, res) => {
  const db = getDatabaseStatus();

  res.json({
    success: true,
    message: "Agentflow API is running",
    database: db,
    realtime: {
      socketIo: Boolean(io),
    },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/executions", executionRoutes);
app.use("/api/integrations", integrationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);

// ---------------------------------------------------------------------------
// Error handling (registered after routes)
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
async function startServer() {
  await connectDatabase();
  await startExecutionWorker();

  httpServer.listen(PORT, () => {
    console.log(`Agentflow server & Socket.IO running on http://localhost:${PORT}`);
  });

  async function gracefulShutdown(signal) {
    console.log(`\nReceived ${signal}. Gracefully shutting down server, socket, and workers...`);
    await stopExecutionWorker();
    await closeQueue();
    httpServer.close(() => {
      console.log("HTTP & Socket.IO server closed.");
      process.exit(0);
    });
  }

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  return httpServer;
}

// Only start the server if executed directly (not required in tests)
if (require.main === module) {
  startServer();
}

module.exports = { app, httpServer, startServer };