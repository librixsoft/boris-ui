import { createTaskSessionControl } from "./taskSessionControl.js";
import { marked } from "marked";
import DOMPurify from "dompurify";

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

interface SummaryElement extends HTMLElement {}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatStreamResult {
  stop(): void;
}

interface ChatHandlers {
  onChunk: (content: string) => void;
  onReasoning: (content: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
  onToolCall?: (data: { name: string; args: Record<string, unknown> }) => void;
  onToolResult?: (data: { name: string; result: unknown; success: boolean }) => void;
}

declare global {
  interface Window {
    boris: {
      platform: string;
      chat: {
        stream(messages: Array<{ role: string; content: string }>, handlers: ChatHandlers, sessionId?: string): { stop(): void };
      };
      tools: {
        execute(name: string, params: Record<string, unknown>): Promise<unknown>;
        list(): Promise<unknown>;
      };
      shell: {
        openExternal(url: string): void;
      };
    };
  }
}

const messagesEl = document.getElementById("messages") as MessagesElement;
const inputEl = document.getElementById("input") as InputElement;
const sendEl = document.getElementById("send") as SendElement;
const browserControlOverlay = document.getElementById("browser-control-overlay") as HTMLDivElement;
const browserStopEl = document.getElementById("browser-stop") as HTMLButtonElement;

const chatHistory: ChatMessage[] = [];
let activeStream: ChatStreamResult | null = null;
let streamTimer: ReturnType<typeof setTimeout> | null = null;
let messageQueue: string[] = [];
let chatSessionId: string | null = null;
let browserStopRequested = false;
let activeTyping: HTMLDivElement | null = null;
const taskControl = createTaskSessionControl();

function scrollToBottom(): void {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function mountMessage(wrapper: HTMLElement): void {
  if (activeTyping && activeTyping.isConnected && activeTyping.parentElement === messagesEl) {
    messagesEl.insertBefore(wrapper, activeTyping);
  } else {
    messagesEl.appendChild(wrapper);
  }
}

function appendMessage(role: string, text: string): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  wrapper.appendChild(bubble);
  mountMessage(wrapper);
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
  activeTyping = wrapper;
  scrollToBottom();
  return wrapper;
}

function removeTyping(indicator: HTMLDivElement): void {
  indicator.remove();
  if (activeTyping === indicator) {
    activeTyping = null;
  }
}

interface ParsedError {
  title: string;
  message: string;
  hint: string;
  detail: string;
}

function httpStatusLabel(status: number): string {
  switch (status) {
    case 400: return "Solicitud inválida";
    case 401: return "No autorizado";
    case 403: return "Acceso denegado";
    case 404: return "Recurso no encontrado";
    case 408: return "Tiempo de espera agotado";
    case 413: return "Solicitud demasiado grande";
    case 422: return "Datos no procesables";
    case 429: return "Demasiadas solicitudes";
    case 500: return "Error interno del servidor";
    case 502: return "Respuesta inválida del servidor";
    case 503: return "Servicio no disponible";
    case 504: return "Tiempo de espera del servidor";
    default: return "Error del servidor";
  }
}

function splitErrorHint(text: string): { message: string; hint: string } {
  const match = /^(.*?)\s*[-\u2013\u2014]\s*hint:\s*(.*)$/i.exec(text);
  if (!match) return { message: text.trim(), hint: "" };
  return { message: match[1].trim(), hint: match[2].trim() };
}

function parseErrorPayload(raw: string): ParsedError {
  const trimmed = String(raw ?? "").trim().replace(/^error:\s*/i, "");
  const httpMatch = /^HTTP\s+(\d{3})\s*:\s*([\s\S]*)$/i.exec(trimmed);
  const status = httpMatch ? Number(httpMatch[1]) : null;
  const body = httpMatch ? httpMatch[2].trim() : trimmed;
  let serverMessage = "";
  let serverType = "";

  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      const container = parsed as Record<string, unknown>;
      const errorField = container.error;
      const source = errorField && typeof errorField === "object"
        ? (errorField as Record<string, unknown>)
        : container;
      if (typeof source.message === "string") serverMessage = source.message;
      if (typeof source.type === "string") serverType = source.type;
    }
  } catch {
    serverMessage = body;
  }

  if (!serverMessage) {
    serverMessage = body || "Se produjo un error inesperado.";
  }

  const { message, hint } = splitErrorHint(serverMessage);
  const title = status ? `HTTP ${status} \u00b7 ${httpStatusLabel(status)}` : "Error";
  const detailHeader = serverType ? `${title} (${serverType})` : title;
  const detail = body && body !== message ? `${detailHeader}\n\n${body}` : detailHeader;

  return { title, message, hint, detail };
}

