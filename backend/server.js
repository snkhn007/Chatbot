// server.js
// =============================================================
// This is the main entry point of the backend.
// It sets up the Express server, connects to MongoDB,
// and registers all API routes.
// =============================================================

// Load environment variables from .env file FIRST
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Import our chat route
const chatRoute = require("./routes/chat");

// Create the Express app
const app = express();

// =============================================================
// MIDDLEWARE SETUP
// =============================================================

// Enable CORS — allows the frontend (different port) to call our API
// In production, replace "*" with your actual frontend URL
app.use(cors({
  origin: "*", // Allow all origins (update to specific URL in production)
  methods: ["GET", "POST", "DELETE"],
}));

// Parse incoming JSON request bodies
app.use(express.json());
const path = require("path");
app.use(express.static(path.join(__dirname, "../frontend")));

// =============================================================
// ROUTES
// =============================================================

// Health check — visit http://localhost:5000/ to confirm server is running
app.get("/", (req, res) => {
  res.json({
    status: "✅ StudyBot API is running!",
    version: "1.0.0",
    endpoints: {
      chat: "POST /api/chat",
      history: "GET /api/chat/history/:sessionId",
      clear: "DELETE /api/chat/clear/:sessionId",
    },
  });
});

// Mount the chat routes under /api/chat
app.use("/api/chat", chatRoute);

// Handle unknown routes (404)
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// =============================================================
// DATABASE CONNECTION + SERVER START
// =============================================================
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB successfully");

    // Start the server only after DB connection is successful
    app.listen(PORT, () => {
      console.log(`🚀 StudyBot backend running on http://localhost:${PORT}`);
      console.log(`📖 API ready at http://localhost:${PORT}/api/chat`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    console.error("👉 Check your MONGODB_URI in the .env file");
    process.exit(1); // Stop the process if DB fails
  });
