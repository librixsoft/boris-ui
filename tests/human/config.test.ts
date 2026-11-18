import { describe, it, expect, afterEach } from "vitest";
import { resolveHumanLevel, assertHumanLevel, getHumanLevelFromEnv, getProfileSeedFromEnv, getDryRunFromEnv } from "../../src/main/browser/human/config";

describe("F0 config resolveHumanLevel", () => {
  it("off + undefined -> off", () => {
    expect(resolveHumanLevel("off", undefined)).toBe("off");
  });

  it("off + true -> conservative", () => {
    expect(resolveHumanLevel("off", true)).toBe("conservative");
  });

  it("off + false -> off", () => {
    expect(resolveHumanLevel("off", false)).toBe("off");
  });

  it("balanced + undefined -> balanced", () => {
    expect(resolveHumanLevel("balanced", undefined)).toBe("balanced");
  });

  it("balanced + true -> balanced", () => {
    expect(resolveHumanLevel("balanced", true)).toBe("balanced");
  });

  it("balanced + false -> balanced", () => {
    expect(resolveHumanLevel("balanced", false)).toBe("balanced");
  });
});

describe("F0 config assertHumanLevel", () => {
  it("valid levels pass through", () => {
    expect(assertHumanLevel("off")).toBe("off");
    expect(assertHumanLevel("conservative")).toBe("conservative");
    expect(assertHumanLevel("balanced")).toBe("balanced");
    expect(assertHumanLevel("aggressive")).toBe("aggressive");
  });

  it("invalid level throws", () => {
    expect(() => assertHumanLevel("extreme")).toThrow("Nivel de humanización inválido");
    expect(() => assertHumanLevel("")).toThrow("Nivel de humanización inválido");
    expect(() => assertHumanLevel("human")).toThrow("Nivel de humanización inválido");
  });
});

describe("F0 config env getters", () => {
  const origLevel = process.env.BORIS_HUMAN_LEVEL;
  const origSeed = process.env.BORIS_HUMAN_SEED;
  const origDryRun = process.env.BORIS_HUMAN_DRY_RUN;

  afterEach(() => {
    if (origLevel !== undefined) process.env.BORIS_HUMAN_LEVEL = origLevel;
    else delete process.env.BORIS_HUMAN_LEVEL;
    if (origSeed !== undefined) process.env.BORIS_HUMAN_SEED = origSeed;
    else delete process.env.BORIS_HUMAN_SEED;
    if (origDryRun !== undefined) process.env.BORIS_HUMAN_DRY_RUN = origDryRun;
    else delete process.env.BORIS_HUMAN_DRY_RUN;
  });

  it("getHumanLevelFromEnv returns off when unset", () => {
    delete process.env.BORIS_HUMAN_LEVEL;
    expect(getHumanLevelFromEnv()).toBe("off");
  });

  it("getHumanLevelFromEnv returns parsed value", () => {
    process.env.BORIS_HUMAN_LEVEL = "balanced";
    expect(getHumanLevelFromEnv()).toBe("balanced");
  });

  it("getProfileSeedFromEnv returns default when unset", () => {
    delete process.env.BORIS_HUMAN_SEED;
    expect(getProfileSeedFromEnv()).toBe(0x51ed2701);
  });

  it("getProfileSeedFromEnv returns parsed value", () => {
    process.env.BORIS_HUMAN_SEED = "12345";
    expect(getProfileSeedFromEnv()).toBe(12345);
  });

  it("getDryRunFromEnv returns false when unset", () => {
    delete process.env.BORIS_HUMAN_DRY_RUN;
    expect(getDryRunFromEnv()).toBe(false);
  });

  it("getDryRunFromEnv returns true when 1", () => {
    process.env.BORIS_HUMAN_DRY_RUN = "1";
    expect(getDryRunFromEnv()).toBe(true);
  });
});
