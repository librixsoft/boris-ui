import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  executionMode: {
    getMode: vi.fn(() => "controlled"),
    isBypass: vi.fn(() => false),
    isControlled: vi.fn(() => true),
    setMode: vi.fn(),
    toggle: vi.fn()
  },
  commandApproval: {
    request: vi.fn(),
    approve: vi.fn(),
    deny: vi.fn(),
    abort: vi.fn()
  },
  executeTool: vi.fn()
}));

vi.mock("../src/main/executionMode/service", () => ({
  executionModeService: mocks.executionMode
}));

vi.mock("../src/main/commandApproval/service", () => ({
  commandApprovalService: mocks.commandApproval
}));

vi.mock("../src/main/tools/registry", () => ({
  executeTool: mocks.executeTool,
  listTools: vi.fn(() => [])
}));

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() }
}));

import { executeGatedTool } from "../src/main/llm";

function createMockEvent(): unknown {
  return {
    sender: {
      isDestroyed: vi.fn(() => false),
      send: vi.fn()
    }
  } as unknown;
}

describe("executeGatedTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.executionMode.getMode.mockReturnValue("controlled");
    mocks.executionMode.isBypass.mockReturnValue(false);
    mocks.executeTool.mockResolvedValue({ success: true, path: "/tmp" });
  });

  it("debe ejecutar directo en bypass sin approval", async () => {
    mocks.executionMode.getMode.mockReturnValue("bypass");
    mocks.executionMode.isBypass.mockReturnValue(true);

    const event = createMockEvent();
    const result = await executeGatedTool(event as any, "r1", {
      name: "executeCommand",
      args: { command: "ls" },
      id: "t1"
    });

    expect(result.success).toBe(true);
    expect(mocks.commandApproval.request).not.toHaveBeenCalled();
    expect(mocks.executeTool).toHaveBeenCalledWith("executeCommand", { command: "ls" });
  });

  it("debe ejecutar directo si la tool no es executeCommand", async () => {
    const event = createMockEvent();
    const result = await executeGatedTool(event as any, "r1", {
      name: "browser",
      args: { action: "screenshot" },
      id: "t1"
    });

    expect(result.success).toBe(true);
    expect(mocks.commandApproval.request).not.toHaveBeenCalled();
  });

  it("debe esperar approval en controlled y ejecutar tras aprobar", async () => {
    mocks.commandApproval.request.mockResolvedValue("approved");

    const event = createMockEvent();
    const result = await executeGatedTool(event as any, "r1", {
      name: "executeCommand",
      args: { command: "ls" },
      id: "t1"
    });

    expect(mocks.commandApproval.request).toHaveBeenCalledWith(expect.any(String), "t1", "r1", "ls");
    expect(result.success).toBe(true);
    expect(mocks.executeTool).toHaveBeenCalledWith("executeCommand", { command: "ls" });
  });

  it("debe denegar si el usuario rechaza", async () => {
    mocks.commandApproval.request.mockResolvedValue("denied");

    const event = createMockEvent();
    const result = await executeGatedTool(event as any, "r1", {
      name: "executeCommand",
      args: { command: "ls" },
      id: "t1"
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("denied");
    expect(mocks.executeTool).not.toHaveBeenCalled();
  });

  it("debe timeout si no se responde", async () => {
    mocks.commandApproval.request.mockResolvedValue("timeout");

    const event = createMockEvent();
    const result = await executeGatedTool(event as any, "r1", {
      name: "executeCommand",
      args: { command: "ls" },
      id: "t1"
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("timeout");
    expect(mocks.executeTool).not.toHaveBeenCalled();
  });
});
