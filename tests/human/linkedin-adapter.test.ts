import { describe, it, expect } from "vitest";
import { similarityJaccard } from "../../src/main/browser/human/adapters/linkedin";

describe("F7 LinkedIn adapter similarity", () => {
  it("returns 1 for identical strings", () => {
    expect(similarityJaccard("hello world", "hello world")).toBe(1);
  });

  it("returns 0 for completely different strings", () => {
    const sim = similarityJaccard("hello world", "foo bar baz");
    expect(sim).toBe(0);
  });

  it("returns partial similarity for similar strings", () => {
    const sim = similarityJaccard("hello world foo bar", "hello world foo baz");
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it("uses configurable shingle size", () => {
    const sim = similarityJaccard("abc def ghi", "abc def jkl", 2);
    expect(sim).toBeGreaterThan(0);
  });
});
