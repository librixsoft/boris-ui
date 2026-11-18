import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { estimateReadingDwellMs } from "../../src/main/browser/human/reading";
import { chromium, Browser, Page } from "playwright";

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
    await page.setContent("<html><body><p>Este es un texto de prueba con varias palabras para estimar el tiempo de lectura.</p></body></html>", { waitUntil: "domcontentloaded" });
    const dwell = await estimateReadingDwellMs(page);
    expect(dwell).toBeGreaterThanOrEqual(800);
    await page.close();
  }, 60000);

  it("caps dwell at 6000ms", async () => {
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const longText = Array(1000).fill("palabra ").join("");
    await page.setContent(`<html><body><p>${longText}</p></body></html>`, { waitUntil: "domcontentloaded" });
    const dwell = await estimateReadingDwellMs(page);
    expect(dwell).toBeLessThanOrEqual(6000);
    await page.close();
  }, 60000);
});
