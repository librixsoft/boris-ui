const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("input");
const sendEl = document.getElementById("send");

const CANNED_RESPONSES = [
  "Interesante, contame mas sobre eso.",
  "Entiendo. Como puedo ayudarte con eso?",
  "Buena pregunta. Que esperabas que pasara?",
  "Anotado. Hay algo mas en lo que pueda ayudarte?",
  "Ya veo. Puedo darte mas detalles si queres.",
  "Perfecto, revisemos el problema juntos."
];

let lastResponseIndex = -1;

function simulateResponse() {
  let index = Math.floor(Math.random() * CANNED_RESPONSES.length);
  if (index === lastResponseIndex) {
    index = (index + 1) % CANNED_RESPONSES.length;
  }
  lastResponseIndex = index;
  return CANNED_RESPONSES[index];
}

function appendMessage(role, text) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
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
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrapper;
}

function removeTyping(indicator) {
  indicator.remove();
}

function autoResize() {
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 120)}px`;
}

function send() {
  const text = inputEl.value.trim();
  if (!text) return;

  appendMessage("user", text);
  inputEl.value = "";
  autoResize();
  inputEl.focus();

  const indicator = appendTyping();
  const delay = 1000 + Math.floor(Math.random() * 1500);

  setTimeout(() => {
    removeTyping(indicator);
    appendMessage("bot", simulateResponse());
  }, delay);
}

sendEl.addEventListener("click", send);

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

inputEl.addEventListener("input", autoResize);
