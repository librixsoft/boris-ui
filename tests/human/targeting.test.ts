import { describe, it, expect } from "vitest";
import { intersectWithViewport } from "../../src/main/browser/human/targeting";

describe("F4 targeting viewport intersection", () => {
  it("clips rect to viewport bounds", async () => {
    const rect = { x: -10, y: -10, width: 100, height: 100 };
    const result = await intersectWithViewport(rect, 1280, 800);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("keeps rect inside viewport when already inside", async () => {
    const rect = { x: 100, y: 100, width: 100, height: 100 };
    const result = await intersectWithViewport(rect, 1280, 800);
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });

  it("clips rect that extends beyond viewport", async () => {
    const rect = { x: 1200, y: 700, width: 100, height: 100 };
    const result = await intersectWithViewport(rect, 1280, 800);
    expect(result.x).toBeLessThanOrEqual(1180);
    expect(result.y).toBeLessThanOrEqual(700);
  });
});
