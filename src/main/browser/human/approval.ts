import { recordHumanEvent } from "./telemetry";

export type ApprovalMode = "required" | "first-n" | "off";

export interface ApprovalRequest {
  kind: "message" | "invite" | "post" | "comment" | "reaction";
  text?: string;
  recipientRouteClass: "profile" | "messaging" | "feed" | "other";
}

let approvalMode: ApprovalMode = "required";
let firstNCount = 0;
let profileDir = "";

export function initApproval(mode: ApprovalMode, dir: string, firstN?: number): void {
  approvalMode = mode;
  profileDir = dir;
  firstNCount = firstN ?? 0;
}

export async function requestApproval(request: ApprovalRequest): Promise<void> {
  if (approvalMode === "off") {
    return;
  }

  if (approvalMode === "required") {
    recordHumanEvent({
      ts: Date.now(),
      phase: "approval",
      action: "write",
      routeClass: request.recipientRouteClass,
      level: "balanced",
      durationMs: 0,
      success: false,
      code: "APPROVAL_REQUIRED",
    });
    throw new Error(`Approval required for ${request.kind}`);
  }

  if (approvalMode === "first-n") {
    if (firstNCount > 0) {
      firstNCount--;
      return;
    }
    recordHumanEvent({
      ts: Date.now(),
      phase: "approval",
      action: "write",
      routeClass: request.recipientRouteClass,
      level: "balanced",
      durationMs: 0,
      success: false,
      code: "APPROVAL_REQUIRED",
    });
    throw new Error(`Approval required for ${request.kind}`);
  }
}

export function getApprovalMode(): ApprovalMode {
  return approvalMode;
}
