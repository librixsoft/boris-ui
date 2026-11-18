import { describe, it, expect } from "vitest";
import { initApproval, requestApproval, getApprovalMode } from "../../src/main/browser/human/approval";

describe("F7 approval required mode", () => {
  it("throws ApprovalRequiredError in required mode", async () => {
    initApproval("required", "/tmp/test");
    await expect(requestApproval({ kind: "message", text: "Hello", recipientRouteClass: "messaging" })).rejects.toThrow("Approval required");
  });

  it("allows in off mode", async () => {
    initApproval("off", "/tmp/test");
    await requestApproval({ kind: "message", text: "Hello", recipientRouteClass: "messaging" });
  });

  it("allows first-n then requires", async () => {
    initApproval("first-n", "/tmp/test", 2);
    await requestApproval({ kind: "message", text: "Hello 1", recipientRouteClass: "messaging" });
    await requestApproval({ kind: "message", text: "Hello 2", recipientRouteClass: "messaging" });
    await expect(requestApproval({ kind: "message", text: "Hello 3", recipientRouteClass: "messaging" })).rejects.toThrow("Approval required");
  });

  it("returns correct approval mode", () => {
    initApproval("first-n", "/tmp/test");
    expect(getApprovalMode()).toBe("first-n");
  });
});
