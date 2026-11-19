import { describe, it, expect, afterEach, afterAll } from "vitest";
import { recordHumanEvent, readTelemetryEvents, clearTelemetry } from "../../src/main/browser/human/telemetry";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("F0 telemetry PII", () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "boris-tele-"));
  const testPath = path.join(testDir, "test-telemetry.jsonl");

  afterAll(() => {
    fs.rmdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.unlinkSync(testPath);
    } catch {
      // ignore
    }
  });

  it("should not contain PII in telemetry events", () => {
    recordHumanEvent({
      ts: Date.now(),
      phase: "test",
      action: "write",
      routeClass: "messaging",
      level: "balanced",
      durationMs: 1500,
      success: true,
      code: "APPROVAL_REQUIRED",
      metrics: { keystrokes: 42 },
    }, testPath);

    const content = fs.readFileSync(testPath, "utf-8");
    const lowerContent = content.toLowerCase();

    expect(lowerContent).not.toContain("http");
    expect(lowerContent).not.toContain("@");
    expect(lowerContent).not.toMatch(/message.*=.*["'][^"']*["']/i);
  });

  it("should read and parse telemetry events", () => {
    clearTelemetry(testPath);

    recordHumanEvent({
      ts: Date.now(),
      phase: "test",
      action: "read",
      routeClass: "feed",
      level: "conservative",
      durationMs: 500,
      success: true,
    }, testPath);

    recordHumanEvent({
      ts: Date.now(),
      phase: "test",
      action: "navigate",
      routeClass: "search",
      level: "conservative",
      durationMs: 200,
      success: false,
      code: "BUDGET_EXCEEDED",
    }, testPath);

    const events = readTelemetryEvents(testPath);
    expect(events).toHaveLength(2);
    expect(events[0].action).toBe("read");
    expect(events[1].action).toBe("navigate");
    expect(events[1].code).toBe("BUDGET_EXCEEDED");
  });

  it("should return empty array when file does not exist", () => {
    const nonexistent = path.join(testDir, "nonexistent-telemetry.jsonl");
    const events = readTelemetryEvents(nonexistent);
    expect(events).toHaveLength(0);
  });
});
