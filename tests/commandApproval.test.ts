import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { commandApprovalService } from "../src/main/commandApproval/service";

describe("CommandApprovalService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debe resolver approved", async () => {
    const promise = commandApprovalService.request("a1", "t1", "r1", "ls");

    commandApprovalService.approve("a1");

    const result = await promise;
    expect(result).toBe("approved");
  });

  it("debe resolver denied", async () => {
    const promise = commandApprovalService.request("a2", "t2", "r2", "git status");

    commandApprovalService.deny("a2");

    const result = await promise;
    expect(result).toBe("denied");
  });

  it("debe resolver timeout", async () => {
    const promise = commandApprovalService.request("a3", "t3", "r3", "ls");

    vi.advanceTimersByTime(31000);

    const result = await promise;
    expect(result).toBe("timeout");
  });

  it("debe ignorar approve duplicado", async () => {
    const promise = commandApprovalService.request("a4", "t4", "r4", "ls");

    commandApprovalService.approve("a4");
    commandApprovalService.approve("a4");

    const result = await promise;
    expect(result).toBe("approved");
  });

  it("debe ignorar deny duplicado", async () => {
    const promise = commandApprovalService.request("a5", "t5", "r5", "ls");

    commandApprovalService.deny("a5");
    commandApprovalService.deny("a5");

    const result = await promise;
    expect(result).toBe("denied");
  });

  it("debe abortar approvals pendientes de un requestId", async () => {
    const p1 = commandApprovalService.request("a6", "t6", "r-abort", "ls");
    const p2 = commandApprovalService.request("a7", "t7", "r-abort", "pwd");
    const p3 = commandApprovalService.request("a8", "t8", "r-other", "cat");

    commandApprovalService.abort("r-abort");

    const r1 = await p1;
    const r2 = await p2;

    expect(r1).toBe("timeout");
    expect(r2).toBe("timeout");

    // p3 tiene requestId distinto, no se ve afectado por el abort
    commandApprovalService.approve("a8");
    const r3 = await p3;
    expect(r3).toBe("approved");
  });
});
