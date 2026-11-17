import { ipcMain, IpcMainInvokeEvent } from "electron";
import { listTools, executeTool, Tool } from "./tools/registry";
import { execute as executeLogSession } from "./tools/logSession";

export interface LLMConfig {
  baseUrl: string;
  model: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatPayload {
  requestId: string;
  messages: ChatMessage[];
}

export interface SSEError {
  error: {
    message: string;
  };
}

export interface SSEChoice {
  delta: {
    content?: string;
    reasoning_content?: string;
  };
}

export interface SSEResponse {
  choices?: SSEChoice[];
  error?: {
    message: string;
  };
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface StreamHandlers {
  onChunk: (content: string) => void;
  onReasoning: (content: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

export interface ChatStreamResult {
  stop(): void;
}

const LLM_CONFIG: LLMConfig = {
  baseUrl: "http://192.168.1.67:8080",
  model: "gemma-4b-64k:latest"
};

const abortControllers = new Map<string, AbortController>();

function buildSystemPrompt(tools: Tool[]): string {
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

function sendToRenderer(event: IpcMainInvokeEvent, channel: string, requestId: string, extra: Record<string, unknown>): void {
  if (!event.sender.isDestroyed()) {
    event.sender.send(channel, { requestId, ...extra });
  }
}

function parseSseLine(line: string): { type: "done" | "error" | "content" | "reasoning"; content?: string; message?: string } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;

  const data = trimmed.slice(5).trim();
  if (!data) return null;

  if (data === "[DONE]") return { type: "done" };

  try {
    const parsed = JSON.parse(data) as SSEResponse;

    if (parsed.error) {
      return { type: "error", message: parsed.error.message || "Error del servidor llama.cpp" };
    }

    const choice = parsed.choices && parsed.choices[0];
    if (!choice || !choice.delta) return null;

    const reasoning = choice.delta.reasoning_content;
    if (reasoning) {
      return { type: "reasoning", content: reasoning };
    }

    const content = choice.delta.content;
    if (content) {
      return { type: "content", content };
    }
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }

  return null;
}

function collectToolCalls(rawBuffer: string): ToolCall[] {
  const toolRegex = /<tool\s+name="([^"]+)">([\s\S]*?)<\/tool>/g;
  const toolCalls: ToolCall[] = [];
  let match: RegExpExecArray | null;

  while ((match = toolRegex.exec(rawBuffer)) !== null) {
    toolCalls.push({
      name: match[1],
      args: JSON.parse(match[2]) as Record<string, unknown>
    });
  }

  return toolCalls;
}

function extractCleanText(rawBuffer: string): string {
  return rawBuffer.replace(/<tool\s+name="[^"]*">[\s\S]*?<\/tool>/g, "").trim();
}

const THINKING_TAG_REGEX = /<\/?thinking\s*\/?>|<\/?reasoning\s*\/?>/gi;

function extractReasoningFromTags(rawBuffer: string): { reasoning: string; content: string } {
  const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>([\s\S]*)/i;
  const match = thinkingRegex.exec(rawBuffer);
  if (match) {
    const reasoning = match[1].replace(/<\/?thinking\s*\/?>/gi, "").trim();
    const content = match[2].replace(THINKING_TAG_REGEX, "").trim();
    return { reasoning, content };
  }

  const reasoningOnlyRegex = /<thinking>([\s\S]*?)<\/thinking>/i;
  const reasoningMatch = reasoningOnlyRegex.exec(rawBuffer);
  if (reasoningMatch) {
    const reasoning = reasoningMatch[1].replace(/<\/?thinking\s*\/?>/gi, "").trim();
    return { reasoning, content: "" };
  }

  return { reasoning: "", content: rawBuffer };
}

async function streamChatCompletion(event: IpcMainInvokeEvent, payload: ChatPayload): Promise<void> {
  const { requestId, messages } = payload;
  const controller = new AbortController();
  abortControllers.set(requestId, controller);

  const sessionId = "session-" + new Date().toISOString().replace(/[^0-9]/g, "-") + "Z";
  await executeLogSession({ action: "init", sessionId, prompt: messages[messages.length - 1]?.content?.slice(0, 200) || "" });

  await executeLogSession({
    action: "append",
    sessionId,
    entry: {
      type: "conversation",
      role: "user",
      content: messages[messages.length - 1]?.content || ""
    }
  });

  const tools = listTools();
  const systemPrompt = buildSystemPrompt(tools);
  let currentMessages: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...messages];

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