function appendError(rawMessage: string): HTMLDivElement {
  const parsed = parseErrorPayload(rawMessage);

  const wrapper = document.createElement("div");
  wrapper.className = "message bot";

  const bubble = document.createElement("div");
  bubble.className = "bubble bubble--error";
  bubble.setAttribute("role", "alert");

  const header = document.createElement("div");
  header.className = "error-card-header";
  const mark = document.createElement("span");
  mark.className = "error-card-mark";
  mark.textContent = "!";
  mark.setAttribute("aria-hidden", "true");
  const title = document.createElement("span");
  title.className = "error-card-title";
  title.textContent = parsed.title;
  header.appendChild(mark);
  header.appendChild(title);
  bubble.appendChild(header);

  const message = document.createElement("p");
  message.className = "error-card-message";
  message.textContent = parsed.message;
  bubble.appendChild(message);

  if (parsed.hint) {
    const hint = document.createElement("p");
    hint.className = "error-card-hint";
    hint.textContent = parsed.hint;
    bubble.appendChild(hint);
  }

  if (parsed.detail) {
    const details = document.createElement("details");
    details.className = "error-card-detail";
    const summary = document.createElement("summary");
    summary.textContent = "Detalle técnico";
    const pre = document.createElement("pre");
    pre.className = "error-card-detail-content";
    pre.textContent = parsed.detail;
    details.appendChild(summary);
    details.appendChild(pre);
    bubble.appendChild(details);
  }

  wrapper.appendChild(bubble);
  mountMessage(wrapper);
  scrollToBottom();
  return bubble;
}

