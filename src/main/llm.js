const { ipcMain } = require("electron");

const LLM_CONFIG = {
  baseUrl: "http://192.168.1.67:8080",
  model: "gemma4-4b-64k:latest"
};

const SYSTEM_PROMPT =
  "Sos Boris, un asistente conversacional en español. Respondé de forma clara y concisa.";

const abortControllers = new Map();

function sendToRenderer(event, channel, requestId, extra) {
  if (!event.sender.isDestroyed()) {
    event.sender.send(channel, { requestId, ...extra });
  }
}

function parseSseLine(event, requestId, line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return;

  const data = trimmed.slice(5).trim();
  if (!data) return;

  if (data === "[DONE]") return true;

  try {
    const parsed = JSON.parse(data);

    if (parsed.error) {
      throw new Error(parsed.error.message || "Error del servidor llama.cpp");
    }

    const choice = parsed.choices && parsed.choices[0];
    const content = choice && choice.delta && choice.delta.content;

    if (content) {
      sendToRenderer(event, "boris:chat:chunk", requestId, { content });
    }
  } catch (error) {
    if (error instanceof SyntaxError) return;
    throw error;
  }

  return undefined;
}

async function streamChatCompletion(event, payload) {
  const { requestId, messages } = payload;
  const controller = new AbortController();
  abortControllers.set(requestId, controller);

  try {
    const response = await fetch(`${LLM_CONFIG.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify({
        model: LLM_CONFIG.model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finished = false;

    while (!finished) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let boundary;
      while ((boundary = buffer.indexOf("\n")) !== -1 && !finished) {
        const line = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 1);
        const result = parseSseLine(event, requestId, line);
        if (result === true) finished = true;
      }
    }

    if (!finished) {
      sendToRenderer(event, "boris:chat:done", requestId, {});
    }
  } catch (error) {
    if (error.name === "AbortError") {
      sendToRenderer(event, "boris:chat:done", requestId, {});
    } else {
      sendToRenderer(event, "boris:chat:error", requestId, {
        message: error.message
      });
    }
  } finally {
    abortControllers.delete(requestId);
  }
}

function abortChatCompletion(_event, payload) {
  const controller = abortControllers.get(payload.requestId);
  if (controller) {
    controller.abort();
  }
}

function registerLlmIpc() {
  ipcMain.handle("boris:chat:stream", streamChatCompletion);
  ipcMain.handle("boris:chat:abort", abortChatCompletion);
}

module.exports = { registerLlmIpc, LLM_CONFIG };
