const mongoose = require("mongoose");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/agentflow";

async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    console.error(
      "The server will start without a database connection."
    );
    console.error(
      "Set MONGODB_URI in your .env file to a running MongoDB instance."
    );
  }
}

function getDatabaseStatus() {
  // mongoose.connection.readyState:
  //   0 = disconnected
  //   1 = connected
  //   2 = connecting
  //   3 = disconnecting
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  const readyState = mongoose.connection.readyState;

  return {
    status: states[readyState] || "unknown",
    connected: readyState === 1,
  };
}

module.exports = { connectDatabase, getDatabaseStatus };
