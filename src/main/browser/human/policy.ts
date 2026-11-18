import { ActionClass, CAPS_BY_LEVEL } from "./config";
import { initBreaker, assertClosed, recordFailure, recordSuccess, getBreakerState, BreakerState } from "./breaker";
import { actionGapMs, fatigueMultiplier } from "./timing";
import { createRandomStreams } from "./random";
import { recordHumanEvent } from "./telemetry";
import { DeferredError, BudgetExceededError, OutsideActiveHoursError } from "./codes";
import * as os from "node:os";

export interface PolicyConfig {
  level: "conservative" | "balanced" | "aggressive";
  profileSeed: number;
  sessionCounter: number;
  profileDir: string;
  dryRun: boolean;
  sessionWarmupMs: number;
  activeHours: { start: number; end: number; timezone: string };
  fatigueHalfLifeActions: number;
}

interface ActionBudget {
  read: { hour: Map<number, number>; day: Map<number, number>; session: number };
  navigate: { hour: Map<number, number>; day: Map<number, number>; session: number };
  write: { hour: Map<number, number>; day: Map<number, number>; session: number };
}

interface PolicyState {
  budgets: ActionBudget;
  fatigue: number;
  actionsThisSession: number;
  lastActionTime: number;
  sessionStart: number;
  lastReadAction: number;
  lastWriteAction: number;
  lastActionClass: ActionClass | null;
  rampUpWeek: number;
}

let policyState: PolicyState | null = null;
let streams: { next(): number } | null = null;
let config: PolicyConfig | null = null;

export function initPolicy(cfg: PolicyConfig): void {
  config = cfg;
  initBreaker(cfg.profileDir, cfg.profileSeed, cfg.sessionCounter);
  const randomStreams = createRandomStreams(cfg.profileSeed, cfg.sessionCounter);
  streams = randomStreams.stream;

  const now = Date.now();
  policyState = {
    budgets: createInitialBudgets(cfg.level),
    fatigue: 1,
    actionsThisSession: 0,
    lastActionTime: 0,
    sessionStart: now,
    lastReadAction: 0,
    lastWriteAction: 0,
    lastActionClass: null,
    rampUpWeek: calculateRampUpWeek(cfg.profileSeed),
  };
}

function createInitialBudgets(level: "conservative" | "balanced" | "aggressive"): ActionBudget {
  const caps = CAPS_BY_LEVEL[level];
  const now = Date.now();
  const hour = Math.floor(now / 3600000);
  const day = Math.floor(now / 86400000);

  return {
    read: {
      hour: new Map([[hour, 0]]),
      day: new Map([[day, 0]]),
      session: 0,
    },
    navigate: {
      hour: new Map([[hour, 0]]),
      day: new Map([[day, 0]]),
      session: 0,
    },
    write: {
      hour: new Map([[hour, 0]]),
      day: new Map([[day, 0]]),
      session: 0,
    },
  };
}

function calculateRampUpWeek(profileSeed: number): number {
  return 4;
}

function getRampUpMultiplier(week: number): number {
  if (week >= 4) return 1;
  if (week === 3) return 0.5;
  if (week === 2) return 0.25;
  return 0;
}

