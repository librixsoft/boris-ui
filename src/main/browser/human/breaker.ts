import * as fs from "node:fs";
import * as path from "node:path";
import { BreakerOpenError } from "./codes";
import { createRandomStreams, Prng } from "./random";

export interface BreakerState {
  open: boolean;
  openedAt: number;
  cooldownUntil: number;
  reason: string;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

const DEFAULT_STATE: BreakerState = {
  open: false,
  openedAt: 0,
  cooldownUntil: 0,
  reason: "",
  consecutiveFailures: 0,
  consecutiveSuccesses: 0,
};

function getBreakerPath(profileDir: string): string {
  return path.join(profileDir, "breaker.json");
}

function loadState(profileDir: string): BreakerState {
  const breakerPath = getBreakerPath(profileDir);
  try {
    const content = fs.readFileSync(breakerPath, "utf-8");
    const parsed = JSON.parse(content) as BreakerState;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(profileDir: string, state: BreakerState): void {
  const breakerPath = getBreakerPath(profileDir);
  const tmpPath = breakerPath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2));
  fs.renameSync(tmpPath, breakerPath);
}

let state: BreakerState;
let profileDir: string;
let streamPrng: Prng | null = null;

export function initBreaker(dir: string, profileSeed: number, sessionCounter: number): void {
  profileDir = dir;
  state = loadState(dir);
  const streams = createRandomStreams(profileSeed, sessionCounter);
  streamPrng = streams.stream;
}

export function openBreaker(reason: string, cooldownMs?: number): void {
  if (!streamPrng) {
    throw new Error("Breaker not initialized");
  }
  state.open = true;
  state.openedAt = Date.now();
  state.cooldownUntil = Date.now() + (cooldownMs ?? streamPrng.next() * (120 * 60 * 1000 - 30 * 60 * 1000) + 30 * 60 * 1000);
  state.reason = reason;
  state.consecutiveFailures++;
  saveState(profileDir, state);
}

export function isOpen(now?: number): boolean {
  const checkNow = now ?? Date.now();
  if (!state.open) return false;
  if (checkNow < state.cooldownUntil) return true;
  state.open = false;
  saveState(profileDir, state);
  return false;
}

export function assertClosed(now?: number): void {
  if (isOpen(now)) {
    const retryAt = state.cooldownUntil;
    throw new BreakerOpenError(retryAt);
  }
}

export function resetBreaker(confirm: boolean): void {
  if (confirm !== true) {
    throw new Error("Breaker reset requires confirmation");
  }
  state.open = false;
  state.consecutiveFailures = 0;
  state.consecutiveSuccesses = 0;
  saveState(profileDir, state);
}

export function recordFailure(): void {
  state.consecutiveFailures++;
  state.consecutiveSuccesses = 0;
  saveState(profileDir, state);
}

export function recordSuccess(): void {
  state.consecutiveSuccesses++;
  state.consecutiveFailures = Math.max(0, state.consecutiveFailures - 1);
  saveState(profileDir, state);
}

export function getBreakerState(): BreakerState {
  return { ...state };
}
