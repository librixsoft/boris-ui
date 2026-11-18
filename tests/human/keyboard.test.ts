import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { resolveKeystroke, isSensitiveField } from "../../src/main/browser/human/keyboard";
import { chromium, Browser, Page } from "playwright";

describe("F5 keyboard keystroke resolution", () => {
  it("resolves lowercase letters", () => {
    expect(resolveKeystroke("a")).toEqual({ key: "a" });
    expect(resolveKeystroke("z")).toEqual({ key: "z" });
  });

  it("resolves uppercase letters with shift", () => {
    expect(resolveKeystroke("A")).toEqual({ key: "a", shift: true });
    expect(resolveKeystroke("Z")).toEqual({ key: "z", shift: true });
  });

  it("resolves numbers", () => {
    expect(resolveKeystroke("0")).toEqual({ key: "0" });
    expect(resolveKeystroke("9")).toEqual({ key: "9" });
  });

  it("resolves special characters with shift", () => {
    expect(resolveKeystroke("!")).toEqual({ key: "1", shift: true });
    expect(resolveKeystroke("@")).toEqual({ key: "2", shift: true });
  });

  it("resolves Enter and Tab", () => {
    expect(resolveKeystroke("\n")).toEqual({ key: "Enter" });
    expect(resolveKeystroke("\t")).toEqual({ key: "Tab" });
  });

  it("resolves space", () => {
    expect(resolveKeystroke(" ")).toEqual({ key: " " });
  });
});

describe("F5 sensitive field detection", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  }, 60000);

  afterAll(async () => {
    await browser.close();
  }, 60000);

  beforeEach(async () => {
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  });

  afterEach(async () => {
    await page.close();
  });

  it("detects password field", async () => {
    await page.setContent('<input type="password" />');
    await page.evaluate(() => document.querySelector("input")?.focus());
    expect(await isSensitiveField(page)).toBe(true);
  });

  it("detects email field", async () => {
    await page.setContent('<input type="email" />');
    await page.evaluate(() => document.querySelector("input")?.focus());
    expect(await isSensitiveField(page)).toBe(true);
  });

  it("detects field with password autocomplete", async () => {
    await page.setContent('<input autocomplete="current-password" />');
    await page.evaluate(() => document.querySelector("input")?.focus());
    expect(await isSensitiveField(page)).toBe(true);
  });

  it("detects field with card autocomplete", async () => {
    await page.setContent('<input autocomplete="cc-number" />');
    await page.evaluate(() => document.querySelector("input")?.focus());
    expect(await isSensitiveField(page)).toBe(true);
  });

  it("does not detect normal text field", async () => {
    await page.setContent('<input type="text" />');
    await page.evaluate(() => document.querySelector("input")?.focus());
    expect(await isSensitiveField(page)).toBe(false);
  });
});
