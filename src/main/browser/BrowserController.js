const { chromium } = require("playwright");

class BrowserController {
  constructor() {
    this.playwright = null;
    this.browser = null;
    this.page = null;
    this._launched = false;
  }

  async _ensureLaunched() {
    if (this._launched) return;

    this.playwright = await chromium.launch({ headless: false });
    this.browser = this.playwright;
    this._launched = true;
  }

  async ensurePage() {
    if (!this.page) {
      this.page = await this.browser.newPage();
    }
    return this.page;
  }

  async goto(url) {
    await this._ensureLaunched();
    await this.ensurePage();
    await this.page.goto(url, { waitUntil: "domcontentloaded" });
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
    return { success: true, url: this.page.url() };
  }

  async click(selector) {
    await this.ensurePage();
    await this.page.locator(selector).first().click();
    return { success: true, selector };
  }

  async fill(selector, value) {
    await this.ensurePage();
    await this.page.locator(selector).first().fill(value);
    return { success: true, selector, value };
  }

  async extract(selector) {
    await this.ensurePage();
    const el = this.page.locator(selector).first();
    await el.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    const text = await el.textContent();
    return { success: true, selector, text: text || "" };
  }

  async close() {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this._launched = false;
    return { success: true };
  }

  get isLaunched() {
    return this._launched;
  }
}

module.exports = new BrowserController();
