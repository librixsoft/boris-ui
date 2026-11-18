import { describe, it, expect } from "vitest";
import { operationalKpi } from "../../src/main/browser/human/kpi";
import { HumanTelemetryEvent } from "../../src/main/browser/human/telemetry";

describe("F8 KPI operational", () => {
  it("returns 0 challenges with no failures", () => {
    const events: HumanTelemetryEvent[] = [
      { ts: Date.now(), phase: "test", action: "read", routeClass: "feed", level: "balanced", durationMs: 100, success: true },
      { ts: Date.now(), phase: "test", action: "navigate", routeClass: "search", level: "balanced", durationMs: 100, success: true },
    ];
    const kpi = operationalKpi(events);
    expect(kpi.per100).toBe(0);
  });

  it("returns correct challenges count", () => {
    const events: HumanTelemetryEvent[] = [
      { ts: Date.now(), phase: "test", action: "write", routeClass: "messaging", level: "balanced", durationMs: 100, success: false, code: "BREAKER_OPEN" },
      { ts: Date.now(), phase: "test", action: "read", routeClass: "feed", level: "balanced", durationMs: 100, success: true },
    ];
    const kpi = operationalKpi(events);
    expect(kpi.per100).toBe(50);
  });

  it("aggregates by class", () => {
    const events: HumanTelemetryEvent[] = [
      { ts: Date.now(), phase: "test", action: "write", routeClass: "messaging", level: "balanced", durationMs: 100, success: false, code: "BREAKER_OPEN" },
      { ts: Date.now(), phase: "test", action: "write", routeClass: "messaging", level: "balanced", durationMs: 100, success: true },
      { ts: Date.now(), phase: "test", action: "read", routeClass: "feed", level: "balanced", durationMs: 100, success: true },
    ];
    const kpi = operationalKpi(events);
    expect(kpi.byClass.write).toBe(50);
    expect(kpi.byClass.read).toBe(0);
  });

  it("aggregates by level", () => {
    const events: HumanTelemetryEvent[] = [
      { ts: Date.now(), phase: "test", action: "write", routeClass: "messaging", level: "conservative", durationMs: 100, success: false, code: "BREAKER_OPEN" },
      { ts: Date.now(), phase: "test", action: "write", routeClass: "messaging", level: "balanced", durationMs: 100, success: true },
    ];
    const kpi = operationalKpi(events);
    expect(kpi.byLevel["conservative"]).toBe(100);
    expect(kpi.byLevel["balanced"]).toBe(0);
  });
});
