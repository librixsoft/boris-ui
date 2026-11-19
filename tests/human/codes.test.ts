import { describe, it, expect } from "vitest";
import {
  BreakerOpenError,
  BudgetExceededError,
  OutsideActiveHoursError,
  ApprovalRequiredError,
  DeferredError
} from "../../src/main/browser/human/codes";

describe("códigos de error del módulo human", () => {
  it("BreakerOpenError expone code y retryAt", () => {
    const withRetry = new BreakerOpenError(123);
    expect(withRetry.code).toBe("BREAKER_OPEN");
    expect(withRetry.retryAt).toBe(123);
    expect(new BreakerOpenError().retryAt).toBeUndefined();
  });

  it("BudgetExceededError expone code, mensaje de clase y retryAt", () => {
    const err = new BudgetExceededError("read", 456);
    expect(err.code).toBe("BUDGET_EXCEEDED");
    expect(err.message).toContain("read");
    expect(err.retryAt).toBe(456);
    expect(new BudgetExceededError("write").retryAt).toBeUndefined();
  });

  it("OutsideActiveHoursError expone code y retryAt", () => {
    const err = new OutsideActiveHoursError(789);
    expect(err.code).toBe("OUTSIDE_HOURS");
    expect(err.retryAt).toBe(789);
    expect(new OutsideActiveHoursError().retryAt).toBeUndefined();
  });

  it("ApprovalRequiredError expone code sin retryAt", () => {
    const err = new ApprovalRequiredError();
    expect(err.code).toBe("APPROVAL_REQUIRED");
    expect(err.retryAt).toBeUndefined();
  });

  it("DeferredError expone code y retryAt", () => {
    const err = new DeferredError(321);
    expect(err.code).toBe("DEFERRED");
    expect(err.retryAt).toBe(321);
    expect(new DeferredError().retryAt).toBeUndefined();
  });
});
