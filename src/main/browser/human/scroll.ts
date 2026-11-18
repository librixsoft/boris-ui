import { Page } from "playwright";
import { RandomStream } from "./timing";
import { createRandomStreams } from "./random";

export interface ScrollConfig {
  profileSeed: number;
  sessionCounter: number;
}

export async function mouseWheelHuman(
  page: Page,
  totalDeltaY: number,
  config: ScrollConfig,
  stream: RandomStream
): Promise<void> {
  const randomStreams = createRandomStreams(config.profileSeed, config.sessionCounter);
  const s = randomStreams.stream;

  const direction = Math.sign(totalDeltaY);
  let remaining = Math.abs(totalDeltaY);
  let step = clamp(gaussian(120, 28, s), 80, 180);

  while (remaining > 0.5) {
    const applied = Math.min(remaining, Math.round(step));
    await page.mouse.wheel(0, direction * applied);
    const delay = rangeGeneric(45, 180, s);
    await new Promise((r) => setTimeout(r, delay));
    remaining -= applied;
    step = Math.max(35, step * rangeGeneric(0.72, 0.88, s));

    if (chanceGeneric(0.16, s)) {
      const reversalDelta = direction * rangeGeneric(10, 40, s);
      await page.mouse.wheel(0, -reversalDelta);
      const delay = rangeGeneric(80, 220, s);
      await new Promise((r) => setTimeout(r, delay));
    }

    if (chanceGeneric(0.1, s)) {
      const pause = rangeGeneric(300, 900, s);
      await new Promise((r) => setTimeout(r, pause));
    }
  }

  const lastDelta = direction * Math.round(step);
  await page.mouse.wheel(0, lastDelta);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function gaussian(mean: number, stdDev: number, stream: RandomStream): number {
  const u1 = 1 - stream.next();
  const u2 = 1 - stream.next();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

function rangeGeneric(min: number, max: number, stream: RandomStream): number {
  return min + stream.next() * (max - min);
}

function chanceGeneric(p: number, stream: RandomStream): boolean {
  return stream.next() < p;
}
