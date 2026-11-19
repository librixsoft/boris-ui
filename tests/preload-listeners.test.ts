import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { on: vi.fn(), off: vi.fn(), invoke: vi.fn() },
  shell: { openExternal: vi.fn() }
}));

import { ipcRenderer } from "electron";
import { attachListeners } from "../src/main/preload";

type Listener = (event: unknown, data: Record<string, unknown>) => void;

function createHandlers() {
  return {
    onChunk: vi.fn(),
    onReasoning: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
    onToolCall: vi.fn(),
    onToolResult: vi.fn()
  };
}

const CHANNELS = [
  "boris:chat:chunk",
  "boris:chat:reasoning",
  "boris:chat:done",
  "boris:chat:error",
  "boris:chat:tool-call",
  "boris:chat:tool-result"
];

describe("attachListeners", () => {
  let registered: Map<string, Listener>;

  beforeEach(() => {
    vi.clearAllMocks();
    registered = new Map();
    vi.mocked(ipcRenderer.on).mockImplementation((channel: string, cb: Listener) => {
      registered.set(channel, cb);
    });
  });

  it("registra los 6 listeners", () => {
    attachListeners("req-1", createHandlers());
    expect(ipcRenderer.on).toHaveBeenCalledTimes(6);
    for (const channel of CHANNELS) {
      expect(registered.has(channel)).toBe(true);
    }
  });

  it("solo dispara handlers cuyo requestId coincide", () => {
    const handlers = createHandlers();
    attachListeners("req-1", handlers);

    const onChunk = registered.get("boris:chat:chunk")!;
    onChunk({}, { requestId: "otro", content: "x" });
    expect(handlers.onChunk).not.toHaveBeenCalled();

    onChunk({}, { requestId: "req-1", content: "hola" });
    expect(handlers.onChunk).toHaveBeenCalledWith("hola");
  });

  it("reasoning y tool-call filtran por requestId", () => {
    const handlers = createHandlers();
    attachListeners("req-1", handlers);

    registered.get("boris:chat:reasoning")!({}, { requestId: "req-1", content: "r" });
    expect(handlers.onReasoning).toHaveBeenCalledWith("r");

    registered.get("boris:chat:tool-call")!({}, { requestId: "req-1", name: "t", args: { a: 1 } });
    expect(handlers.onToolCall).toHaveBeenCalledWith({ name: "t", args: { a: 1 } });

    registered.get("boris:chat:tool-result")!({}, { requestId: "otro", name: "t", result: {}, success: true });
    expect(handlers.onToolResult).not.toHaveBeenCalled();
  });

  it("done llama a onDone y detach()", () => {
    const handlers = createHandlers();
    attachListeners("req-1", handlers);

    registered.get("boris:chat:done")!({}, { requestId: "req-1" });
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.off).toHaveBeenCalledTimes(6);
  });

  it("error llama a onError y detach()", () => {
    const handlers = createHandlers();
    attachListeners("req-1", handlers);

    registered.get("boris:chat:error")!({}, { requestId: "req-1", message: "boom" });
    expect(handlers.onError).toHaveBeenCalledWith("boom");
    expect(ipcRenderer.off).toHaveBeenCalledTimes(6);
  });

  it("done con requestId distinto no dispara ni detacha", () => {
    const handlers = createHandlers();
    attachListeners("req-1", handlers);

    registered.get("boris:chat:done")!({}, { requestId: "otro" });
    expect(handlers.onDone).not.toHaveBeenCalled();
    expect(ipcRenderer.off).not.toHaveBeenCalled();
  });

  it("detach() remueve los 6 listeners", () => {
    const detach = attachListeners("req-1", createHandlers());
    detach();
    expect(ipcRenderer.off).toHaveBeenCalledTimes(6);
    const channels = vi.mocked(ipcRenderer.off).mock.calls.map((c) => c[0]);
    for (const channel of CHANNELS) {
      expect(channels).toContain(channel);
    }
  });
});
