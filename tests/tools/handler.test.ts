import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() }
}));

vi.mock("../../src/main/tools/registry", () => ({
  listTools: vi.fn(() => [{ name: "createFile", description: "x", schema: {} }]),
  executeTool: vi.fn()
}));

import { registerToolsIpc } from "../../src/main/tools/handler";
import { listTools, executeTool } from "../../src/main/tools/registry";

type Handler = (event: unknown, payload: unknown) => Promise<unknown>;

function createMockIpcMain() {
  const handlers = new Map<string, Handler>();
  return {
    handlers,
    handle: vi.fn((channel: string, fn: Handler) => {
      handlers.set(channel, fn);
    })
  };
}

describe("registerToolsIpc", () => {
  let mockIpc: ReturnType<typeof createMockIpcMain>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIpc = createMockIpcMain();
    registerToolsIpc(mockIpc as unknown as typeof import("electron").ipcMain);
  });

  it("registra los canales boris:tools:execute y boris:tools:list", () => {
    expect(mockIpc.handle).toHaveBeenCalledWith("boris:tools:execute", expect.any(Function));
    expect(mockIpc.handle).toHaveBeenCalledWith("boris:tools:list", expect.any(Function));
  });

  it("boris:tools:execute retorna el resultado en éxito", async () => {
    vi.mocked(executeTool).mockResolvedValueOnce({ success: true, path: "a.txt" });
    const handler = mockIpc.handlers.get("boris:tools:execute")!;
    const result = await handler({}, { name: "createFile", params: { path: "a.txt" } });
    expect(executeTool).toHaveBeenCalledWith("createFile", { path: "a.txt" });
    expect(result).toEqual({ success: true, path: "a.txt" });
  });

  it("si executeTool lanza, retorna { success: false, error } sin propagar", async () => {
    vi.mocked(executeTool).mockRejectedValueOnce(new Error("boom"));
    const handler = mockIpc.handlers.get("boris:tools:execute")!;
    const result = await handler({}, { name: "createFile", params: {} });
    expect(result).toEqual({ success: false, error: "boom" });
  });

  it("si executeTool lanza un no-Error, retorna error desconocido", async () => {
    vi.mocked(executeTool).mockRejectedValueOnce("no-es-error");
    const handler = mockIpc.handlers.get("boris:tools:execute")!;
    const result = await handler({}, { name: "x", params: {} });
    expect(result).toEqual({ success: false, error: "Error desconocido" });
  });

  it("boris:tools:list retorna { tools }", async () => {
    const handler = mockIpc.handlers.get("boris:tools:list")!;
    const result = await handler({}, undefined);
    expect(listTools).toHaveBeenCalled();
    expect(result).toEqual({ tools: [{ name: "createFile", description: "x", schema: {} }] });
  });
});
