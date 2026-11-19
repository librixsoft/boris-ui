import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

vi.mock("../../src/main/tools/registry", () => ({}));

const originalHome = process.env.HOME;
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "boris-home-"));
const logsRoot = path.join(tmpHome, ".boris", "logs");

type Execute = (params: Record<string, unknown>) => Promise<{ success: boolean; file?: string }>;
let execute: Execute;

beforeAll(async () => {
  process.env.HOME = tmpHome;
  const mod = await import("../../src/main/tools/logSession");
  execute = mod.execute as unknown as Execute;
});

afterAll(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

function logFile(sessionId: string): string {
  return path.join(logsRoot, `${sessionId}.md`);
}

function readIndex(): { sessions: Array<Record<string, unknown>> } {
  return JSON.parse(fs.readFileSync(path.join(logsRoot, "index.json"), "utf-8"));
}

function findSession(sessionId: string): Record<string, unknown> | undefined {
  return readIndex().sessions.find((s) => s.id === sessionId || s.sessionId === sessionId);
}

describe("logSession", () => {
  it("init crea el archivo con header y start_time", async () => {
    const result = await execute({ action: "init", sessionId: "init-1", prompt: "hola" });
    expect(result.success).toBe(true);
    expect(fs.existsSync(logFile("init-1"))).toBe(true);
    const content = fs.readFileSync(logFile("init-1"), "utf-8");
    expect(content).toContain("# Sesion: init-1");
    expect(content).toContain("Inicio:");
    const session = findSession("init-1");
    expect(session?.start_time).toBeTruthy();
    await execute({ action: "close", sessionId: "init-1" });
  });

  it("append conversación escribe bloques Usuario y Asistente", async () => {
    await execute({ action: "init", sessionId: "conv-1" });
    await execute({ action: "append", sessionId: "conv-1", entry: { type: "conversation", role: "user", content: "hola" } });
    await execute({ action: "append", sessionId: "conv-1", entry: { type: "conversation", role: "assistant", content: "respuesta" } });
    const content = fs.readFileSync(logFile("conv-1"), "utf-8");
    expect(content).toContain("### Usuario");
    expect(content).toContain("### Asistente");
    expect(content).toContain("hola");
    expect(content).toContain("respuesta");
    await execute({ action: "close", sessionId: "conv-1" });
  });

  it("append error incrementa errors", async () => {
    await execute({ action: "init", sessionId: "err-1" });
    await execute({ action: "append", sessionId: "err-1", entry: { type: "error", content: "boom" } });
    expect(findSession("err-1")?.errors).toBe(1);
    await execute({ action: "close", sessionId: "err-1" });
  });

  it("append tool con status error incrementa errors y toolCalls", async () => {
    await execute({ action: "init", sessionId: "toolerr-1" });
    await execute({
      action: "append",
      sessionId: "toolerr-1",
      entry: { type: "Tool Call", name: "x", input: {}, output: {}, status: "error" }
    });
    const session = findSession("toolerr-1");
    expect(session?.tool_calls).toBe(1);
    expect(session?.errors).toBe(1);
    await execute({ action: "close", sessionId: "toolerr-1" });
  });

  it("append tool exitoso incrementa toolCalls sin errors", async () => {
    await execute({ action: "init", sessionId: "toolok-1" });
    await execute({
      action: "append",
      sessionId: "toolok-1",
      entry: { type: "Tool Call", name: "x", input: {}, output: {}, status: "success" }
    });
    const session = findSession("toolok-1");
    expect(session?.tool_calls).toBe(1);
    expect(session?.errors).toBe(0);
    await execute({ action: "close", sessionId: "toolok-1" });
  });

  it("append a un sessionId distinto devuelve success false", async () => {
    await execute({ action: "init", sessionId: "diff-1" });
    const result = await execute({
      action: "append",
      sessionId: "otro",
      entry: { type: "conversation", role: "user", content: "x" }
    });
    expect(result.success).toBe(false);
    await execute({ action: "close", sessionId: "diff-1" });
  });

  it("close escribe estadísticas, setea end_time y limpia currentSession", async () => {
    await execute({ action: "init", sessionId: "close-1" });
    await execute({
      action: "append",
      sessionId: "close-1",
      entry: { type: "Tool Call", name: "x", input: {}, output: {}, status: "success" }
    });
    const closeResult = await execute({ action: "close", sessionId: "close-1" });
    expect(closeResult.success).toBe(true);
    const content = fs.readFileSync(logFile("close-1"), "utf-8");
    expect(content).toContain("## Estadisticas");
    expect(content).toContain("Tool calls:");
    expect(findSession("close-1")?.end_time).toBeTruthy();
    const afterClose = await execute({
      action: "append",
      sessionId: "close-1",
      entry: { type: "conversation", role: "user", content: "x" }
    });
    expect(afterClose.success).toBe(false);
  });

  it("output de tool mayor a 200 chars se trunca", async () => {
    await execute({ action: "init", sessionId: "trunc-1" });
    await execute({
      action: "append",
      sessionId: "trunc-1",
      entry: {
        type: "Tool Call",
        name: "x",
        input: {},
        output: { data: "x".repeat(300) },
        status: "success"
      }
    });
    const content = fs.readFileSync(logFile("trunc-1"), "utf-8");
    expect(content).toContain("... (truncado,");
    expect(content).toContain("chars)");
    await execute({ action: "close", sessionId: "trunc-1" });
  });

  it("init/append/close sin sessionId devuelve success false", async () => {
    expect((await execute({ action: "init" })).success).toBe(false);
    expect((await execute({ action: "append", entry: { type: "conversation" } })).success).toBe(false);
    expect((await execute({ action: "close" })).success).toBe(false);
  });
});
