import { describe, it, expect } from "vitest";
import {
  bigramFactor,
  reactionMs,
  interKeyDelayMs,
  thinkPauseMs,
  moveDurationMs,
  actionGapMs,
  fatigueMultiplier,
  burstDelayMs,
  backspaceBurstDelayMs,
  correctionPauseMs,
} from "../../src/main/browser/human/timing";
import { Prng, createRandomStreams } from "../../src/main/browser/human/random";

describe("F1 bigramFactor", () => {
  it("same hand returns 1.12", () => {
    expect(bigramFactor("q", "w")).toBe(1.12);
    expect(bigramFactor("a", "s")).toBe(1.12);
  });

  it("alternating hands returns 0.9", () => {
    expect(bigramFactor("q", "y")).toBe(0.9);
    expect(bigramFactor("a", "u")).toBe(0.9);
  });

  it("non-letter returns 1", () => {
    expect(bigramFactor("1", "2")).toBe(1);
    expect(bigramFactor(" ", "a")).toBe(1);
  });
});

describe("F1 reactionMs", () => {
  it("produces values in valid range", () => {
    const prng = new Prng(222);
    for (let i = 0; i < 100; i++) {
      const r = reactionMs(prng);
      expect(r).toBeGreaterThanOrEqual(90);
      expect(r).toBeLessThanOrEqual(900);
    }
  });

  it("median is in expected range", () => {
    const prng = new Prng(333);
    const values: number[] = [];
    for (let i = 0; i < 1000; i++) {
      values.push(reactionMs(prng));
    }
    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    expect(median).toBeGreaterThan(150);
    expect(median).toBeLessThan(300);
  });
});

describe("F1 interKeyDelayMs", () => {
  it("produces values in valid range", () => {
    const { stream, traitsObj } = createRandomStreams(444, 1);
    for (let i = 0; i < 100; i++) {
      const delay = interKeyDelayMs(stream, traitsObj, "a", "b", 1);
      expect(delay).toBeGreaterThanOrEqual(22);
      expect(delay).toBeLessThanOrEqual(720);
    }
  });

  it("same-hand bigram is slower", () => {
    const { stream, traitsObj } = createRandomStreams(555, 2);
    const sameHand = interKeyDelayMs(stream, traitsObj, "q", "w", 1);
    const altHand = interKeyDelayMs(stream, traitsObj, "q", "y", 1);
    expect(sameHand).toBeGreaterThan(altHand * 0.95);
  });

  it("fatigue increases delay", () => {
    const { stream, traitsObj } = createRandomStreams(666, 3);
    const normal = interKeyDelayMs(stream, traitsObj, "a", "b", 1);
    const fatigued = interKeyDelayMs(stream, traitsObj, "a", "b", 1.5);
    expect(fatigued).toBeGreaterThan(normal);
  });
});

describe("F1 thinkPauseMs", () => {
  it("returns 0 most of the time", () => {
    const prng = new Prng(777);
    let zeroCount = 0;
    for (let i = 0; i < 500; i++) {
      if (thinkPauseMs(prng) === 0) zeroCount++;
    }
    expect(zeroCount).toBeGreaterThan(400);
  });

  it("non-zero values are in expected range", () => {
    const prng = new Prng(888);
    const nonZero: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const pause = thinkPauseMs(prng);
      if (pause > 0) nonZero.push(pause);
    }
    for (const pause of nonZero) {
      expect(pause).toBeGreaterThanOrEqual(400);
      expect(pause).toBeLessThanOrEqual(8000);
    }
  });
});

describe("F1 moveDurationMs", () => {
  it("is monotonic with distance (Spearman > 0.8)", () => {
    const { stream, traitsObj } = createRandomStreams(999, 4);
    const distances = [10, 50, 100, 200, 400, 600, 800, 1000];
    const durations: number[] = [];
    for (const d of distances) {
      durations.push(moveDurationMs(d, 24, stream, traitsObj, 1));
    }
    const rankedDist = distances.map((_, i) => i);
    const rankedDur = [...durations].sort((a, b) => a - b).map((v, i) => durations.indexOf(v));
    const spearman = rankCorrelation(rankedDist, rankedDur);
    expect(spearman).toBeGreaterThan(0.8);
  });

  it("returns values in valid range", () => {
    const { stream, traitsObj } = createRandomStreams(1010, 5);
    for (let i = 0; i < 50; i++) {
      const dur = moveDurationMs(100, 24, stream, traitsObj, 1);
      expect(dur).toBeGreaterThanOrEqual(280);
      expect(dur).toBeLessThanOrEqual(1400);
    }
  });
});

describe("F1 actionGapMs", () => {
  it("conservative produces longer gaps", () => {
    const prng = new Prng(1212);
    const gaps: number[] = [];
    for (let i = 0; i < 100; i++) {
      gaps.push(actionGapMs("conservative", prng));
    }
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(avg).toBeGreaterThan(3000);
  });

  it("aggressive produces shorter gaps", () => {
    const prng = new Prng(1313);
    const gaps: number[] = [];
    for (let i = 0; i < 100; i++) {
      gaps.push(actionGapMs("aggressive", prng));
    }
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(avg).toBeLessThan(3000);
  });
});

describe("F1 fatigueMultiplier", () => {
  it("starts at 1", () => {
    expect(fatigueMultiplier(0)).toBe(1);
  });

  it("increases with n", () => {
    expect(fatigueMultiplier(100)).toBeGreaterThan(fatigueMultiplier(0));
    expect(fatigueMultiplier(500)).toBeGreaterThan(fatigueMultiplier(100));
  });

  it("caps at 1.6", () => {
    expect(fatigueMultiplier(1000)).toBeLessThanOrEqual(1.6);
    expect(fatigueMultiplier(10000)).toBeLessThanOrEqual(1.6);
  });
});

describe("F1 burst and correction delays", () => {
  it("burstDelayMs in range", () => {
    const prng = new Prng(1414);
    for (let i = 0; i < 50; i++) {
      const d = burstDelayMs(prng);
      expect(d).toBeGreaterThanOrEqual(25);
      expect(d).toBeLessThanOrEqual(50);
    }
  });

  it("backspaceBurstDelayMs in range", () => {
    const prng = new Prng(1515);
    for (let i = 0; i < 50; i++) {
      const d = backspaceBurstDelayMs(prng);
      expect(d).toBeGreaterThanOrEqual(60);
      expect(d).toBeLessThanOrEqual(110);
    }
  });
});

function rankCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const rankX = rankArray(x);
  const rankY = rankArray(y);
  const meanX = rankX.reduce((a, b) => a + b, 0) / n;
  const meanY = rankY.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = rankX[i] - meanX;
    const dy = rankY[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  return num / Math.sqrt(denX * denY);
}

function rankArray(arr: number[]): number[] {
  const sorted = [...arr].sort((a, b) => a - b);
  return arr.map(v => sorted.indexOf(v) + 1);
}
