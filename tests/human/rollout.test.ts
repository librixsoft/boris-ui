import { describe, it, expect } from "vitest";
import { resolveHumanLevel, assertHumanLevel } from "../../src/main/browser/human/config";

describe("F8 rollout", () => {
  it("aggressive requires flag", () => {
    const orig = process.env.BORIS_HUMAN_ALLOW_AGGRESSIVE;
    delete process.env.BORIS_HUMAN_ALLOW_AGGRESSIVE;

    expect(() => assertHumanLevel("aggressive")).not.toThrow();

    if (orig !== undefined) process.env.BORIS_HUMAN_ALLOW_AGGRESSIVE = orig;
    else delete process.env.BORIS_HUMAN_ALLOW_AGGRESSIVE;
  });

  it("resolveHumanLevel works for all levels", () => {
    expect(resolveHumanLevel("off", undefined)).toBe("off");
    expect(resolveHumanLevel("conservative", undefined)).toBe("conservative");
    expect(resolveHumanLevel("balanced", undefined)).toBe("balanced");
    expect(resolveHumanLevel("aggressive", undefined)).toBe("aggressive");
  });
});
