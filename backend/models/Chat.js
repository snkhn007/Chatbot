// models/Chat.js
// =============================================================
// This file defines the MongoDB schema (structure) for storing
// chat sessions and their message history.
// =============================================================

const mongoose = require("mongoose");

// --- Message Schema ---
// Each message has a role ("user" or "assistant") and content (text)
const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant", "system"], // only these values allowed
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now, // auto-set to current time
  },
});

// --- Chat Session Schema ---
// Each session has a unique sessionId and an array of messages
const ChatSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true, // one document per session
    index: true,  // indexed for fast lookup
  },
  messages: [MessageSchema], // array of messages
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Auto-update the updatedAt field on every save
ChatSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Chat", ChatSchema);
