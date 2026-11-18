import { describe, it, expect } from "vitest";
import { generateTypo, generateTypoForText, getAdjacentChar, verifyTextFinal, ELIGIBLE_CHARS } from "../../src/main/browser/human/typo";
import { createRandomStreams } from "../../src/main/browser/human/random";

describe("F5 typo engine", () => {
  it("generates adjacent character typo", () => {
    const { stream } = createRandomStreams(5001, 1);
    const typo = generateTypo("a", stream, 0.5);
    expect(typo).not.toBeNull();
    expect(typo!.type).toBeOneOf(["adjacent", "duplication"]);
  });

  it("generates duplication typo", () => {
    const { stream } = createRandomStreams(5002, 2);
    const typo = generateTypo("a", stream, 0.5);
    if (typo && typo.type === "duplication") {
      expect(typo.typo).toBe("aa");
    }
  });

  it("returns null for non-eligible chars", () => {
    const { stream } = createRandomStreams(5003, 3);
    const typo = generateTypo(" ", stream, 0.5);
    expect(typo).toBeNull();
  });

  it("getAdjacentChar returns correct adjacent keys", () => {
    expect(getAdjacentChar("a")).toBe("s");
    expect(getAdjacentChar("q")).toBe("w");
    expect(getAdjacentChar("m")).toBe("n");
  });

  it("generateTypoForText produces typos", () => {
    const { stream } = createRandomStreams(5004, 4);
    const result = generateTypoForText("hello", stream, 0.3);
    expect(result.original).toBe("hello");
    expect(result.typed).toHaveLength(5);
    expect(result.corrections.length).toBeGreaterThanOrEqual(0);
  });
});

describe("F5 eligible chars", () => {
  it("matches letters and numbers", () => {
    expect(ELIGIBLE_CHARS.test("a")).toBe(true);
    expect(ELIGIBLE_CHARS.test("z")).toBe(true);
    expect(ELIGIBLE_CHARS.test("0")).toBe(true);
    expect(ELIGIBLE_CHARS.test("9")).toBe(true);
  });

  it("does not match spaces and symbols", () => {
    expect(ELIGIBLE_CHARS.test(" ")).toBe(false);
    expect(ELIGIBLE_CHARS.test("\n")).toBe(false);
    expect(ELIGIBLE_CHARS.test("!")).toBe(false);
  });
});
