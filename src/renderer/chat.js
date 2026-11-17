const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("input");
const sendEl = document.getElementById("send");

const chatHistory = [];
let activeStream = null;
let streamTimer = null;

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendMessage(role, text) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  scrollToBottom();
  return bubble;
}

function appendTyping() {
  const wrapper = document.createElement("div");
  wrapper.className = "message bot typing-indicator";

  const indicator = document.createElement("div");
  indicator.className = "bubble typing";
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("span");
    indicator.appendChild(dot);
  }

  wrapper.appendChild(indicator);
  messagesEl.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function removeTyping(indicator) {
  indicator.remove();
}

function autoResize() {
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 120)}px`;
}

function setSending(isSending) {
  sendEl.disabled = isSending;
}

function streamResponse() {
  const indicator = appendTyping();
  let streamingBubble = null;
  let content = "";

  if (streamTimer) {
    clearTimeout(streamTimer);
    streamTimer = null;
  }

  streamTimer = setTimeout(() => {
    if (activeStream) {
      activeStream.stop();
      setSending(false);
      inputEl.focus();
      if (!streamingBubble) {
        removeTyping(indicator);
      }
      appendMessage("bot", "Tiempo de espera agotado.");
      activeStream = null;
    }
  }, 30000);

  activeStream = window.boris.chat.stream(chatHistory, {
    onChunk(chunk) {
      content += chunk;
      if (!streamingBubble) {
        removeTyping(indicator);
        streamingBubble = appendMessage("bot", content);
      } else {
        streamingBubble.textContent = content;
        scrollToBottom();
      }
    },
    onDone() {
      clearTimeout(streamTimer);
      streamTimer = null;
      if (!streamingBubble) {
        removeTyping(indicator);
        streamingBubble = appendMessage("bot", "Sin respuesta del modelo.");
      }
      chatHistory.push({ role: "assistant", content });
      activeStream = null;
      setSending(false);
      inputEl.focus();
    },
    onError(message) {
      clearTimeout(streamTimer);
      streamTimer = null;
      removeTyping(indicator);
      appendMessage("bot", `Error: ${message}`);
      activeStream = null;
      setSending(false);
      inputEl.focus();
    }
  });
}

function send() {
  const text = inputEl.value.trim();
  if (!text || activeStream) return;

  appendMessage("user", text);
  chatHistory.push({ role: "user", content: text });
  inputEl.value = "";
  autoResize();
  inputEl.focus();

  setSending(true);
  streamResponse();
}

sendEl.addEventListener("click", send);

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

inputEl.addEventListener("input", autoResize);
