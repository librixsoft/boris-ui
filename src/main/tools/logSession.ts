import * as fs from "fs";
import * as path from "path";
import { Tool } from "./registry";

const LOGS_ROOT = path.join(process.env.HOME || "/Users/lastprophet", ".boris", "logs");

interface LogEntry {
  type: string; // "tool" | "conversation" | "reasoning" | "error"
  name?: string;
  role?: "user" | "assistant";
  content?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  duration?: number;
  status?: string;
}

interface SessionData {
  id: string;
  sessionId: string;
  startTime: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  prompt?: string;
  model?: string;
  toolCalls: number;
  tool_calls?: number;
  errors: number;
}

let currentSession: SessionData | null = null;

function ensureLogsDir(): void {
  fs.mkdirSync(LOGS_ROOT, { recursive: true });
}

function getIndexFilePath(): string {
  return path.join(LOGS_ROOT, "index.json");
}

function readIndex(): { sessions: Record<string, unknown>[] } {
  const indexFile = getIndexFilePath();
  if (fs.existsSync(indexFile)) {
    return JSON.parse(fs.readFileSync(indexFile, "utf-8")) as { sessions: Record<string, unknown>[] };
  }
  return { sessions: [] };
}

function writeIndex(sessions: Record<string, unknown>[]): void {
  ensureLogsDir();
  fs.writeFileSync(getIndexFilePath(), JSON.stringify({ sessions }, null, 2), "utf-8");
}

function updateIndex(sessionId: string, updates: Record<string, unknown>): void {
  const index = readIndex();
  const existing = index.sessions.find((s) => s.id === sessionId || s.sessionId === sessionId);
  if (existing) {
    Object.assign(existing, updates);
  } else {
    index.sessions.push({ id: sessionId, sessionId, toolCalls: 0, errors: 0, ...updates } as Record<string, unknown>);
  }
  writeIndex(index.sessions);
}

function truncateOutput(output: string | unknown, maxLen: number): string {
  const str = typeof output === "string" ? output : JSON.stringify(output);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `... (truncado, ${str.length} chars)`;
}

function formatToolCallEntry(entry: LogEntry): string {
  const inputStr = entry.input ? JSON.stringify(entry.input) : "{}";
  const outputStr = entry.output ? truncateOutput(JSON.stringify(entry.output), 200) : "{}";
  const durationStr = entry.duration !== undefined ? `${entry.duration}ms` : "N/A";

  return [
    `## Tool Call ${entry.type || "Evento"}: ${entry.name || "unknown"}`,
    `- Input: ${inputStr}`,
    `- Output: ${outputStr}`,
    `- Duracion: ${durationStr}`,
    `- Estado: ${entry.status || "unknown"}`,
    ""
  ].join("\n");
}

function formatConversationEntry(entry: LogEntry): string {
  const roleLabel = entry.role === "user" ? "Usuario" : "Asistente";
  const content = entry.content || "";
  return [
    `### ${roleLabel}`,
    content,
    ""
  ].join("\n");
}

function formatReasoningEntry(entry: LogEntry): string {
  const content = entry.content || "";
  return [
    "### Razonamiento",
    content,
    ""
  ].join("\n");
}

function formatErrorEntry(entry: LogEntry): string {
  const message = entry.content || entry.input?.["message"] || "Error desconocido";
  return [
    "### Error",
    `- ${message}`,
    ""
  ].join("\n");
}

function formatSessionHeader(session: SessionData): string {
  const lines = [`# Sesion: ${session.sessionId}`];

  if (session.startTime) {
    lines.push(`- Inicio: ${session.startTime}`);
  }
  if (session.endTime) {
    lines.push(`- Fin: ${session.endTime}`);
  }
  if (session.prompt) {
    lines.push(`- Prompt: ${session.prompt}`);
  }
  if (session.model) {
    lines.push(`- Modelo: ${session.model}`);
  }

  lines.push("");
  return lines.join("\n");
}

function formatStatistics(session: SessionData): string {
  return [
    "",
    "---",
    "",
    "## Estadisticas",
    `- Tool calls: ${session.toolCalls}`,
    `- Errores: ${session.errors}`,
    `- Duracion total: ${session.endTime && session.startTime ? calculateDuration(session.startTime, session.endTime) : "N/A"}`,
    ""
  ].join("\n");
}

