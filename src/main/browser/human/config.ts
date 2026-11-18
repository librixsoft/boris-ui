export type HumanLevel = "off" | "conservative" | "balanced" | "aggressive";

export interface HumanConfig {
  level: HumanLevel;
  profileId: string;
  profileSeed: number;
  sessionCounter: number;
  profileDir: string;
  fingerprintMode: "real-window" | "pinned-viewport";
  viewport?: { width: number; height: number };
  deviceScaleFactor?: number;
  locale?: string;
  timezoneId?: string;
  diagnosticUserAgent?: string;
  behavior: {
    minActionGapMs: number;
    caps: Record<ActionClass, { perHour: number; perDay: number; perSession: number }>;
    sessionWarmupMs: number;
    sessionLengthMin: { min: number; max: number };
    sessionGapMin: { min: number; max: number };
    breakEveryActions: { min: number; max: number };
    breakDurationMs: { min: number; max: number };
    activeHours: { start: number; end: number; timezone: string };
    fatigueHalfLifeActions: number;
    accountRampUp: RampUpSchedule;
  };
  approval: {
    write: "required" | "first-n" | "off";
    firstN?: number;
  };
  safety: {
    stopOnSoftBlock: boolean;
    cooldownOnSoftBlockMs: { min: number; max: number };
    maxConsecutiveFailures: number;
    failClosedOnUnknown: boolean;
    dryRun: boolean;
  };
}

export type ActionClass = "read" | "navigate" | "write";

export interface RampUpSchedule {
  week1: { read: number; navigate: number; write: number };
  week2: { read: number; navigate: number; write: number };
  week3: { read: number; navigate: number; write: number };
  week4: { read: number; navigate: number; write: number };
}

export const DEFAULT_RAMP_UP: RampUpSchedule = {
  week1: { read: 40, navigate: 20, write: 0 },
  week2: { read: 80, navigate: 40, write: 2 },
  week3: { read: 160, navigate: 80, write: 4 },
  week4: { read: 320, navigate: 160, write: 10 },
};

export const CAPS_BY_LEVEL: Record<HumanLevel, Record<ActionClass, { perHour: number; perDay: number; perSession: number }>> = {
  off: {
    read: { perHour: Infinity, perDay: Infinity, perSession: Infinity },
    navigate: { perHour: Infinity, perDay: Infinity, perSession: Infinity },
    write: { perHour: Infinity, perDay: Infinity, perSession: Infinity },
  },
  conservative: {
    read: { perHour: 40, perDay: 250, perSession: Infinity },
    navigate: { perHour: 20, perDay: 120, perSession: Infinity },
    write: { perHour: 3, perDay: 10, perSession: 3 },
  },
  balanced: {
    read: { perHour: 80, perDay: 600, perSession: Infinity },
    navigate: { perHour: 40, perDay: 300, perSession: Infinity },
    write: { perHour: 6, perDay: 20, perSession: 6 },
  },
  aggressive: {
    read: { perHour: 140, perDay: 1000, perSession: Infinity },
    navigate: { perHour: 70, perDay: 500, perSession: Infinity },
    write: { perHour: 10, perDay: 40, perSession: 10 },
  },
};

export function resolveHumanLevel(level: HumanLevel, callHuman?: boolean): HumanLevel {
  if (level === "off") {
    if (callHuman === true) return "conservative";
    return "off";
  }
  if (callHuman === false) return level;
  return level;
}

export function assertHumanLevel(value: string): HumanLevel {
  const valid: HumanLevel[] = ["off", "conservative", "balanced", "aggressive"];
  if (!valid.includes(value as HumanLevel)) {
    throw new Error(`Nivel de humanización inválido: "${value}". Valores válidos: ${valid.join(", ")}`);
  }
  return value as HumanLevel;
}

export function getHumanLevelFromEnv(): HumanLevel {
  const env = process.env.BORIS_HUMAN_LEVEL;
  if (!env) return "off";
  return assertHumanLevel(env);
}

export function getProfileSeedFromEnv(): number {
  const env = process.env.BORIS_HUMAN_SEED;
  if (!env) return 0x51ed2701;
  const parsed = parseInt(env, 10);
  return isNaN(parsed) ? 0x51ed2701 : parsed;
}

export function getProfileDirFromEnv(): string | undefined {
  return process.env.BORIS_HUMAN_PROFILE_DIR;
}

export function getDryRunFromEnv(): boolean {
  return process.env.BORIS_HUMAN_DRY_RUN === "1";
}

export function getDefaultConfig(): HumanConfig {
  const level = getHumanLevelFromEnv();
  const profileSeed = getProfileSeedFromEnv();
  const dryRun = getDryRunFromEnv();

  return {
    level,
    profileId: `profile-${profileSeed}`,
    profileSeed,
    sessionCounter: 0,
    profileDir: getProfileDirFromEnv() ?? "",
    fingerprintMode: "real-window",
    behavior: {
      minActionGapMs: 500,
      caps: CAPS_BY_LEVEL[level],
      sessionWarmupMs: level === "conservative" ? 120000 : level === "balanced" ? 90000 : 60000,
      sessionLengthMin: { min: 600000, max: 2400000 },
      sessionGapMin: { min: 7200000, max: 28800000 },
      breakEveryActions: { min: 8, max: 15 },
      breakDurationMs: { min: 300000, max: 900000 },
      activeHours: { start: 8, end: 23, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      fatigueHalfLifeActions: 220,
      accountRampUp: DEFAULT_RAMP_UP,
    },
    approval: {
      write: "required",
    },
    safety: {
      stopOnSoftBlock: true,
      cooldownOnSoftBlockMs: { min: 1800000, max: 7200000 },
      maxConsecutiveFailures: 5,
      failClosedOnUnknown: true,
      dryRun,
    },
  };
}
