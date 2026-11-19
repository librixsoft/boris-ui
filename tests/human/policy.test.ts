import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initPolicy, beforeAction, afterAction, getPolicyStatus } from "../../src/main/browser/human/policy";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("F3 policy caps", () => {
  let profileDir: string;

  beforeEach(() => {
    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "boris-f3-"));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should enforce per-session write cap", () => {
    initPolicy({
      level: "conservative",
      profileSeed: 123,
      sessionCounter: 1,
      profileDir,
      dryRun: false,
      sessionWarmupMs: 0,
      activeHours: { start: 8, end: 23, timezone: "UTC" },
      fatigueHalfLifeActions: 220,
    });

    beforeAction("read");
    afterAction("read", true);

    for (let i = 0; i < 3; i++) {
      beforeAction("read");
      afterAction("read", true);
      beforeAction("write");
      afterAction("write", true);
    }

    expect(() => beforeAction("write")).toThrow("Budget exceeded");
  });

  it("should enforce per-hour cap", () => {
    initPolicy({
      level: "conservative",
      profileSeed: 124,
      sessionCounter: 1,
      profileDir,
      dryRun: false,
      sessionWarmupMs: 0,
      activeHours: { start: 8, end: 23, timezone: "UTC" },
      fatigueHalfLifeActions: 220,
    });

    const hour = Math.floor(Date.now() / 3600000);
    for (let i = 0; i < 40; i++) {
      beforeAction("read");
      afterAction("read", true);
    }

    expect(() => beforeAction("read")).toThrow("Budget exceeded");
  });

  it("should enforce active hours", () => {
    initPolicy({
      level: "conservative",
      profileSeed: 125,
      sessionCounter: 1,
      profileDir,
      dryRun: false,
      sessionWarmupMs: 0,
      activeHours: { start: 8, end: 23, timezone: "UTC" },
      fatigueHalfLifeActions: 220,
    });

    const now = new Date();
    const outsideHour = now.getUTCHours() < 22 ? 3 : 23;
    now.setUTCHours(outsideHour, 0, 0, 0);
    vi.setSystemTime(now.getTime());
    expect(() => beforeAction("read")).toThrow();
  });

  it("should apply ramp-up multiplier for write", () => {
    initPolicy({
      level: "conservative",
      profileSeed: 126,
      sessionCounter: 1,
      profileDir,
      dryRun: false,
      sessionWarmupMs: 0,
      activeHours: { start: 8, end: 23, timezone: "UTC" },
      fatigueHalfLifeActions: 220,
    });

    const status = getPolicyStatus();
    expect(status?.rampUpWeek).toBe(4);
  });

  it("should enforce action gap", () => {
    initPolicy({
      level: "aggressive",
      profileSeed: 127,
      sessionCounter: 1,
      profileDir,
      dryRun: false,
      sessionWarmupMs: 0,
      activeHours: { start: 8, end: 23, timezone: "UTC" },
      fatigueHalfLifeActions: 220,
    });

    beforeAction("read");
    afterAction("read", true);

    vi.setSystemTime(new Date(Date.now() + 100));
    beforeAction("navigate");
  });
});

describe("F3 policy consecutive write", () => {
  let profileDir: string;

  beforeEach(() => {
    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "boris-f3-conc-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should require read between writes", () => {
    initPolicy({
      level: "balanced",
      profileSeed: 128,
      sessionCounter: 1,
      profileDir,
      dryRun: false,
      sessionWarmupMs: 0,
      activeHours: { start: 8, end: 23, timezone: "UTC" },
      fatigueHalfLifeActions: 220,
    });

    beforeAction("read");
    afterAction("read", true);
    beforeAction("write");
    afterAction("write", true);

    expect(() => beforeAction("write")).toThrow();
  });
});
