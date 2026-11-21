const DEFAULT_APPROVAL_TIMEOUT_MS = 30000;

interface PendingApproval {
  approvalId: string;
  toolCallId: string;
  requestId: string;
  command: string;
  resolve: (result: "approved" | "denied" | "timeout") => void;
  reject?: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
  createdAt: number;
}

class CommandApprovalService {
  private pending = new Map<string, PendingApproval>();

  request(
    approvalId: string,
    toolCallId: string,
    requestId: string,
    command: string
  ): Promise<"approved" | "denied" | "timeout"> {
    return new Promise((resolve, reject) => {
      if (this.pending.has(approvalId)) {
        reject(new Error("Solicitud de aprobación duplicada"));
      }

      const pending: PendingApproval = {
        approvalId,
        toolCallId,
        requestId,
        command,
        resolve,
        reject,
        timeoutId: setTimeout(() => {
          this.pending.delete(approvalId);
          resolve("timeout");
        }, DEFAULT_APPROVAL_TIMEOUT_MS),
        createdAt: Date.now()
      };

      this.pending.set(approvalId, pending);
    });
  }

  approve(approvalId: string): void {
    const pending = this.pending.get(approvalId);
    if (!pending) return;

    clearTimeout(pending.timeoutId);
    this.pending.delete(approvalId);
    pending.resolve("approved");
  }

  deny(approvalId: string): void {
    const pending = this.pending.get(approvalId);
    if (!pending) return;

    clearTimeout(pending.timeoutId);
    this.pending.delete(approvalId);
    pending.resolve("denied");
  }

  abort(requestId: string): void {
    for (const [approvalId, pending] of this.pending) {
      if (pending.requestId === requestId) {
        clearTimeout(pending.timeoutId);
        this.pending.delete(approvalId);
        pending.resolve("timeout");
      }
    }
  }
}

export const commandApprovalService = new CommandApprovalService();
