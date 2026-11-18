import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initBreaker,
  openBreaker,
  isOpen,
  assertClosed,
  resetBreaker,
  recordFailure,
  recordSuccess,
  getBreakerState,
} from "../../src/main/browser/human/breaker";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("F3 breaker open", () => {
  let profileDir: string;

  beforeEach(() => {
    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "boris-f3-breaker-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should open breaker on signal", () => {
    initBreaker(profileDir, 123, 1);
    openBreaker("429 detected");
    expect(isOpen()).toBe(true);
  });

  it("should throw BreakerOpenError on assertClosed when open", () => {
    initBreaker(profileDir, 124, 1);
    openBreaker("test");
    expect(() => assertClosed()).toThrow("Circuit breaker open");
  });

  it("should not throw when breaker is closed", () => {
    initBreaker(profileDir, 125, 1);
    expect(() => assertClosed()).not.toThrow();
  });

  it("should persist state to disk", () => {
    initBreaker(profileDir, 126, 1);
    openBreaker("persist test");
    const breakerPath = path.join(profileDir, "breaker.json");
    expect(fs.existsSync(breakerPath)).toBe(true);

    const content = fs.readFileSync(breakerPath, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.open).toBe(true);
    expect(parsed.reason).toBe("persist test");
  });

  it("should survive recreation", () => {
    initBreaker(profileDir, 127, 1);
    openBreaker("survive test");

    initBreaker(profileDir, 127, 1);
    expect(isOpen()).toBe(true);
  });

  it("should reset with confirmation", () => {
    initBreaker(profileDir, 128, 1);
    openBreaker("reset test");
    resetBreaker(true);
    expect(isOpen()).toBe(false);
  });

  it("should throw on reset without confirmation", () => {
    initBreaker(profileDir, 129, 1);
    openBreaker("reset test");
    expect(() => resetBreaker(false)).toThrow("requires confirmation");
  });

  it("should record failures and successes", () => {
    initBreaker(profileDir, 130, 1);
    recordFailure();
    recordFailure();
    recordSuccess();
    const state = getBreakerState();
    expect(state.consecutiveFailures).toBeGreaterThan(0);
  });
});