function autoResize(): void {
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 120)}px`;
}

function setSending(isSending: boolean): void {
  sendEl.disabled = isSending || taskControl.getState().active;
  inputEl.disabled = taskControl.getState().active;
}

function endTaskSession(): void {
  taskControl.release();
  browserControlOverlay.hidden = true;
  sendEl.hidden = false;
  sendEl.disabled = false;
  inputEl.disabled = false;
  browserStopEl.disabled = true;
  browserStopEl.removeAttribute("aria-label");
}

function setTaskControlActive(active: boolean): void {
  if (active) {
    taskControl.activate();
    browserControlOverlay.hidden = false;
    sendEl.hidden = true;
    inputEl.disabled = true;
    browserStopEl.disabled = false;
    browserStopEl.setAttribute("aria-label", "Detener el agente");
  } else {
    endTaskSession();
  }
}

function appendQueuedMessage(text: string): void {
  const wrapper = document.createElement("div");
  wrapper.className = "message user queued";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = `En cola (${messageQueue.length})...`;

  wrapper.appendChild(bubble);
  mountMessage(wrapper);
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
  content.className = "reasoning-content markdown";
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

function appendReasoningInsideBubble(bubble: HTMLDivElement): HTMLDivElement {
  const block = createReasoningBlock();
  bubble.appendChild(block);
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

function formatResult(result: unknown): string {
  return typeof result === "string" ? result : JSON.stringify(result, null, 2);
}

function scrollToBubble(block: HTMLElement | null): void {
  if (!block) return;
  const wrapper = block.closest(".message.bot") as HTMLElement | null;
  if (wrapper) {
    wrapper.scrollIntoView({ block: "end", behavior: "smooth" });
  }
}

function renderBrowserDetailHtml(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const b = result as Record<string, unknown>;
  const parts: string[] = [];

  if (b.error) {
    parts.push(`<div class="browser-detail browser-detail--error"><span class="browser-detail-label">Error:</span> <span class="browser-detail-value">${escapeHtml(String(b.error))}</span></div>`);
  }

  if (b.errorDetail && typeof b.errorDetail === "object") {
    const detail = b.errorDetail as Record<string, unknown>;
    const lines: string[] = [];
    if (detail.operation) lines.push(`Operación: ${String(detail.operation)}`);
    if (detail.url) lines.push(`URL: ${String(detail.url)}`);
    if (detail.cause) lines.push(`Causa: ${String(detail.cause)}`);
    if (detail.stack) lines.push(`Stack:\n${String(detail.stack)}`);
    const content = lines.join("\n") || JSON.stringify(detail, null, 2);
    parts.push(`<details class="browser-error-detail"><summary>Detalle del error</summary><pre class="browser-error-detail-content">${escapeHtml(content)}</pre></details>`);
  }

  if (b.url) {
    parts.push(`<div class="browser-detail"><span class="browser-detail-label">URL:</span> <span class="browser-detail-value">${escapeHtml(String(b.url))}</span></div>`);
  }
  if (b.title) {
    parts.push(`<div class="browser-detail"><span class="browser-detail-label">Título:</span> <span class="browser-detail-value">${escapeHtml(String(b.title))}</span></div>`);
  }
  if (b.selector) {
    parts.push(`<div class="browser-detail"><span class="browser-detail-label">Selector:</span> <span class="browser-detail-value">${escapeHtml(String(b.selector))}</span></div>`);
  }
  if (b.key) {
    parts.push(`<div class="browser-detail"><span class="browser-detail-label">Tecla:</span> <span class="browser-detail-value">${escapeHtml(String(b.key))}</span></div>`);
  }
  if (b.query !== undefined) {
    const found = b.found ? "encontrado" : "no encontrado";
    parts.push(`<div class="browser-detail"><span class="browser-detail-label">Búsqueda "${escapeHtml(String(b.query))}":</span> <span class="browser-detail-value">${found}</span></div>`);
  }
  if (b.text) {
    parts.push(`<pre class="tool-output browser-text">${escapeHtml(String(b.text))}</pre>`);
  }
  if (b.screenshot) {
    parts.push(`<div class="browser-screenshot"><img src="data:image/png;base64,${b.screenshot}" alt="Captura de pantalla del navegador"></div>`);
  }

  return parts.join("");
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderMarkdown(text: string): string {
  const html = marked.parse(text, { breaks: true, async: false });
  return DOMPurify.sanitize(html);
}

interface StreamBotState {
  bubble: HTMLDivElement;
  textEl: HTMLDivElement;
  wrapper: HTMLElement;
}

interface PendingToolRow {
  row: HTMLDetailsElement;
  summary: SummaryElement;
  status: HTMLSpanElement;
  rowBody: HTMLDivElement;
  icon: HTMLSpanElement;
}

function streamResponse(): void {
  const indicator = appendTyping();
  let content = "";
  let reasoning = "";
  let hasReasoning = false;
  let streamBot: StreamBotState | null = null;
  let streamAcc: HTMLDetailsElement | null = null;
  const pendingRows: PendingToolRow[] = [];

  function ensureBotMessage(): StreamBotState {
    if (streamBot) return streamBot;
    const wrapper = document.createElement("div");
    wrapper.className = "message bot";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    const textEl = document.createElement("div");
    textEl.className = "bubble-text markdown";
    bubble.appendChild(textEl);
    wrapper.appendChild(bubble);
    mountMessage(wrapper);
    streamBot = { bubble, textEl, wrapper };
    return streamBot;
  }

  function ensureToolsAccordion(): HTMLDetailsElement {
    if (streamAcc) return streamAcc;
    const wrapper = ensureBotMessage().wrapper;
    const acc = document.createElement("details");
    acc.className = "tools-accordion";
    acc.setAttribute("aria-expanded", "false");
    const header = document.createElement("summary");
    header.className = "tools-accordion-header";
    const title = document.createElement("span");
    title.className = "tools-accordion-title";
    title.textContent = "Herramientas (0)";
    const badge = document.createElement("span");
    badge.className = "tools-accordion-badge";
    badge.hidden = true;
    header.appendChild(title);
    header.appendChild(badge);
    const body = document.createElement("div");
    body.className = "tools-accordion-body";
    acc.appendChild(header);
    acc.appendChild(body);
    acc.addEventListener("toggle", () => {
      acc.setAttribute("aria-expanded", String(acc.open));
    });
    wrapper.appendChild(acc);
    streamAcc = acc;
    return acc;
  }

  function updateAccordionHeader(): void {
    if (!streamAcc) return;
    const title = streamAcc.querySelector(".tools-accordion-title") as HTMLSpanElement;
    const badge = streamAcc.querySelector(".tools-accordion-badge") as HTMLSpanElement;
    const count = streamAcc.querySelectorAll(".tool-row").length;
    title.textContent = `Herramientas (${count})`;
    badge.hidden = pendingRows.length === 0;
    badge.classList.toggle("tools-accordion-badge--running", pendingRows.length > 0);
  }

  function renderToolCall(name: string, args: Record<string, unknown>): void {
    const acc = ensureToolsAccordion();
    const row = document.createElement("details");
    row.className = "tool-row";

    const summary = document.createElement("summary");
    summary.className = "tool-row-summary";

    const icon = document.createElement("span");
    icon.className = "tool-icon tool-icon--running";
    icon.textContent = "⏳";

    const label = document.createElement("span");
    label.className = "tool-row-name";
    label.textContent = name;

    const status = document.createElement("span");
    status.className = "tool-row-status";
    status.textContent = "Ejecutando…";

    summary.appendChild(icon);
    summary.appendChild(label);
    summary.appendChild(status);

    const rowBody = document.createElement("div");
    rowBody.className = "tool-row-body";
    const paramsEl = document.createElement("pre");
    paramsEl.className = "tool-params";
    paramsEl.textContent = formatArgs(args);
    rowBody.appendChild(paramsEl);

    row.appendChild(summary);
    row.appendChild(rowBody);
    acc.querySelector(".tools-accordion-body")!.appendChild(row);
    pendingRows.push({ row, summary, status, rowBody, icon });
    updateAccordionHeader();
  }

  function onToolResult(data: { name: string; result: unknown; success: boolean }): void {
    const pending = pendingRows.shift();
    if (!pending) return;
    const output = document.createElement("pre");
    output.className = `tool-output tool-output--${data.success ? "success" : "error"}`;

    if (data.name === "browser") {
      output.innerHTML = renderBrowserDetailHtml(data.result);
    } else {
      output.textContent = formatResult(data.result);
    }

    pending.rowBody.appendChild(output);
    pending.status.textContent = data.success ? "Completado" : "Error";
    pending.status.className = data.success
      ? "tool-row-status tool-row-status--success"
      : "tool-row-status tool-row-status--error";
    pending.icon.className = data.success
      ? "tool-icon tool-icon--success"
      : "tool-icon tool-icon--error";
    pending.icon.textContent = data.success ? "✓" : "✗";
    updateAccordionHeader();
    if (streamAcc && streamAcc.open) {
      const body = streamAcc.querySelector(".tools-accordion-body") as HTMLElement;
      body.scrollTop = body.scrollHeight;
    }
  }

  if (streamTimer) {
    clearTimeout(streamTimer);
    streamTimer = null;
  }

  streamTimer = setTimeout(() => {
    console.error("[streamResponse] timeout fired");
    if (activeStream) {
      activeStream.stop();
      endTaskSession();
      if (!streamBot || !streamBot.textEl.textContent) {
        removeTyping(indicator);
      }
      appendMessage("bot", "Tiempo de espera agotado.");
      activeStream = null;
      processQueue();
    }
  }, 900000);

  if (!chatSessionId) {
    chatSessionId = crypto.randomUUID();
  }

  try {
    console.log("[streamResponse] calling window.boris.chat.stream");
    activeStream = window.boris.chat.stream(chatHistory, {
      onChunk(chunk: string) {
        content += chunk;
        removeTyping(indicator);
        const { textEl } = ensureBotMessage();
        textEl.innerHTML = renderMarkdown(content);
        scrollToBottom();
      },
      onReasoning(chunk: string) {
        hasReasoning = true;
        reasoning += chunk;
        const { bubble } = ensureBotMessage();
        let block = bubble.querySelector(".reasoning-block") as HTMLDivElement;
        if (!block) {
          block = appendReasoningInsideBubble(bubble);
        }
        const reasoningContent = block.querySelector(".reasoning-content") as HTMLElement;
        if (reasoningContent) {
          reasoningContent.innerHTML = renderMarkdown(reasoning);
          scrollToBubble(block);
        }
      },
      onToolCall(data) {
        renderToolCall(data.name, data.args);
      },
      onToolResult(data) {
        onToolResult(data);
      },
    onDone() {
      console.log("[streamResponse] onDone called");
      if (streamTimer) {
        clearTimeout(streamTimer);
        streamTimer = null;
      }
      endTaskSession();
        const wasBrowserStopRequested = browserStopRequested;
        if (wasBrowserStopRequested) {
          removeTyping(indicator);
          appendMessage("bot", "Ejecución detenida por el usuario.");
          browserStopRequested = false;
        } else if (!streamBot || !streamBot.textEl.textContent) {
          removeTyping(indicator);
          appendMessage("bot", "Sin respuesta del modelo.");
        }
        if (!wasBrowserStopRequested) {
          chatHistory.push({ role: "assistant", content });
        }
        activeStream = null;
        processQueue();
      },
    onError(message: string) {
      console.error("[streamResponse] onError:", message);
      if (streamTimer) {
          clearTimeout(streamTimer);
          streamTimer = null;
        }
        endTaskSession();
        removeTyping(indicator);
        appendError(message);
        activeStream = null;
        processQueue();
      }
    }, chatSessionId || undefined);
    setTaskControlActive(true);
  } catch (error) {
    console.error("[streamResponse] error:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido al iniciar stream";
    removeTyping(indicator);
    appendError(errorMessage);
    activeStream = null;
    setTaskControlActive(false);
    processQueue();
  }
}

function markBrowserStopRequested(): void {
  if (browserStopRequested) return;
  browserStopRequested = true;
  browserStopEl.disabled = true;
  browserStopEl.setAttribute("aria-label", "Deteniendo...");
  clearQueue();
}

browserStopEl.addEventListener("click", () => {
  if (!activeStream || browserStopEl.disabled) return;
  markBrowserStopRequested();
  activeStream.stop();
  endTaskSession();
});

function send(): void {
  console.log("[send] called, taskActive:", taskControl.getState().active, "activeStream:", !!activeStream, "inputValue:", JSON.stringify(inputEl.value));
  if (taskControl.getState().active) {
    console.log("[send] blocked: task is active");
    return;
  }
  const text = inputEl.value.trim();
  if (!text) {
    console.log("[send] blocked: empty input");
    return;
  }

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

messagesEl.addEventListener("click", (e: MouseEvent) => {
  const target = e.target as Element;
  const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
  if (!anchor) return;
  const href = anchor.getAttribute("href");
  if (!href) return;
  e.preventDefault();
  window.boris.shell.openExternal(href);
});

export { httpStatusLabel, splitErrorHint, parseErrorPayload, formatArgs, formatResult, renderBrowserDetailHtml };
