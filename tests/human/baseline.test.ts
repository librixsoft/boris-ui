import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, Browser, Page } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

describe("F0 baseline detection", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  }, 60000);

  afterAll(async () => {
    await browser.close();
  });

  it("should generate baseline.json with detection scores", async () => {
    const fixturePath = path.join(__dirname, "..", "..", "tests", "fixtures", "detector.html");
    const fixtureContent = fs.readFileSync(fixturePath, "utf-8");
    await page.setContent(fixtureContent, { waitUntil: "domcontentloaded" });

    await page.mouse.move(100, 100);

    // Run 10 mousemove actions
    for (let i = 0; i < 10; i++) {
      const x = 200 + Math.random() * 400;
      const y = 200 + Math.random() * 300;
      await page.mouse.move(x, y);
      await page.waitForTimeout(20 + Math.random() * 30);
    }

    // Type some text
    await page.keyboard.type("Anthropic");
    await page.waitForTimeout(100);

    // Click
    await page.mouse.move(400, 300);
    await page.mouse.click(400, 300);
    await page.waitForTimeout(50);

    // Wheel
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(100);

    // Run detection
    const detection = await page.evaluate(() => window.__detect());

    const baseline = {
      generatedAt: new Date().toISOString(),
      score: detection._scores.total,
      signals: {
        static: detection._scores.static,
        mouse: detection._scores.mouse,
        keyboard: detection._scores.keyboard,
        click: detection._scores.click,
        wheel: detection._scores.wheel,
      },
      raw: {
        webdriver: detection.static.webdriver,
        plugins: detection.static.plugins,
        innerWidth: detection.static.innerWidth,
        outerWidth: detection.static.outerWidth,
        mouseFirstX: detection.mouse.firstX,
        mouseFirstY: detection.mouse.firstY,
        mouseSpeedCv: detection.mouse.speedCv,
        keyboardIntervalCv: detection.keyboard.intervalCv,
        wheelDeltaCv: detection.wheel.deltaCv,
      },
    };

    const plansDir = path.join(__dirname, "..", "..", "plans");
    const baselinePath = path.join(plansDir, "baseline.json");
    fs.mkdirSync(plansDir, { recursive: true });
    fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));

    expect(baseline.score).toBeDefined();
    expect(baseline.signals).toBeDefined();
    expect(typeof baseline.score).toBe("number");
  }, 60000);
});
