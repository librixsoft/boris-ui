const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("input");
const sendEl = document.getElementById("send");

const chatHistory = [];
let activeStream = null;
let streamTimer = null;
let messageQueue = [];

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

function appendQueuedMessage(text) {
  const wrapper = document.createElement("div");
  wrapper.className = "message user queued";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = `En cola (${messageQueue.length})...`;

  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  scrollToBottom();
}

function updateQueueBadge() {
  if (messageQueue.length > 0) {
    sendEl.title = `${messageQueue.length} mensaje(s) en cola`;
  } else {
    sendEl.title = "";
  }
}

function processQueue() {
  if (activeStream) return;
  if (messageQueue.length === 0) {
    setSending(false);
    updateQueueBadge();
    return;
  }
  const next = messageQueue.shift();
  updateQueueBadge();
  appendMessage("user", next);
  chatHistory.push({ role: "user", content: next });
  inputEl.value = "";
  autoResize();
  inputEl.focus();
  setSending(true);
  streamResponse();
}

function clearQueue() {
  messageQueue = [];
  const queuedMessages = document.querySelectorAll(".message.user.queued");
  queuedMessages.forEach(el => el.remove());
  updateQueueBadge();
  if (!activeStream) {
    setSending(false);
  }
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
      if (!streamingBubble) {
        removeTyping(indicator);
      }
      appendMessage("bot", "Tiempo de espera agotado.");
      activeStream = null;
      processQueue();
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
      processQueue();
    },
    onError(message) {
      clearTimeout(streamTimer);
      streamTimer = null;
      removeTyping(indicator);
      appendMessage("bot", `Error: ${message}`);
      activeStream = null;
      processQueue();
    }
  });
}

function send() {
  const text = inputEl.value.trim();
  if (!text) return;

  if (activeStream) {
    messageQueue.push(text);
    appendQueuedMessage(text);
    updateQueueBadge();
    setSending(true);
    inputEl.value = "";
    autoResize();
    inputEl.focus();
    return;
  }

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
