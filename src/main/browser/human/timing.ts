import { clamp, lognormal, gaussian } from "./random";

export interface RandomStream {
  next(): number;
}

const LEFT_HAND = new Set("qwertasdfgzxcvb".split(""));
const RIGHT_HAND = new Set("yuiophjklñnm".split(""));

function getHand(char: string): "left" | "right" | "other" {
  const c = char.toLowerCase();
  if (LEFT_HAND.has(c)) return "left";
  if (RIGHT_HAND.has(c)) return "right";
  return "other";
}

export function bigramFactor(prev: string, next: string): number {
  const prevHand = getHand(prev);
  const nextHand = getHand(next);
  if (prevHand === "other" || nextHand === "other") return 1;
  if (prevHand !== nextHand) return 0.9;
  if (prevHand === prevHand) return 1.12;
  return 1;
}

export function reactionMs(stream: RandomStream): number {
  return clamp(lognormal(220, 0.32, stream), 90, 900);
}

export function interKeyDelayMs(
  stream: RandomStream,
  traits: { typingMedianMs: number; typingSigma: number },
  prev: string,
  next: string,
  fatigue: number,
  speed: number = 1
): number {
  const bf = bigramFactor(prev, next);
  const median = traits.typingMedianMs * bf * fatigue * speed;
  return clamp(lognormal(median, traits.typingSigma, stream), 22, 720);
}

export function thinkPauseMs(stream: RandomStream): number {
  if (!chanceGeneric(0.03, stream)) return 0;
  const pause = rangeGeneric(400, 1800, stream);
  if (chanceGeneric(0.1, stream)) {
    return rangeGeneric(3000, 8000, stream);
  }
  return pause;
}

export function clickHoldMs(stream: RandomStream, traits: { clickHoldMs: { min: number; max: number } }): number {
  return clamp(rangeGeneric(traits.clickHoldMs.min, traits.clickHoldMs.max, stream), 45, 180);
}

export function hoverDwellMs(stream: RandomStream, traits: { hoverMs: { min: number; max: number } }): number {
  return rangeGeneric(traits.hoverMs.min, traits.hoverMs.max, stream);
}

export function moveDurationMs(
  distance: number,
  targetWidth: number,
  stream: RandomStream,
  traits: { pointerSpeed: number },
  fatigue: number
): number {
  const w = Math.max(targetWidth, 8);
  const base = (120 + 150 * Math.log2(distance / w + 1)) / traits.pointerSpeed;
  const withFatigue = base * fatigue;
  return clamp(withFatigue, 280, 1400);
}

export function actionGapMs(
  level: "conservative" | "balanced" | "aggressive",
  stream: RandomStream
): number {
  let min: number, max: number;
  switch (level) {
    case "conservative":
      min = 3000;
      max = 9000;
      break;
    case "balanced":
      min = 1500;
      max = 5000;
      break;
    case "aggressive":
      min = 800;
      max = 3000;
      break;
  }
  const median = (min + max) / 2;
  const raw = clamp(lognormal(median, 0.35, stream), min, max * 3);
  return raw;
}

export function breakMs(stream: RandomStream): number {
  return rangeGeneric(300000, 900000, stream);
}

export function fatigueMultiplier(n: number): number {
  return clamp(1 + 0.6 * (1 - Math.exp(-n / 220)), 1, 1.6);
}

export function burstDelayMs(stream: RandomStream): number {
  return rangeGeneric(25, 50, stream);
}

export function backspaceBurstDelayMs(stream: RandomStream): number {
  return rangeGeneric(60, 110, stream);
}

export function correctionPauseMs(stream: RandomStream): number {
  return rangeGeneric(80, 220, stream);
}

function chanceGeneric(p: number, stream: RandomStream): boolean {
  return stream.next() < p;
}

function rangeGeneric(min: number, max: number, stream: RandomStream): number {
  return min + stream.next() * (max - min);
}
