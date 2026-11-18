import { describe, it, expect } from "vitest";
import { scoreDetections, compareBaseline } from "../../src/main/browser/human/humanness";

describe("F8 humanness score", () => {
  it("scores automated browser", () => {
    const detection = {
      static: { webdriver: true, plugins: 0, innerWidth: 1280, outerWidth: 1280 },
      mouse: { speedCv: 0.01, pathLength: 100, straightDistance: 100, firstX: 0, firstY: 0 },
      keyboard: { intervalCv: 0.05, bursts: 0, keydownPerCharRatio: 0.3 },
      click: { offsets: [1, 2], trusted: [false, false] },
      wheel: { deltaCv: 0.02 },
    };
    const scores = scoreDetections(detection);
    expect(scores.total).toBeGreaterThan(0);
    expect(scores.total).toBeLessThan(1);
  });

  it("scores human-like browser lower", () => {
    const detection = {
      static: { webdriver: false, plugins: 5, innerWidth: 1200, outerWidth: 1400 },
      mouse: { speedCv: 0.3, pathLength: 150, straightDistance: 100, firstX: 200, firstY: 200 },
      keyboard: { intervalCv: 0.35, bursts: 10, keydownPerCharRatio: 1.2 },
      click: { offsets: [5, 8], trusted: [true, true] },
      wheel: { deltaCv: 0.4 },
    };
    const scores = scoreDetections(detection);
    expect(scores.total).toBeLessThan(0.5);
  });

  it("compares baseline vs after", () => {
    const baseline = { static: 0.5, mouse: 0.6, keyboard: 0.7, click: 0.4, wheel: 0.3, total: 0.5 };
    const after = { static: 0.3, mouse: 0.4, keyboard: 0.5, click: 0.2, wheel: 0.1, total: 0.3 };
    const comparison = compareBaseline(baseline, after);
    expect(comparison).toHaveLength(5);
    for (const c of comparison) {
      expect(c.delta).toBeLessThan(0);
    }
  });
});
