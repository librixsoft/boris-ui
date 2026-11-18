export class Prng {
  private state: number;

  constructor(seed: number) {
    const s = seed >>> 0;
    this.state = s === 0 ? 0x9e3779b9 : s;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export function hashSeed(...values: number[]): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] >>> 0;
    h ^= v;
    h = Math.imul(h, 16777619);
    h = h >>> 0;
  }
  return h >>> 0;
}

export interface RandomTraits {
  typingMedianMs: number;
  typingSigma: number;
  mistakeRate: number;
  burstRate: number;
  pointerSpeed: number;
  tremorSigma: number;
  overshootRate: number;
  aimErrorSigma: number;
  clickHoldMs: { min: number; max: number };
  hoverMs: { min: number; max: number };
}

export interface RandomStreams {
  traits: Prng;
  stream: Prng;
  traitsObj: RandomTraits;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function range(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function int(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function chance(p: number): boolean {
  if (p < 0 || p > 1) {
    throw new Error(`chance() p must be in [0,1], got ${p}`);
  }
  return Math.random() < p;
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function choiceWeighted<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function boxMuller(stream: { next(): number }): [number, number] {
  const u1 = 1 - stream.next();
  const u2 = 1 - stream.next();
  const r = Math.sqrt(-2 * Math.log(u1));
  const theta = 2 * Math.PI * u2;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

export function gaussian(mean: number, stdDev: number, stream: { next(): number }): number {
  const [z] = boxMuller(stream);
  return mean + z * stdDev;
}

export function lognormal(median: number, sigma: number, stream: { next(): number }): number {
  const mu = Math.log(median);
  const s = sigma;
  const u1 = 1 - stream.next();
  const u2 = 1 - stream.next();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const result = Math.exp(mu + s * z);
  return result;
}

export function beta(alpha: number, betaParam: number, stream: { next(): number }): number {
  const ga = gamma(alpha, stream);
  const gb = gamma(betaParam, stream);
  return ga / (ga + gb);
}

function gamma(shape: number, stream: { next(): number }): number {
  if (shape < 1) {
    return gamma(shape + 1, stream) * Math.pow(stream.next(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    const [z, ] = boxMuller(stream);
    const v = 1 + c * z;
    if (v <= 0) continue;
    const v3 = v * v * v;
    const u = stream.next();
    if (u < 1 - 0.0331 * (z * z) * (z * z)) return d * v3;
    if (Math.log(u) > 0.5 * z * z + d * (1 - v3 + Math.log(v3))) continue;
    return d * v3;
  }
}

export function createRandomStreams(profileSeed: number, sessionCounter: number): RandomStreams {
  const traitsPrng = new Prng(hashSeed(profileSeed, 0x1b873593));
  const streamPrng = new Prng(hashSeed(profileSeed, sessionCounter, 0xcc9e2d51));

  const traitsObj = deriveTraits(traitsPrng);

  return {
    traits: traitsPrng,
    stream: streamPrng,
    traitsObj,
  };
}

function deriveTraits(prng: Prng): RandomTraits {
  const typingMedianMs = clamp(gaussian(110, 15, prng), 90, 130);
  const typingSigma = clamp(gaussian(0.44, 0.06, prng), 0.38, 0.5);
  const mistakeRate = clamp(gaussian(0.02, 0.004, prng), 0.015, 0.025);
  const burstRate = clamp(gaussian(0.175, 0.025, prng), 0.15, 0.2);
  const pointerSpeed = clamp(gaussian(1, 0.1, prng), 0.85, 1.15);
  const tremorSigma = clamp(gaussian(0.65, 0.15, prng), 0.4, 0.9);
  const overshootRate = clamp(gaussian(0.16, 0.04, prng), 0.12, 0.2);
  const aimErrorSigma = clamp(gaussian(1.5, 0.3, prng), 1.1, 1.9);
  const clickHoldMin = clamp(gaussian(65, 10, prng), 55, 75);
  const clickHoldMax = clamp(gaussian(120, 15, prng), 100, 140);
  const hoverMin = clamp(gaussian(170, 30, prng), 140, 200);
  const hoverMax = clamp(gaussian(385, 55, prng), 320, 450);

  return {
    typingMedianMs,
    typingSigma,
    mistakeRate,
    burstRate,
    pointerSpeed,
    tremorSigma,
    overshootRate,
    aimErrorSigma,
    clickHoldMs: { min: clickHoldMin, max: clickHoldMax },
    hoverMs: { min: hoverMin, max: hoverMax },
  };
}
