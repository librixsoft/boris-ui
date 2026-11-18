import { HumanTelemetryEvent } from "./telemetry";

export interface OperationalKpi {
  per100: number;
  byClass: Record<"read" | "navigate" | "write", number>;
  byLevel: Record<string, number>;
}

export function operationalKpi(events: HumanTelemetryEvent[]): OperationalKpi {
  const failureCodes = ["BREAKER_OPEN", "APPROVAL_REQUIRED"];
  const failures = events.filter(
    (e) => failureCodes.includes(e.code ?? "") || (!e.success && e.metrics?.challenge === 1)
  );

  const totalActions = events.length;
  const per100 = totalActions > 0 ? (failures.length / totalActions) * 100 : 0;

  const byClass: Record<"read" | "navigate" | "write", number> = { read: 0, navigate: 0, write: 0 };
  for (const action of ["read", "navigate", "write"] as const) {
    const actionEvents = events.filter((e) => e.action === action);
    const actionFailures = failures.filter((e) => e.action === action);
    byClass[action] = actionEvents.length > 0 ? (actionFailures.length / actionEvents.length) * 100 : 0;
  }

  const byLevel: Record<string, number> = {};
  const levels = [...new Set(events.map((e) => e.level))];
  for (const level of levels) {
    const levelEvents = events.filter((e) => e.level === level);
    const levelFailures = failures.filter((e) => e.level === level);
    byLevel[level] = levelEvents.length > 0 ? (levelFailures.length / levelEvents.length) * 100 : 0;
  }

  return { per100, byClass, byLevel };
}