export function beforeAction(actionClass: ActionClass): void {
  if (!policyState || !streams || !config) {
    return;
  }

  assertClosed();

  const now = Date.now();
  const { start, end } = config.activeHours;
  const date = new Date(now);
  const currentHour = date.getHours();
  if (currentHour < start || currentHour >= end) {
    const nextStart = new Date(now);
    nextStart.setHours(start, 0, 0, 0);
    if (nextStart.getTime() <= now) {
      nextStart.setDate(nextStart.getDate() + 1);
    }
    throw new OutsideActiveHoursError(nextStart.getTime());
  }

  const caps = CAPS_BY_LEVEL[config.level];
  const budget = policyState.budgets[actionClass];
  const hour = Math.floor(now / 3600000);
  const day = Math.floor(now / 86400000);

  budget.hour.set(hour, budget.hour.get(hour) ?? 0);
  budget.day.set(day, budget.day.get(day) ?? 0);

  const rampMultiplier = getRampUpMultiplier(policyState.rampUpWeek);
  const effectiveWriteCap = actionClass === "write"
    ? Math.floor(caps.write.perSession * rampMultiplier)
    : caps[actionClass].perSession;

  if (budget.session >= effectiveWriteCap) {
    const retryAt = now + 3600000;
    throw new BudgetExceededError(actionClass, retryAt);
  }

  if (budget.hour.get(hour)! >= caps[actionClass].perHour) {
    const retryAt = (hour + 1) * 3600000;
    throw new BudgetExceededError(actionClass, retryAt);
  }

  if (budget.day.get(day)! >= caps[actionClass].perDay) {
    const retryAt = (day + 1) * 86400000;
    throw new BudgetExceededError(actionClass, retryAt);
  }

  if (actionClass === "write") {
    if (policyState.actionsThisSession === 0) {
      const retryAt = now + 5000;
      throw new BudgetExceededError(actionClass, retryAt);
    }
    if (policyState.lastActionClass === "write") {
      const retryAt = now + 5000;
      throw new BudgetExceededError(actionClass, retryAt);
    }
  }

  const gapMs = actionGapMs(config.level, streams);
  const timeSinceLastAction = now - policyState.lastActionTime;
  if (timeSinceLastAction < gapMs && policyState.lastActionTime > 0) {
    const waitMs = gapMs - timeSinceLastAction;
    if (waitMs > 20000) {
      const retryAt = now + waitMs;
      throw new DeferredError(retryAt);
    } else {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      sleep(waitMs).then(() => {});
    }
  }

  policyState.fatigue = fatigueMultiplier(policyState.actionsThisSession);
}

export function afterAction(actionClass: ActionClass, success: boolean): void {
  if (!policyState || !config) {
    return;
  }

  if (success) {
    recordSuccess();
    policyState.budgets[actionClass].session++;
    const hour = Math.floor(Date.now() / 3600000);
    const day = Math.floor(Date.now() / 86400000);
    policyState.budgets[actionClass].hour.set(hour, (policyState.budgets[actionClass].hour.get(hour) ?? 0) + 1);
    policyState.budgets[actionClass].day.set(day, (policyState.budgets[actionClass].day.get(day) ?? 0) + 1);
    policyState.actionsThisSession++;
    policyState.lastActionTime = Date.now();

    if (actionClass === "read") {
      policyState.lastReadAction = Date.now();
    }
    if (actionClass === "write") {
      policyState.lastWriteAction = Date.now();
    }
    policyState.lastActionClass = actionClass;
  } else {
    recordFailure();
  }

  recordHumanEvent({
    ts: Date.now(),
    phase: "policy",
    action: actionClass,
    routeClass: "other",
    level: config.level,
    durationMs: Date.now() - policyState.lastActionTime,
    success,
  });
}

export function getPolicyStatus() {
  if (!policyState || !config) {
    return null;
  }

  const breakerState = getBreakerState();
  const caps = CAPS_BY_LEVEL[config.level];
  const now = Date.now();
  const hour = Math.floor(now / 3600000);
  const day = Math.floor(now / 86400000);

  return {
    level: config.level,
    remaining: {
      read: {
        perHour: Math.max(0, caps.read.perHour - (policyState.budgets.read.hour.get(hour) ?? 0)),
        perDay: Math.max(0, caps.read.perDay - (policyState.budgets.read.day.get(day) ?? 0)),
      },
      navigate: {
        perHour: Math.max(0, caps.navigate.perHour - (policyState.budgets.navigate.hour.get(hour) ?? 0)),
        perDay: Math.max(0, caps.navigate.perDay - (policyState.budgets.navigate.day.get(day) ?? 0)),
      },
      write: {
        perSession: Math.max(0, caps.write.perSession - policyState.budgets.write.session),
      },
    },
    breakerOpen: breakerState.open,
    rampUpWeek: policyState.rampUpWeek,
    fatigue: policyState.fatigue,
  };
}
