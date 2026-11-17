const { ipcMain } = require("electron");
const { listTools, executeTool } = require("./tools/registry");

const LLM_CONFIG = {
  baseUrl: "http://192.168.1.67:8080",
  model: "gemma4-4b-64k:latest"
};

function buildSystemPrompt(tools) {
  const toolInstructions = tools
    .map(
      (t) =>
        `Herramienta: ${t.name}
Descripción: ${t.description}
Schema JSON: ${JSON.stringify(t.schema, null, 2)}
`
    )
    .join("\n");

  return `Sos Boris, un asistente conversacional en español. Respondé de forma clara y concisa.

Cuando necesites realizar una operación en el sistema de archivos, emití un bloque <tool> con el nombre de la herramienta y los parámetros JSON. Ejemplo:
<tool name="createFile">{ "path": "notas.txt", "content": "Hola" }</tool>

Esperá el resultado antes de continuar. Podés encadenar múltiples tool calls.

Herramientas disponibles:
${toolInstructions}

Después de ejecutar herramientas, confirmá al usuario lo que se hizo.`;
}

const abortControllers = new Map();

function sendToRenderer(event, channel, requestId, extra) {
  if (!event.sender.isDestroyed()) {
    event.sender.send(channel, { requestId, ...extra });
  }
}

function parseSseLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;

  const data = trimmed.slice(5).trim();
  if (!data) return null;

  if (data === "[DONE]") return { type: "done" };

  try {
    const parsed = JSON.parse(data);

    if (parsed.error) {
      return { type: "error", message: parsed.error.message || "Error del servidor llama.cpp" };
    }

    const choice = parsed.choices && parsed.choices[0];
    const content = choice && choice.delta && choice.delta.content;

    if (content) {
      return { type: "content", content };
    }
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }

  return null;
}

function collectToolCalls(rawBuffer) {
  const toolRegex = /<tool\s+name="([^"]+)">([\s\S]*?)<\/tool>/g;
  const toolCalls = [];
  let match;

  while ((match = toolRegex.exec(rawBuffer)) !== null) {
    toolCalls.push({
      name: match[1],
      args: JSON.parse(match[2])
    });
  }

  return toolCalls;
}

function extractCleanText(rawBuffer) {
  return rawBuffer.replace(/<tool\s+name="[^"]*">[\s\S]*?<\/tool>/g, "").trim();
}

async function streamChatCompletion(event, payload) {
  const { requestId, messages } = payload;
  const controller = new AbortController();
  abortControllers.set(requestId, controller);

  const tools = listTools();
  const systemPrompt = buildSystemPrompt(tools);
  let currentMessages = [{ role: "system", content: systemPrompt }, ...messages];

  try {
    while (true) {
      const response = await fetch(`${LLM_CONFIG.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream"
        },
        body: JSON.stringify({
          model: LLM_CONFIG.model,
          messages: currentMessages,
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
      let rawBuffer = "";
      let finished = false;
      let displayOffset = 0;
      let pendingCalls = [];

      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let boundary;
        while ((boundary = buffer.indexOf("\n")) !== -1 && !finished) {
          const line = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 1);

          const result = parseSseLine(line);
          if (!result) continue;

          if (result.type === "done") {
            finished = true;
          } else if (result.type === "error") {
            throw new Error(result.message);
          } else if (result.type === "content") {
            rawBuffer += result.content;
            const cleanText = extractCleanText(rawBuffer.slice(displayOffset));
            displayOffset = rawBuffer.length - cleanText.length;

            if (cleanText) {
              sendToRenderer(event, "boris:chat:chunk", requestId, { content: cleanText });
            }

            const newCalls = collectToolCalls(rawBuffer.slice(displayOffset));
            pendingCalls.push(...newCalls);
          }
        }
      }

      if (pendingCalls.length > 0) {
        for (const call of pendingCalls) {
          sendToRenderer(event, "boris:chat:chunk", requestId, {
            content: `[Ejecutando ${call.name}...]`
          });

          const result = await executeTool(call.name, call.args);

          sendToRenderer(event, "boris:chat:chunk", requestId, {
            content: `[Resultado ${call.name}]: ${result.success ? "OK" : result.error}`
          });

          currentMessages.push({
            role: "user",
            content: `Resultado de ${call.name}: ${JSON.stringify(result)}`
          });
        }

        continue;
      }

      sendToRenderer(event, "boris:chat:done", requestId, {});
      break;
    }
  } catch (error) {
    if (error.name === "AbortError") {
      sendToRenderer(event, "boris:chat:done", requestId, {});
    } else {
      sendToRenderer(event, "boris:chat:error", requestId, {
        message: error.message
      });
      sendToRenderer(event, "boris:chat:done", requestId, {});
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
