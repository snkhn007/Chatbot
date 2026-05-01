// routes/chat.js
// =============================================================
// This file handles the /api/chat POST route.
// It:
//   1. Receives the user's message and sessionId
//   2. Loads chat history from MongoDB
//   3. Sends history + message to OpenAI
//   4. Saves the reply to MongoDB
//   5. Returns the reply to the frontend
// =============================================================

const express = require("express");
const router = express.Router();
const Groq = require("groq-sdk");  // Groq SDK — free, same style as OpenAI
const Chat = require("../models/Chat");

// Initialize Groq client using API key from .env
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// =============================================================
// PROMPT ENGINEERING — Domain-Specific System Prompt
// =============================================================
// This system prompt locks the chatbot to the Education domain.
// It tells the AI WHO it is, WHAT it does, and HOW to behave.
// This is sent as the first message in every conversation.
// =============================================================
const SYSTEM_PROMPT = `
You are StudyBot — a friendly, knowledgeable, and encouraging AI study assistant designed for students of all levels.

YOUR ROLE:
- Help students understand difficult concepts clearly and simply
- Explain topics using examples, analogies, and step-by-step breakdowns
- Assist with homework, exam preparation, essays, and project ideas
- Quiz students and provide feedback on their answers
- Suggest study tips, techniques (like Pomodoro, mind maps, spaced repetition)
- Support subjects including: Mathematics, Science, History, Literature, Programming, Economics, and more

YOUR PERSONALITY:
- Friendly, patient, and encouraging — never condescending
- Celebrate correct answers and gently correct mistakes
- Use simple language, but don't oversimplify
- Use emojis occasionally to keep the tone light and motivating 📚✨

STRICT RULES:
- ONLY answer questions related to education, learning, academics, and study skills
- If asked about anything outside education (e.g., cooking, politics, entertainment), politely redirect:
  "I'm a study assistant and can only help with educational topics! Let's get back to learning 📖"
- Never write essays or assignments FOR students — guide them to write it themselves
- Always encourage critical thinking

FORMAT:
- Use bullet points or numbered steps when explaining multi-step concepts
- Use code blocks when explaining programming
- Keep answers concise unless a detailed explanation is clearly needed
`;

// =============================================================
// POST /api/chat
// =============================================================
router.post("/", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    // --- Input validation ---
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ error: "Message is required." });
    }
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "Session ID is required." });
    }

    // --- Load or create chat session from MongoDB ---
    let chat = await Chat.findOne({ sessionId });

    if (!chat) {
      // First message in this session — create a new session document
      chat = new Chat({
        sessionId,
        messages: [], // start with empty history
      });
    }

    // --- Build the messages array to send to OpenAI ---
    // Format: [{ role, content }, ...]
    // We always prepend the system prompt, then append chat history
    const openAIMessages = [
      { role: "system", content: SYSTEM_PROMPT }, // domain lock
      ...chat.messages.map((m) => ({              // past history
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message.trim() },  // new user message
    ];

    // --- Call Groq API (FREE) ---
    // MODEL CONFIGURATION:
    //   model: llama3-8b-8192 — Meta's LLaMA 3, free on Groq
    //   temperature: 0.6 — balanced creativity (0=robotic, 1=very creative)
    //     → 0.6 is ideal for education: not too rigid, not too random
    //   top_p: 0.9 — considers top 90% probable tokens for variety
    //     → keeps responses relevant but naturally worded
    //   max_tokens: 800 — limits response length to avoid overlong answers
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: openAIMessages,
      temperature: 0.6,
      top_p: 0.9,
      max_tokens: 800,
    });

    // Extract the AI's reply text
    const assistantReply = completion.choices[0].message.content;

    // --- Save the new user message and AI reply to MongoDB ---
    chat.messages.push({ role: "user", content: message.trim() });
    chat.messages.push({ role: "assistant", content: assistantReply });
    await chat.save();

    // --- Send the reply back to the frontend ---
    res.json({
      reply: assistantReply,
      sessionId,
    });

  } catch (error) {
    console.error("❌ Chat route error:", error.message);

    // Handle specific OpenAI errors
    if (error.status === 401) {
      return res.status(401).json({ error: "Invalid OpenAI API key." });
    }
    if (error.status === 429) {
      return res.status(429).json({ error: "Rate limit reached. Please wait a moment." });
    }

    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// =============================================================
// GET /api/chat/history/:sessionId
// Fetch previous chat messages for a session (on page reload)
// =============================================================
router.get("/history/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const chat = await Chat.findOne({ sessionId });

    if (!chat) {
      return res.json({ messages: [] }); // no history yet
    }

    res.json({ messages: chat.messages });
  } catch (error) {
    console.error("❌ History fetch error:", error.message);
    res.status(500).json({ error: "Could not fetch history." });
  }
});

// =============================================================
// DELETE /api/chat/clear/:sessionId
// Clear chat history for a session (new chat button)
// =============================================================
router.delete("/clear/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    await Chat.findOneAndDelete({ sessionId });
    res.json({ success: true, message: "Chat cleared." });
  } catch (error) {
    console.error("❌ Clear chat error:", error.message);
    res.status(500).json({ error: "Could not clear chat." });
  }
});

module.exports = router;
