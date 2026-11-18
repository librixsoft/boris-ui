export type FailureCode = "DEFERRED" | "BREAKER_OPEN" | "BUDGET_EXCEEDED" | "OUTSIDE_HOURS" | "APPROVAL_REQUIRED";

export class BreakerOpenError extends Error {
  code = "BREAKER_OPEN" as FailureCode;
  retryAt?: number;
  constructor(retryAt?: number) {
    super("Circuit breaker open");
    this.name = "BreakerOpenError";
    this.retryAt = retryAt;
  }
}

export class BudgetExceededError extends Error {
  code = "BUDGET_EXCEEDED" as FailureCode;
  retryAt?: number;
  constructor(actionClass: string, retryAt?: number) {
    super(`Budget exceeded for action class: ${actionClass}`);
    this.name = "BudgetExceededError";
    this.retryAt = retryAt;
  }
}

export class OutsideActiveHoursError extends Error {
  code = "OUTSIDE_HOURS" as FailureCode;
  retryAt?: number;
  constructor(retryAt?: number) {
    super("Outside active hours");
    this.name = "OutsideActiveHoursError";
    this.retryAt = retryAt;
  }
}

export class ApprovalRequiredError extends Error {
  code = "APPROVAL_REQUIRED" as FailureCode;
  constructor() {
    super("Approval required");
    this.name = "ApprovalRequiredError";
  }
}

export class DeferredError extends Error {
  code = "DEFERRED" as FailureCode;
  retryAt?: number;
  constructor(retryAt?: number) {
    super("Action deferred");
    this.name = "DeferredError";
    this.retryAt = retryAt;
  }
}
