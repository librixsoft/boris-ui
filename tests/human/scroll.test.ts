import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRandomStreams } from "../../src/main/browser/human/random";
import { estimateReadingDwellMs } from "../../src/main/browser/human/reading";
import { chromium, Browser, Page } from "playwright";

describe("F6 scroll delta properties", () => {
  it("produces varied deltas", () => {
    const { stream } = createRandomStreams(6001, 1);
    const deltas: number[] = [];
    for (let i = 0; i < 50; i++) {
      const u1 = 1 - stream.next();
      const u2 = 1 - stream.next();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      deltas.push(clamp(120 + z * 28, 80, 180));
    }
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const stdDev = Math.sqrt(deltas.reduce((s, v) => s + (v - mean) ** 2, 0) / deltas.length);
    const cv = stdDev / mean;
    expect(cv).toBeGreaterThan(0.15);
  });

  it("never produces two equal consecutive deltas", () => {
    const { stream } = createRandomStreams(6002, 2);
    const prevDeltas: number[] = [];
    for (let i = 0; i < 100; i++) {
      const u1 = 1 - stream.next();
      const u2 = 1 - stream.next();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const delta = clamp(120 + z * 28, 80, 180);
      if (prevDeltas.length > 0) {
        expect(delta).not.toBe(prevDeltas[prevDeltas.length - 1]);
      }
      prevDeltas.push(delta);
    }
  });
});

describe("F6 reading dwell", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  }, 60000);

  afterAll(async () => {
    await browser.close();
  }, 60000);

  it("returns dwell > 800ms with text", async () => {
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent("<html><body><p>Esta es una prueba de texto con varias palabras para estimar el tiempo de lectura adecuado del usuario.</p></body></html>", { waitUntil: "domcontentloaded" });
    const dwell = await estimateReadingDwellMs(page);
    expect(dwell).toBeGreaterThan(800);
    await page.close();
  }, 60000);

  it("returns minimum dwell for empty page", async () => {
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent("<html><body></body></html>", { waitUntil: "domcontentloaded" });
    const dwell = await estimateReadingDwellMs(page);
    expect(dwell).toBeGreaterThanOrEqual(800);
    await page.close();
  }, 60000);
});

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
