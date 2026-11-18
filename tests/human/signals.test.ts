import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { attachSignalDetector, resetState } from "../../src/main/browser/human/signals";
import { chromium, Browser, Page } from "playwright";

describe("F3 signals detection", () => {
  let browser: Browser;
  let page: Page;
  let signals: string[];

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  }, 60000);

  afterAll(async () => {
    await browser.close();
  }, 60000);

  beforeEach(() => {
    signals = [];
    resetState();
  });

  it("should detect 429 response", async () => {
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const stop = attachSignalDetector(page, (reason) => {
      signals.push(reason);
    });

    await page.route("**/api/*", async (route) => {
      await route.fulfill({ status: 429, body: "Rate limited" });
    });

    try {
      await page.goto("http://example.com/api/test", { waitUntil: "networkidle" }).catch(() => {});
    } catch {
      // May fail due to navigation
    }

    expect(signals.some((s) => s.includes("429"))).toBe(true);
    stop();
    await page.close();
  }, 60000);

  it("should detect signal text on page", async () => {
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const stop = attachSignalDetector(page, (reason) => {
      signals.push(reason);
    });

    await page.setContent(`
      <html>
        <body>
          <p>Actividad inusual detectada</p>
        </body>
      </html>
    `, { waitUntil: "domcontentloaded" });

    await page.evaluate(() => {
      window.dispatchEvent(new Event("domcontentloaded"));
    });

    await new Promise((r) => setTimeout(r, 500));

    expect(signals.some((s) => s.includes("Signal text"))).toBe(true);
    stop();
    await page.close();
  }, 60000);

  it("should detect CAPTCHA", async () => {
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const stop = attachSignalDetector(page, (reason) => {
      signals.push(reason);
    });

    await page.setContent(`
      <html>
        <body>
          <iframe src="https://captcha.example.com/challenge"></iframe>
        </body>
      </html>
    `, { waitUntil: "domcontentloaded" });

    await page.evaluate(() => {
      window.dispatchEvent(new Event("domcontentloaded"));
    });

    await new Promise((r) => setTimeout(r, 500));

    expect(signals.some((s) => s.includes("CAPTCHA"))).toBe(true);
    stop();
    await page.close();
  }, 60000);

  it("should not signal on normal page", async () => {
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const stop = attachSignalDetector(page, (reason) => {
      signals.push(reason);
    });

    await page.setContent(`
      <html>
        <body>
          <h1>Welcome to the feed</h1>
          <p>Some normal content here</p>
        </body>
      </html>
    `, { waitUntil: "domcontentloaded" });

    await page.evaluate(() => {
      window.dispatchEvent(new Event("domcontentloaded"));
    });

    await new Promise((r) => setTimeout(r, 500));

    expect(signals).toHaveLength(0);
    stop();
    await page.close();
  }, 60000);
});
