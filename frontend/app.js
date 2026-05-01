// app.js
// =============================================================
// StudyBot Frontend Logic
// Handles:
//   - Sending messages to the backend
//   - Displaying user & bot messages
//   - Typing effect for bot responses
//   - Session management
//   - Chat history loading on page load
//   - New chat functionality
// =============================================================

// ============================================================
// CONFIG — Change the backend URL here
// For local development:  http://localhost:5000
// For production (Render): https://your-app.onrender.com
// ============================================================

const API_BASE_URL = "http://localhost:5000";
// ============================================================
// SESSION MANAGEMENT
// We use localStorage to persist the sessionId across page reloads.
// Each browser tab gets a unique session.
// ============================================================
function getOrCreateSessionId() {
  let sessionId = localStorage.getItem("studybot_session");
  if (!sessionId) {
    // Generate a random unique ID
    sessionId = "session_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
    localStorage.setItem("studybot_session", sessionId);
  }
  return sessionId;
}

let SESSION_ID = getOrCreateSessionId();
let isWaiting = false; // Prevent sending while bot is responding

// ============================================================
// DOM REFERENCES
// ============================================================
const messagesArea   = document.getElementById("messages-area");
const userInput      = document.getElementById("user-input");
const sendBtn        = document.getElementById("send-btn");
const charCount      = document.getElementById("char-count");
const welcomeScreen  = document.getElementById("welcome-screen");

// ============================================================
// UTILITY: Show a toast notification
// ============================================================
function showToast(message, color = "#ef4444") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.style.background = color;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}

