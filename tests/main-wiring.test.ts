import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ipcHandle: vi.fn(),
  listTools: vi.fn(() => []),
  executeTool: vi.fn(),
  logExecute: vi.fn(),
  buildSystemPrompt: vi.fn(() => "sys")
}));

vi.mock("electron", () => ({ ipcMain: { handle: mocks.ipcHandle } }));
vi.mock("../src/main/tools/registry", () => ({
  listTools: mocks.listTools,
  executeTool: mocks.executeTool
}));
vi.mock("../src/main/tools/logSession", () => ({ execute: mocks.logExecute }));
vi.mock("../src/main/systemPrompt", () => ({ buildSystemPrompt: mocks.buildSystemPrompt }));

import { registerLlmIpc } from "../src/main/llm";
import { registerToolsIpc } from "../src/main/tools/handler";

describe("wiring de canales IPC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registra los 4 canales esperados", () => {
    registerLlmIpc();
    registerToolsIpc({ handle: mocks.ipcHandle } as unknown as typeof import("electron").ipcMain);

    const channels = mocks.ipcHandle.mock.calls.map((c) => c[0]);
    expect(channels).toContain("boris:chat:stream");
    expect(channels).toContain("boris:chat:abort");
    expect(channels).toContain("boris:tools:execute");
    expect(channels).toContain("boris:tools:list");
    expect(channels).toHaveLength(4);
  });
});
