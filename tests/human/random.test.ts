import { describe, it, expect } from "vitest";
import { Prng, hashSeed, createRandomStreams, clamp, gaussian, lognormal, chance, choiceWeighted, pick } from "../../src/main/browser/human/random";

describe("F1 Prng determinism", () => {
  it("same seed produces same sequence", () => {
    const prng1 = new Prng(42);
    const prng2 = new Prng(42);
    const seq1 = Array.from({ length: 100 }, () => prng1.next());
    const seq2 = Array.from({ length: 100 }, () => prng2.next());
    expect(seq1).toEqual(seq2);
  });

  it("different seeds produce different sequences", () => {
    const prng1 = new Prng(42);
    const prng2 = new Prng(43);
    const seq1 = Array.from({ length: 10 }, () => prng1.next());
    const seq2 = Array.from({ length: 10 }, () => prng2.next());
    expect(seq1).not.toEqual(seq2);
  });

  it("values are in [0, 1)", () => {
    const prng = new Prng(123);
    for (let i = 0; i < 1000; i++) {
      const v = prng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("F1 hashSeed", () => {
  it("deterministic", () => {
    expect(hashSeed(1, 2, 3)).toBe(hashSeed(1, 2, 3));
  });

  it("different inputs produce different outputs", () => {
    expect(hashSeed(1, 2, 3)).not.toBe(hashSeed(4, 5, 6));
  });
});

describe("F1 traits vs stream separation", () => {
  it("same profileSeed produces same traits regardless of sessionCounter", () => {
    const s1 = createRandomStreams(999, 0);
    const s2 = createRandomStreams(999, 999);
    const traits1 = s1.traitsObj;
    const traits2 = s2.traitsObj;
    expect(traits1.typingMedianMs).toBeCloseTo(traits2.typingMedianMs, 0);
    expect(traits1.mistakeRate).toBeCloseTo(traits2.mistakeRate, 2);
    expect(traits1.pointerSpeed).toBeCloseTo(traits2.pointerSpeed, 2);
  });

  it("different sessionCounter produces different stream sequences", () => {
    const s1 = createRandomStreams(888, 0);
    const s2 = createRandomStreams(888, 1);
    const seq1 = Array.from({ length: 50 }, () => s1.stream.next());
    const seq2 = Array.from({ length: 50 }, () => s2.stream.next());
    expect(seq1).not.toEqual(seq2);
  });

  it("traits are within expected ranges", () => {
    const s = createRandomStreams(777, 5);
    const t = s.traitsObj;
    expect(t.typingMedianMs).toBeGreaterThanOrEqual(90);
    expect(t.typingMedianMs).toBeLessThanOrEqual(130);
    expect(t.typingSigma).toBeGreaterThanOrEqual(0.38);
    expect(t.typingSigma).toBeLessThanOrEqual(0.5);
    expect(t.mistakeRate).toBeGreaterThanOrEqual(0.015);
    expect(t.mistakeRate).toBeLessThanOrEqual(0.025);
    expect(t.burstRate).toBeGreaterThanOrEqual(0.15);
    expect(t.burstRate).toBeLessThanOrEqual(0.2);
    expect(t.pointerSpeed).toBeGreaterThanOrEqual(0.85);
    expect(t.pointerSpeed).toBeLessThanOrEqual(1.15);
    expect(t.tremorSigma).toBeGreaterThanOrEqual(0.4);
    expect(t.tremorSigma).toBeLessThanOrEqual(0.9);
    expect(t.overshootRate).toBeGreaterThanOrEqual(0.12);
    expect(t.overshootRate).toBeLessThanOrEqual(0.2);
    expect(t.aimErrorSigma).toBeGreaterThanOrEqual(1.1);
    expect(t.aimErrorSigma).toBeLessThanOrEqual(1.9);
  });
});

describe("F1 gaussian", () => {
  it("produces values around mean with approximate stdDev", () => {
    const prng = new Prng(555);
    const mean = 100;
    const stdDev = 10;
    const samples = 5000;
    const values: number[] = [];
    for (let i = 0; i < samples; i++) {
      values.push(gaussian(mean, stdDev, prng));
    }
    const actualMean = values.reduce((a, b) => a + b, 0) / values.length;
    const actualStdDev = Math.sqrt(values.reduce((s, v) => s + (v - actualMean) ** 2, 0) / values.length);
    expect(actualMean).toBeGreaterThan(mean - 2 * stdDev);
    expect(actualMean).toBeLessThan(mean + 2 * stdDev);
    expect(actualStdDev).toBeGreaterThan(stdDev * 0.8);
    expect(actualStdDev).toBeLessThan(stdDev * 1.3);
  });
});

describe("F1 choiceWeighted", () => {
  it("respects weights", () => {
    const prng = new Prng(111);
    const items = [
      { value: "a", weight: 0.9 },
      { value: "b", weight: 0.1 },
    ];
    let aCount = 0;
    for (let i = 0; i < 100; i++) {
      const result = choiceWeighted(items);
      if (result === "a") aCount++;
    }
    expect(aCount).toBeGreaterThan(70);
  });
});

describe("F1 pick", () => {
  it("returns element from array", () => {
    const result = pick(["a", "b", "c"]);
    expect(["a", "b", "c"]).toContain(result);
  });
});

describe("F1 clamp", () => {
  it("clamps value to range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("F1 chance", () => {
  it("throws for p outside [0,1]", () => {
    expect(() => chance(-0.1)).toThrow();
    expect(() => chance(1.1)).toThrow();
  });
});