      let assistantContentBuffer = "";
      let hasLoggedAssistantContent = false;

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let rawBuffer = "";
      let reasoningBuffer = "";
      let finished = false;
      let rawOffset = 0;
      let pendingCalls: ToolCall[] = [];
      let hasReasoning = false;
      let lastLoggedContent = "";

      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let boundary: number;
        while ((boundary = buffer.indexOf("\n")) !== -1 && !finished) {
          const line = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 1);

          const result = parseSseLine(line);
          if (!result) continue;

          if (result.type === "done") {
            finished = true;
          } else if (result.type === "error") {
            throw new Error(result.message!);
          } else if (result.type === "reasoning") {
            hasReasoning = true;
            reasoningBuffer += result.content!;
            sendToRenderer(event, "boris:chat:reasoning", requestId, { content: result.content! });
            } else if (result.type === "content") {
            rawBuffer += result.content!;
            assistantContentBuffer += result.content!;

            if (hasReasoning) {
              const extracted = extractReasoningFromTags(rawBuffer);
              if (extracted.reasoning) {
                reasoningBuffer += extracted.reasoning;
                sendToRenderer(event, "boris:chat:reasoning", requestId, { content: extracted.reasoning });

                await executeLogSession({
                  action: "append",
                  sessionId,
                  entry: {
                    type: "reasoning",
                    content: extracted.reasoning
                  }
                });
              }
              const cleanContent = extracted.content.replace(/<tool\s+name="[^"]*">[\s\S]*?<\/tool>/g, "").trim();
              let contentDelta = cleanContent;
              if (lastLoggedContent && cleanContent.startsWith(lastLoggedContent)) {
                contentDelta = cleanContent.slice(lastLoggedContent.length);
              }
              lastLoggedContent = cleanContent;
              if (contentDelta) {
                sendToRenderer(event, "boris:chat:chunk", requestId, { content: contentDelta });
              }
            } else {
              const newRaw = rawBuffer.slice(rawOffset);
              const cleanText = extractCleanText(newRaw);
              rawOffset = rawBuffer.length;

              let delta = cleanText;
              if (lastLoggedContent && cleanText.startsWith(lastLoggedContent)) {
                delta = cleanText.slice(lastLoggedContent.length);
              }
              lastLoggedContent = cleanText;

              if (delta) {
                sendToRenderer(event, "boris:chat:chunk", requestId, { content: delta });
              }
            }
          }
        }
      }

      const finalCalls = collectToolCalls(rawBuffer);
      pendingCalls.push(...finalCalls);

      if (pendingCalls.length > 0) {
        for (const call of pendingCalls) {
          sendToRenderer(event, "boris:chat:tool-call", requestId, { name: call.name, args: call.args });

          sendToRenderer(event, "boris:chat:chunk", requestId, {
            content: `[Ejecutando ${call.name}...]`
          });

          const toolStart = Date.now();
          let result: { success: boolean; path?: string; error?: string };
          let toolError: Error | null = null;

          try {
            result = await executeTool(call.name, call.args);
          } catch (execError) {
            toolError = execError instanceof Error ? execError : new Error(String(execError));
            result = { success: false, error: toolError.message };
          }

          const toolDuration = Date.now() - toolStart;

          await executeLogSession({
            action: "append",
            sessionId,
            entry: {
              type: "Tool Call",
              name: call.name,
              input: call.args,
              output: result.success ? { success: true, path: result.path } : { success: false, error: result.error },
              duration: toolDuration,
              status: result.success ? "success" : "error"
            }
          });

          const success = result.success !== false;
          let toolResultPayload: Record<string, unknown> = success ? { path: result.path } : { error: result.error };
          let enrichmentChunk = "";

          if (call.name === "browser" && success) {
            const browserResult = result as { url?: string; selector?: string; value?: string; text?: string; screenshot?: string; title?: string; key?: string; query?: string; found?: boolean };
            if (browserResult.url) {
              enrichmentChunk += `URL: ${browserResult.url}\n`;
            }
            if (browserResult.title) {
              enrichmentChunk += `Título: ${browserResult.title}\n`;
            }
            if (browserResult.selector) {
              enrichmentChunk += `Selector: ${browserResult.selector}\n`;
            }
            if (browserResult.key) {
              enrichmentChunk += `Tecla: ${browserResult.key}\n`;
            }
            if (browserResult.query !== undefined) {
              enrichmentChunk += `Búsqueda "${browserResult.query}": ${browserResult.found ? "encontrado" : "no encontrado"}\n`;
            }
            if (browserResult.text && browserResult.text.length > 0) {
              const truncated = browserResult.text.length > 2000 ? browserResult.text.slice(0, 2000) + "..." : browserResult.text;
              enrichmentChunk += `Texto: ${truncated}\n`;
            }
            toolResultPayload = {
              ...browserResult,
              text: browserResult.text && browserResult.text.length > 2000 ? browserResult.text.slice(0, 2000) + "..." : browserResult.text
            };
          }

          sendToRenderer(event, "boris:chat:tool-result", requestId, {
            name: call.name,
            result: toolResultPayload,
            success
          });

          const chunkContent = enrichmentChunk ? `[Resultado ${call.name}]:\n${enrichmentChunk}` : `[Resultado ${call.name}]: ${result.success ? "OK" : result.error}`;
          sendToRenderer(event, "boris:chat:chunk", requestId, {
            content: chunkContent
          });

          currentMessages.push({
            role: "user",
            content: `Resultado de ${call.name}: ${JSON.stringify(result)}`
          });
        }

        const streamedContent = assistantContentBuffer.replace(/<tool\s+name="[^"]*">[\s\S]*?<\/tool>/g, "").trim();
        if (streamedContent && !hasLoggedAssistantContent) {
          await executeLogSession({
            action: "append",
            sessionId,
            entry: {
              type: "conversation",
              role: "assistant",
              content: streamedContent
            }
          });
          hasLoggedAssistantContent = true;
        }

        assistantContentBuffer = "";
        continue;
      }

      if (assistantContentBuffer.trim() && !hasLoggedAssistantContent) {
        const cleanContent = assistantContentBuffer.replace(/<tool\s+name="[^"]*">[\s\S]*?<\/tool>/g, "").trim();
        if (cleanContent) {
          await executeLogSession({
            action: "append",
            sessionId,
            entry: {
              type: "conversation",
              role: "assistant",
              content: cleanContent
            }
          });
        }
      }

      sendToRenderer(event, "boris:chat:done", requestId, {});
      break;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      sendToRenderer(event, "boris:chat:done", requestId, {});
    } else {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";

      await executeLogSession({
        action: "append",
        sessionId,
        entry: {
          type: "error",
          content: errorMessage
        }
      });

      sendToRenderer(event, "boris:chat:error", requestId, {
        message: errorMessage
      });
      sendToRenderer(event, "boris:chat:done", requestId, {});
    }
  } finally {
    await executeLogSession({ action: "close", sessionId });
    abortControllers.delete(requestId);
  }
}

function abortChatCompletion(_event: IpcMainInvokeEvent, payload: { requestId: string }): void {
  const controller = abortControllers.get(payload.requestId);
  if (controller) {
    controller.abort();
  }
}

export function registerLlmIpc(): void {
  ipcMain.handle("boris:chat:stream", streamChatCompletion);
  ipcMain.handle("boris:chat:abort", abortChatCompletion);
}

export { LLM_CONFIG };
