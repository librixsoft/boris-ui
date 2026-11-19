import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  listTools: vi.fn(),
  executeTool: vi.fn(),
  logExecute: vi.fn(),
  buildSystemPrompt: vi.fn(),
  ipcHandle: vi.fn()
}));

vi.mock("electron", () => ({ ipcMain: { handle: mocks.ipcHandle } }));
vi.mock("../src/main/tools/registry", () => ({
  listTools: mocks.listTools,
  executeTool: mocks.executeTool
}));
vi.mock("../src/main/tools/logSession", () => ({ execute: mocks.logExecute }));
vi.mock("../src/main/systemPrompt", () => ({ buildSystemPrompt: mocks.buildSystemPrompt }));

import { registerLlmIpc } from "../src/main/llm";

type Handler = (event: unknown, payload: unknown) => Promise<void>;

function sseResponse(chunks: string[], opts: { ok?: boolean; status?: number; statusText?: string } = {}) {
  const { ok = true, status = 200, statusText = "OK" } = opts;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  });
  return {
    ok,
    status,
    statusText,
    text: async () => chunks.join(""),
    body: stream
  };
}

function contentLine(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n`;
}

function toolCallLine(): string {
  return `data: ${JSON.stringify({
    choices: [
      {
        delta: {
          tool_calls: [
            {
              index: 0,
              id: "call_1",
              function: { name: "createFile", arguments: JSON.stringify({ path: "a.txt" }) }
            }
          ]
        }
      }
    ]
  })}\n`;
}

let streamHandler: Handler;
let abortHandler: Handler;
let send: ReturnType<typeof vi.fn>;
let event: { sender: { isDestroyed: () => boolean; send: ReturnType<typeof vi.fn> } };
let fetchMock: ReturnType<typeof vi.fn>;

function sent(channel: string) {
  return send.mock.calls.filter(([c]) => c === channel).map(([, p]) => p);
}

function payload(requestId: string) {
  return { requestId, messages: [{ role: "user", content: "hola" }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listTools.mockReturnValue([]);
  mocks.executeTool.mockResolvedValue({ success: true, path: "/ws/a.txt" });
  mocks.logExecute.mockResolvedValue(undefined);
  mocks.buildSystemPrompt.mockReturnValue("system prompt");

  const handlers = new Map<string, Handler>();
  mocks.ipcHandle.mockImplementation((channel: string, fn: Handler) => {
    handlers.set(channel, fn);
  });
  registerLlmIpc();
  streamHandler = handlers.get("boris:chat:stream")!;
  abortHandler = handlers.get("boris:chat:abort")!;

  send = vi.fn();
  event = { sender: { isDestroyed: () => false, send } };
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamChatCompletion", () => {
  it("respuesta final directa en un solo turno", async () => {
    fetchMock.mockResolvedValueOnce(sseResponse([contentLine("Hola"), "data: [DONE]\n"]));

    await streamHandler(event, payload("r1"));

    expect(sent("boris:chat:chunk")).toEqual([{ requestId: "r1", content: "Hola" }]);
    expect(sent("boris:chat:done")).toEqual([{ requestId: "r1" }]);
    expect(sent("boris:chat:error")).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tool call ejecuta la tool y hace un segundo request", async () => {
    fetchMock
      .mockResolvedValueOnce(sseResponse([toolCallLine(), "data: [DONE]\n"]))
      .mockResolvedValueOnce(sseResponse([contentLine("Listo"), "data: [DONE]\n"]));

    await streamHandler(event, payload("r2"));

    expect(mocks.executeTool).toHaveBeenCalledWith("createFile", { path: "a.txt" });
    expect(sent("boris:chat:tool-call")).toEqual([
      { requestId: "r2", name: "createFile", args: { path: "a.txt" } }
    ]);
    expect(sent("boris:chat:tool-result")[0]).toMatchObject({
      requestId: "r2",
      name: "createFile",
      success: true
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondInit = fetchMock.mock.calls[1][1] as { body: string };
    const secondBody = JSON.parse(secondInit.body);
    const toolMsg = secondBody.messages.find((m: { role: string }) => m.role === "tool");
    expect(toolMsg).toBeTruthy();
    expect(toolMsg.tool_call_id).toBe("call_1");

    expect(sent("boris:chat:done")).toEqual([{ requestId: "r2" }]);
  });

  it("reconstruye SSE parcial cortado entre chunks", async () => {
    const full = contentLine("Hola");
    const splitAt = full.indexOf("Hola") + 2;
    fetchMock.mockResolvedValueOnce(
      sseResponse([full.slice(0, splitAt), full.slice(splitAt), "data: [DONE]\n"])
    );

    await streamHandler(event, payload("r3"));

    expect(sent("boris:chat:chunk")).toEqual([{ requestId: "r3", content: "Hola" }]);
    expect(sent("boris:chat:done")).toEqual([{ requestId: "r3" }]);
  });

  it("response.ok false emite error HTTP", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "boom",
      body: null
    });

    await streamHandler(event, payload("r4"));

    expect(sent("boris:chat:error")).toEqual([{ requestId: "r4", message: "HTTP 500: boom" }]);
    expect(sent("boris:chat:done")).toEqual([{ requestId: "r4" }]);
  });

  it("abort cancela el stream y emite done sin error", async () => {
    let fetchStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      fetchStarted = resolve;
    });

    fetchMock.mockImplementation((_url: string, init: { signal: AbortSignal }) => {
      fetchStarted();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          init.signal.addEventListener("abort", () => {
            controller.error(Object.assign(new Error("Aborted"), { name: "AbortError" }));
          });
        }
      });
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => "",
        body: stream
      });
    });

    const promise = streamHandler(event, payload("r5"));
    await started;
    await abortHandler(event, { requestId: "r5" });
    await promise;

    expect(sent("boris:chat:done")).toEqual([{ requestId: "r5" }]);
    expect(sent("boris:chat:error")).toEqual([]);
  });
});
