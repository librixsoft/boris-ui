import { describe, it, expect } from "vitest";
import { createRandomStreams } from "../../src/main/browser/human/random";
import { moveDurationMs, fatigueMultiplier } from "../../src/main/browser/human/timing";

describe("F4 pointer trajectory properties", () => {
  it("first point is near from position", () => {
    const { stream, traitsObj } = createRandomStreams(4001, 1);
    const from = { x: 100, y: 100 };
    const to = { x: 200, y: 200 };
    const distance = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
    const duration = moveDurationMs(distance, 24, stream, traitsObj, 1);
    expect(duration).toBeGreaterThan(280);
  });

  it("duration is correlated with distance", () => {
    const { stream, traitsObj } = createRandomStreams(4002, 2);
    const durations: number[] = [];
    const distances = [50, 100, 200, 400, 600];
    for (const d of distances) {
      durations.push(moveDurationMs(d, 24, stream, traitsObj, 1));
    }
    for (let i = 1; i < durations.length; i++) {
      expect(durations[i]).toBeGreaterThanOrEqual(durations[i - 1] * 0.9);
    }
  });

  it("fatigue increases duration", () => {
    const { stream, traitsObj } = createRandomStreams(4003, 3);
    const normal = moveDurationMs(200, 24, stream, traitsObj, 1);
    const fatigued = moveDurationMs(200, 24, stream, traitsObj, 1.5);
    expect(fatigued).toBeGreaterThan(normal);
  });

  it("duration is clamped to [280, 1400]", () => {
    const { stream, traitsObj } = createRandomStreams(4004, 4);
    for (let i = 0; i < 50; i++) {
      const dur = moveDurationMs(10 + i * 10, 24, stream, traitsObj, 1);
      expect(dur).toBeGreaterThanOrEqual(280);
      expect(dur).toBeLessThanOrEqual(1400);
    }
  });

  it("fatigue multiplier caps at 1.6", () => {
    expect(fatigueMultiplier(0)).toBe(1);
    expect(fatigueMultiplier(1000)).toBeLessThanOrEqual(1.6);
    expect(fatigueMultiplier(10000)).toBeLessThanOrEqual(1.6);
  });
});