function calculateDuration(start: string, end: string): string {
  const startDate = new Date(start).getTime();
  const endDate = new Date(end).getTime();
  const diffMs = endDate - startDate;
  const diffSec = (diffMs / 1000).toFixed(1);
  return `${diffSec}s`;
}

function writeLogFile(sessionId: string, content: string): void {
  ensureLogsDir();
  const filePath = getLogFile(sessionId);
  fs.appendFileSync(filePath, content, "utf-8");
}

function getLogFile(sessionId: string): string {
  return path.join(LOGS_ROOT, `${sessionId}.md`);
}

function initSession(sessionId: string, prompt?: string): { success: boolean; file: string } {
  const now = new Date().toISOString();
  currentSession = {
    id: sessionId,
    sessionId,
    startTime: now,
    prompt,
    model: "gemma-4b-64k:latest",
    toolCalls: 0,
    errors: 0
  };

  const filePath = getLogFile(sessionId);
  ensureLogsDir();
  fs.writeFileSync(filePath, formatSessionHeader(currentSession!), "utf-8");
  updateIndex(sessionId, { start_time: now });

  return { success: true, file: filePath };
}

function appendEntry(sessionId: string, entry: LogEntry): { success: boolean } {
  if (!currentSession || currentSession.sessionId !== sessionId) {
    return { success: false };
  }

  let block: string;
  switch (entry.type) {
    case "conversation":
      block = formatConversationEntry(entry);
      break;
    case "reasoning":
      block = formatReasoningEntry(entry);
      break;
    case "error":
      block = formatErrorEntry(entry);
      currentSession.errors++;
      break;
    default:
      block = formatToolCallEntry(entry);
      currentSession.toolCalls++;
      if (entry.status === "error") {
        currentSession.errors++;
      }
      break;
  }

  writeLogFile(sessionId, block);

  updateIndex(sessionId, {
    tool_calls: currentSession.toolCalls,
    errors: currentSession.errors
  });

  return { success: true };
}

function closeSession(sessionId: string): { success: boolean } {
  if (!currentSession || currentSession.sessionId !== sessionId) {
    return { success: false };
  }

  const session = currentSession;
  const now = new Date().toISOString();
  session.endTime = now;

  const stats = formatStatistics(session);
  writeLogFile(sessionId, stats);

  updateIndex(sessionId, {
    end_time: now,
    tool_calls: session.toolCalls,
    errors: session.errors
  });

  currentSession = null;

  return { success: true };
}

const tool: Tool = {
  name: "logSession",
  description: "Escribe el trace de la sesion actual en un archivo de logs en /Users/lastprophet/.boris/logs/. Acciones: init (iniciar sesion), append (agregar entrada de tool call), close (cerrar sesion con estadisticas).",
  schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["init", "append", "close"],
        description: "iniciar, agregar entrada o cerrar la sesion"
      },
      sessionId: {
        type: "string",
        description: "identificador unico de la sesion"
      },
      entry: {
        type: "object",
        description: "datos de la entrada (tool call o resumen) - requerido para action: append"
      },
      prompt: {
        type: "string",
        description: "prompt del usuario - requerido para action: init"
      }
    },
    required: ["action"],
    additionalProperties: false
  },
  async execute(params: Record<string, unknown>): Promise<{ success: boolean; file?: string }> {
    const action = params.action as string;
    const sessionId = params.sessionId as string;
    const entry = params.entry as Record<string, unknown> | undefined;
    const prompt = params.prompt as string | undefined;

    switch (action) {
      case "init": {
        if (!sessionId) {
          return { success: false };
        }
        const result = initSession(sessionId, prompt);
        return { success: result.success, file: result.file };
      }
      case "append": {
        if (!sessionId || !entry) {
          return { success: false };
        }
        const logEntry: LogEntry = {
          type: entry.type as string || "Tool Call",
          name: entry.name as string || "unknown",
          role: entry.role as "user" | "assistant" | undefined,
          content: entry.content as string | undefined,
          input: entry.input as Record<string, unknown>,
          output: entry.output as Record<string, unknown>,
          duration: entry.duration as number,
          status: entry.status as string || "success"
        };
        const result = appendEntry(sessionId, logEntry);
        return { success: result.success };
      }
      case "close": {
        if (!sessionId) {
          return { success: false };
        }
        const result = closeSession(sessionId);
        return { success: result.success };
      }
      default:
        return { success: false };
    }
  }
};

export const { name, description, schema, execute } = tool;

export { currentSession, LogEntry, SessionData };