// ============================================================
// UTILITY: Scroll to the bottom of the messages area
// ============================================================
function scrollToBottom() {
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

// ============================================================
// UTILITY: Simple markdown-like formatting
// Converts **bold**, `code`, and newlines to HTML
// ============================================================
function formatMessage(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Code blocks (triple backtick)
    .replace(/```(\w*)\n?([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Bullet points
    .replace(/^- (.+)/gm, "• $1")
    // Newlines to <br>
    .replace(/\n/g, "<br>");
}

// ============================================================
// HIDE WELCOME SCREEN
// Called when the first message is sent
// ============================================================
function hideWelcome() {
  if (welcomeScreen) {
    welcomeScreen.style.animation = "fadeOut 0.3s ease forwards";
    setTimeout(() => welcomeScreen.remove(), 300);
  }
}

// Add fade-out animation dynamically
const fadeOutStyle = document.createElement("style");
fadeOutStyle.textContent = `@keyframes fadeOut { to { opacity: 0; transform: translateY(-10px); } }`;
document.head.appendChild(fadeOutStyle);

// ============================================================
// APPEND MESSAGE: Add a message bubble to the chat
// role: "user" or "bot"
// ============================================================
function appendMessage(role, text) {
  const row = document.createElement("div");
  row.className = `message-row ${role === "user" ? "user" : ""}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${role === "user" ? "user-av" : "bot"}`;
  avatar.textContent = role === "user" ? "👤" : "📚";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${role === "user" ? "user-bubble" : "bot-bubble"}`;
  bubble.innerHTML = formatMessage(text);

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesArea.appendChild(row);
  scrollToBottom();

  return bubble; // Return bubble so typing effect can update it
}

// ============================================================
// TYPING INDICATOR: Show animated dots while bot is thinking
// ============================================================
function showTypingIndicator() {
  const row = document.createElement("div");
  row.className = "message-row";
  row.id = "typing-row";

  const avatar = document.createElement("div");
  avatar.className = "avatar bot";
  avatar.textContent = "📚";

  const bubble = document.createElement("div");
  bubble.className = "bubble bot-bubble";

  const indicator = document.createElement("div");
  indicator.className = "typing-indicator";
  indicator.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;

  bubble.appendChild(indicator);
  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesArea.appendChild(row);
  scrollToBottom();
}

// ============================================================
// REMOVE TYPING INDICATOR
// ============================================================
function removeTypingIndicator() {
  const typingRow = document.getElementById("typing-row");
  if (typingRow) typingRow.remove();
}

// ============================================================
// TYPING EFFECT: Stream text character by character
// Creates the illusion of the bot "typing" the response
// ============================================================
function typeText(bubble, text, speed = 12) {
  const formatted = text; // We'll render formatted text at the end
  let i = 0;
  const rawChars = text.split("");

  // Show a cursor during typing
  bubble.innerHTML = '<span class="cursor">▍</span>';

  const interval = setInterval(() => {
    i++;
    const partial = rawChars.slice(0, i).join("");
    bubble.innerHTML = formatMessage(partial) + '<span style="color:var(--accent);animation:pulse 1s infinite;">▍</span>';
    scrollToBottom();

    if (i >= rawChars.length) {
      clearInterval(interval);
      bubble.innerHTML = formatMessage(text); // Final clean render
      scrollToBottom();
    }
  }, speed);
}

// ============================================================
// SEND MESSAGE: Main function called when user submits
// ============================================================
async function sendMessage() {
  const message = userInput.value.trim();

  // Validation
  if (!message || isWaiting) return;
  if (message.length > 1000) {
    showToast("Message too long! Keep it under 1000 characters.");
    return;
  }

  // Hide welcome screen on first message
  hideWelcome();

  // Display user's message
  appendMessage("user", message);

  // Clear input and reset height
  userInput.value = "";
  userInput.style.height = "auto";
  charCount.textContent = "0";

  // Disable input while waiting
  isWaiting = true;
  sendBtn.disabled = true;
  userInput.disabled = true;

  // Show typing animation
  showTypingIndicator();

  try {
    // --------------------------------------------------------
    // API CALL: Send message to our Node.js backend
    // The backend will call OpenAI and return the reply
    // --------------------------------------------------------
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        sessionId: SESSION_ID,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();

    // Remove typing indicator and show bot reply with typing effect
    removeTypingIndicator();
    const botBubble = appendMessage("bot", ""); // empty bubble first
    typeText(botBubble, data.reply, 10);         // then animate text

  } catch (error) {
    removeTypingIndicator();
    console.error("Error:", error);

    if (error.message.includes("Failed to fetch")) {
      showToast("⚠️ Cannot connect to server. Is the backend running?");
      appendMessage("bot", "⚠️ I can't connect to the server right now. Make sure the backend is running at " + API_BASE_URL);
    } else {
      showToast("⚠️ " + error.message);
      appendMessage("bot", "❌ Sorry, something went wrong: " + error.message);
    }
  } finally {
    // Re-enable input
    isWaiting = false;
    sendBtn.disabled = false;
    userInput.disabled = false;
    userInput.focus();
  }
}

// ============================================================
// NEW CHAT: Clear history and reset the session
// ============================================================
async function newChat() {
  if (isWaiting) return;

  try {
    // Tell backend to delete this session's history
    await fetch(`${API_BASE_URL}/api/chat/clear/${SESSION_ID}`, {
      method: "DELETE",
    });
  } catch (e) {
    // Even if it fails, we reset the frontend
    console.warn("Could not clear server history:", e.message);
  }

  // Generate a new session ID
  SESSION_ID = "session_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
  localStorage.setItem("studybot_session", SESSION_ID);

  // Clear messages and show welcome screen again
  location.reload();
}

// ============================================================
// LOAD HISTORY: Restore previous messages on page load
// ============================================================
async function loadChatHistory() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/history/${SESSION_ID}`);
    if (!response.ok) return;

    const data = await response.json();

    if (data.messages && data.messages.length > 0) {
      hideWelcome();
      // Render all historical messages (no typing effect for history)
      data.messages.forEach((msg) => {
        if (msg.role === "system") return; // Skip system prompts
        appendMessage(msg.role === "user" ? "user" : "bot", msg.content);
      });
    }
  } catch (e) {
    // If backend is offline, just show the welcome screen
    console.warn("Could not load history:", e.message);
  }
}

// ============================================================
// SUGGESTION CARDS: Quick-start prompts on welcome screen
// ============================================================
function useSuggestion(text) {
  userInput.value = text;
  userInput.focus();
  charCount.textContent = text.length;
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// Send on button click
sendBtn.addEventListener("click", sendMessage);

// Send on Enter key (Shift+Enter = new line)
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-resize textarea as user types
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 140) + "px";
  charCount.textContent = userInput.value.length;

  // Warn if approaching limit
  if (userInput.value.length > 900) {
    charCount.style.color = "#ef4444";
  } else {
    charCount.style.color = "var(--text-muted)";
  }
});

// ============================================================
// INITIALIZE: Run when the page first loads
// ============================================================
window.addEventListener("load", () => {
  loadChatHistory();
  userInput.focus();
});
