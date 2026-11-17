interface MessagesElement extends HTMLElement {
  scrollTop: number;
  scrollHeight: number;
}

interface InputElement extends HTMLTextAreaElement {
  scrollHeight: number;
}

interface SendElement extends HTMLButtonElement {
  title: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatStreamResult {
  stop(): void;
}

interface WindowBorisChat {
  stream(messages: ChatMessage[], handlers: {
    onChunk: (content: string) => void;
    onReasoning: (content: string) => void;
    onDone: () => void;
    onError: (message: string) => void;
    onToolCall?: (data: { name: string; args: Record<string, unknown> }) => void;
    onToolResult?: (data: { name: string; result: unknown; success: boolean }) => void;
  }): ChatStreamResult;
}

interface WindowBoris {
  chat: WindowBorisChat;
}

interface Window {
  boris: WindowBoris;
}

const messagesEl = document.getElementById("messages") as MessagesElement;
const inputEl = document.getElementById("input") as InputElement;
const sendEl = document.getElementById("send") as SendElement;

const chatHistory: ChatMessage[] = [];
let activeStream: ChatStreamResult | null = null;
let streamTimer: ReturnType<typeof setTimeout> | null = null;
let messageQueue: string[] = [];
let currentReasoningBlock: HTMLDivElement | null = null;
let hasReasoning = false;
let pendingToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

function scrollToBottom(): void {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendMessage(role: string, text: string): HTMLDivElement {
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

function appendTyping(): HTMLDivElement {
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
  return indicator as unknown as HTMLDivElement;
}

function removeTyping(indicator: HTMLDivElement): void {
  indicator.remove();
}

function autoResize(): void {
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 120)}px`;
}

function setSending(isSending: boolean): void {
  sendEl.disabled = isSending;
}

function appendQueuedMessage(text: string): void {
  const wrapper = document.createElement("div");
  wrapper.className = "message user queued";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = `En cola (${messageQueue.length})...`;

  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  scrollToBottom();
}

function updateQueueBadge(): void {
  if (messageQueue.length > 0) {
    sendEl.title = `${messageQueue.length} mensaje(s) en cola`;
  } else {
    sendEl.title = "";
  }
}

function processQueue(): void {
  if (activeStream) return;
  if (messageQueue.length === 0) {
    setSending(false);
    updateQueueBadge();
    return;
  }
  const next = messageQueue.shift();
  updateQueueBadge();
  appendMessage("user", next!);
  chatHistory.push({ role: "user", content: next! });
  inputEl.value = "";
  autoResize();
  inputEl.focus();
  setSending(true);
  streamResponse();
}

function clearQueue(): void {
  messageQueue = [];
  const queuedMessages = document.querySelectorAll(".message.user.queued");
  queuedMessages.forEach(el => el.remove());
  updateQueueBadge();
  if (!activeStream) {
    setSending(false);
  }
}

function createReasoningBlock(): HTMLDivElement {
  const block = document.createElement("div");
  block.className = "reasoning-block";

  const label = document.createElement("div");
  label.className = "reasoning-label";
  label.textContent = "Razonamiento";
  block.appendChild(label);

  const content = document.createElement("div");
  content.className = "reasoning-content";
  block.appendChild(content);

  const toggle = document.createElement("button");
  toggle.className = "reasoning-toggle";
  toggle.textContent = "Ocultar";
  toggle.addEventListener("click", () => {
    const isCollapsed = block.classList.toggle("collapsed");
    toggle.textContent = isCollapsed ? "Mostrar razonamiento" : "Ocultar";
  });
  block.appendChild(toggle);

  return block;
}

function appendReasoningToBotMessage(): HTMLDivElement {
  const botMessages = document.querySelectorAll(".message.bot");
  let target: HTMLElement;

  if (botMessages.length > 0) {
    target = botMessages[botMessages.length - 1] as HTMLElement;
  } else {
    const wrapper = document.createElement("div");
    wrapper.className = "message bot";
    messagesEl.appendChild(wrapper);
    target = wrapper;
  }

  const block = createReasoningBlock();
  target.insertBefore(block, target.querySelector(".bubble") || null);
  scrollToBottom();
  return block;
}

function formatArgs(args: Record<string, unknown>): string {
  const formatted: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    const displayValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    formatted.push(`${key}: ${displayValue}`);
  }
  return formatted.join("\n");
}

function renderToolCall(name: string, args: Record<string, unknown>): void {
  const wrapper = document.createElement("div");
  wrapper.className = "tool-call";

  const icon = document.createElement("span");
  icon.className = "tool-icon tool-icon--running";
  icon.textContent = "⏳";

  const info = document.createElement("div");
  info.className = "tool-info";

  const nameEl = document.createElement("div");
  nameEl.className = "tool-name";
  nameEl.textContent = name;

  const statusEl = document.createElement("div");
  statusEl.className = "tool-status";
  statusEl.textContent = "Ejecutando...";

  info.appendChild(nameEl);
  info.appendChild(statusEl);

  if (Object.keys(args).length > 0) {
    const paramsEl = document.createElement("pre");
    paramsEl.className = "tool-params";
    paramsEl.textContent = formatArgs(args);
    info.appendChild(paramsEl);
  }

  wrapper.appendChild(icon);
  wrapper.appendChild(info);
  messagesEl.appendChild(wrapper);
  scrollToBottom();
}

function renderToolResult(name: string, result: unknown, success: boolean): void {
  const wrapper = document.createElement("div");
  wrapper.className = `tool-result tool-result--${success ? "success" : "error"}`;

  const icon = document.createElement("span");
  icon.className = `tool-icon tool-icon--${success ? "success" : "error"}`;
  icon.textContent = success ? "✓" : "✗";

  const info = document.createElement("div");
  info.className = "tool-info";

  const nameEl = document.createElement("div");
  nameEl.className = "tool-name";
  nameEl.textContent = name;

  const statusEl = document.createElement("div");
  statusEl.className = `tool-status tool-status--${success ? "success" : "error"}`;
  statusEl.textContent = success ? "Completado" : "Error";

  info.appendChild(nameEl);
  info.appendChild(statusEl);

  if (result) {
    const outputEl = document.createElement("pre");
    outputEl.className = "tool-output";
    outputEl.textContent = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    info.appendChild(outputEl);
  }

  wrapper.appendChild(icon);
  wrapper.appendChild(info);
  messagesEl.appendChild(wrapper);
  scrollToBottom();
}

function streamResponse(): void {
  const indicator = appendTyping();
  let streamingBubble: HTMLDivElement | null = null;
  let content = "";
  hasReasoning = false;
  currentReasoningBlock = null;
  pendingToolCalls = [];

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
  }, 900000);

  activeStream = window.boris.chat.stream(chatHistory, {
    onChunk(chunk: string) {
      content += chunk;
      if (!streamingBubble) {
        removeTyping(indicator);
        streamingBubble = appendMessage("bot", content);
      } else {
        streamingBubble.textContent = content;
        scrollToBottom();
      }
    },
    onReasoning(chunk: string) {
      hasReasoning = true;
      if (!currentReasoningBlock) {
        currentReasoningBlock = appendReasoningToBotMessage();
      }
      const reasoningContent = currentReasoningBlock.querySelector(".reasoning-content") as HTMLElement;
      if (reasoningContent) {
        reasoningContent.textContent += chunk;
        scrollToBottom();
      }
    },
    onToolCall(data) {
      pendingToolCalls.push(data);
      renderToolCall(data.name, data.args);
    },
    onToolResult(data) {
      renderToolResult(data.name, data.result, data.success);
    },
    onDone() {
      if (streamTimer) {
        clearTimeout(streamTimer);
        streamTimer = null;
      }
      if (!streamingBubble) {
        removeTyping(indicator);
        streamingBubble = appendMessage("bot", "Sin respuesta del modelo.");
      }
      chatHistory.push({ role: "assistant", content });
      activeStream = null;
      processQueue();
    },
    onError(message: string) {
      if (streamTimer) {
        clearTimeout(streamTimer);
        streamTimer = null;
      }
      removeTyping(indicator);
      appendMessage("bot", `Error: ${message}`);
      activeStream = null;
      processQueue();
    }
  });
}

function send(): void {
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

inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

inputEl.addEventListener("input", autoResize);
