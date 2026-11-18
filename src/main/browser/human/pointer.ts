import { Page } from "playwright";
import { clamp, gaussian, lognormal, createRandomStreams } from "./random";
import { moveDurationMs, hoverDwellMs, clickHoldMs, fatigueMultiplier } from "./timing";

export interface Point {
  x: number;
  y: number;
}

export interface PointerConfig {
  profileSeed: number;
  sessionCounter: number;
  fatigue: number;
}

let lastPointer: Point | null = null;
let streams: { next(): number } | null = null;
let traits: { pointerSpeed: number; tremorSigma: number; overshootRate: number; aimErrorSigma: number; clickHoldMs: { min: number; max: number }; hoverMs: { min: number; max: number } } | null = null;

export function initPointer(profileSeed: number, sessionCounter: number): void {
  const randomStreams = createRandomStreams(profileSeed, sessionCounter);
  streams = randomStreams.stream;
  traits = {
    pointerSpeed: randomStreams.traitsObj.pointerSpeed,
    tremorSigma: randomStreams.traitsObj.tremorSigma,
    overshootRate: randomStreams.traitsObj.overshootRate,
    aimErrorSigma: randomStreams.traitsObj.aimErrorSigma,
    clickHoldMs: { min: randomStreams.traitsObj.clickHoldMs.min, max: randomStreams.traitsObj.clickHoldMs.max },
    hoverMs: { min: randomStreams.traitsObj.hoverMs.min, max: randomStreams.traitsObj.hoverMs.max },
  };
}

export function resetLastPointer(): void {
  lastPointer = null;
}

export function setLastPointer(x: number, y: number): void {
  lastPointer = { x, y };
}

export function getLastPointer(): Point | null {
  return lastPointer;
}

function initialPointerPosition(stream: { next(): number }): Point {
  return {
    x: 0.2 + stream.next() * 0.6,
    y: 0.2 + stream.next() * 0.6,
  };
}

function minimumJerk(t: number): number {
  const tt = clamp(t, 0, 1);
  return 10 * tt * tt * tt - 15 * tt * tt * tt * tt + 6 * tt * tt * tt * tt * tt;
}

function generateBezierPoints(from: Point, to: Point, stream: { next(): number }): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const offset = distance * (0.1 + stream.next() * 0.15);
  const px = -dy / (distance || 1);
  const py = dx / (distance || 1);

  const c1 = {
    x: from.x + dx / 3 + px * offset,
    y: from.y + dy / 3 + py * offset,
  };
  const c2 = {
    x: from.x + (2 * dx) / 3 + px * offset * (0.4 + stream.next() * 0.7),
    y: from.y + (2 * dy) / 3 + py * offset * (0.4 + stream.next() * 0.7),
  };

  return { c1, c2 } as any;
}

function sampleTrajectory(from: Point, to: Point, durationMs: number, stream: { next(): number }, tremorSigma: number, overshootRate: number): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  let overshootPoint: Point | null = null;
  if (distance >= 40 && stream.next() < overshootRate) {
    const overshootDistance = 5 + stream.next() * 13;
    overshootPoint = {
      x: to.x + (dx / (distance || 1)) * overshootDistance,
      y: to.y + (dy / (distance || 1)) * overshootDistance,
    };
  }

  const points: Point[] = [];
  const n = clamp(Math.round(durationMs / (7 + stream.next() * 5)), 8, 140);
  const delayMs = durationMs / n;

  let current = { ...from };
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const jerk = minimumJerk(t);

    let x = from.x + dx * jerk;
    let y = from.y + dy * jerk;

    if (i < n) {
      const noiseX = gaussian(0, tremorSigma, stream);
      const noiseY = gaussian(0, tremorSigma, stream);
      current.x = current.x * 0.55 + (x + noiseX) * 0.45;
      current.y = current.y * 0.55 + (y + noiseY) * 0.45;
      points.push({ x: current.x, y: current.y });
    } else {
      points.push({ x: to.x, y: to.y });
    }
  }

  if (overshootPoint) {
    const overshootDuration = 90 + stream.next() * 130;
    const overshootPoints = sampleTrajectory(to, overshootPoint, overshootDuration, stream, tremorSigma * 0.5, 0);
    points.push(...overshootPoints);
    const correctionDuration = 90 + stream.next() * 130;
    const correctionPoints = sampleTrajectory(overshootPoint, to, correctionDuration, stream, tremorSigma * 0.5, 0);
    points.push(...correctionPoints);
  }

  return points;
}

export async function mouseMoveHuman(page: Page, to: Point, config: PointerConfig, options?: { targetWidth?: number }): Promise<Point[]> {
  if (!streams || !traits) {
    throw new Error("Pointer not initialized");
  }

  const targetWidth = options?.targetWidth ?? 24;
  const fatigue = fatigueMultiplier(config.fatigue);

  let from: Point;
  if (lastPointer) {
    from = lastPointer;
  } else {
    const initial = initialPointerPosition(streams);
    from = {
      x: initial.x * (await getPageWidth(page)),
      y: initial.y * (await getPageHeight(page)),
    };
  }

  const distance = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
  const duration = moveDurationMs(distance, targetWidth, streams, traits, fatigue);

  const points = sampleTrajectory(from, to, duration, streams, traits.tremorSigma, traits.overshootRate);

  for (const point of points) {
    if (config.fatigue > 1000) break;
    await page.mouse.move(point.x, point.y);
    await new Promise((r) => setTimeout(r, duration / points.length));
  }

  lastPointer = { x: to.x, y: to.y };
  return points;
}

export async function mouseClickHuman(page: Page, to: Point, rect: { x: number; y: number; width: number; height: number }, config: PointerConfig): Promise<Point> {
  if (!streams || !traits) {
    throw new Error("Pointer not initialized");
  }

  const limX = clamp(Math.round(rect.width / 4), 1, 3);
  const limY = clamp(Math.round(rect.height / 4), 1, 3);
  const aimX = to.x + clamp(gaussian(0, traits.aimErrorSigma, streams), -limX, limX);
  const aimY = to.y + clamp(gaussian(0, traits.aimErrorSigma, streams), -limY, limY);

  const clampedX = clamp(aimX, rect.x, rect.x + rect.width);
  const clampedY = clamp(aimY, rect.y, rect.y + rect.height);

  const hover = hoverDwellMs(streams, { hoverMs: traits.hoverMs });
  await new Promise((r) => setTimeout(r, hover));

  await page.mouse.move(clampedX, clampedY);
  await page.mouse.down();

  const hold = clickHoldMs(streams, { clickHoldMs: traits.clickHoldMs });
  await new Promise((r) => setTimeout(r, hold));

  await page.mouse.up();

  lastPointer = { x: clampedX, y: clampedY };
  return { x: clampedX, y: clampedY };
}

export async function mouseDoubleClickHuman(page: Page, to: Point, rect: { x: number; y: number; width: number; height: number }, config: PointerConfig): Promise<void> {
  await mouseClickHuman(page, to, rect, config);
  const interval = 70 + Math.random() * 110;
  await new Promise((r) => setTimeout(r, interval));
  await mouseClickHuman(page, to, rect, config);
}

async function getPageWidth(page: Page): Promise<number> {
  try {
    return await page.evaluate(() => window.innerWidth || 1280);
  } catch {
    return 1280;
  }
}

async function getPageHeight(page: Page): Promise<number> {
  try {
    return await page.evaluate(() => window.innerHeight || 800);
  } catch {
    return 800;
  }
}
