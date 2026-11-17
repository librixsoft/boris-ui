import { chromium, Browser, Page } from "playwright";

export interface BrowserResult {
  success: boolean;
  url?: string;
  selector?: string;
  value?: string;
  text?: string;
}

class BrowserController {
  private playwright: Browser | null = null;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private _launched = false;

  private async _ensureLaunched(): Promise<void> {
    if (this._launched) return;

    this.playwright = await chromium.launch({ headless: false });
    this.browser = this.playwright;
    this._launched = true;
  }

  private async ensurePage(): Promise<Page> {
    if (!this.page) {
      if (!this.browser) {
        throw new Error("Browser no lanzado");
      }
      this.page = await this.browser.newPage();
    }
    return this.page;
  }

  async goto(url: string): Promise<BrowserResult> {
    await this._ensureLaunched();
    await this.ensurePage();
    await this.page!.goto(url, { waitUntil: "domcontentloaded" });
    await this.page!.waitForLoadState("domcontentloaded").catch(() => {});
    return { success: true, url: this.page!.url() };
  }

  async click(selector: string): Promise<BrowserResult> {
    await this.ensurePage();
    await this.page!.locator(selector).first().click();
    return { success: true, selector };
  }

  async fill(selector: string, value: string): Promise<BrowserResult> {
    await this.ensurePage();
    await this.page!.locator(selector).first().fill(value);
    return { success: true, selector, value };
  }

  async extract(selector: string): Promise<BrowserResult> {
    await this.ensurePage();
    const el = this.page!.locator(selector).first();
    await el.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    const text = await el.textContent();
    return { success: true, selector, text: text || "" };
  }

  async close(): Promise<BrowserResult> {
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

  get isLaunched(): boolean {
    return this._launched;
  }
}

export default new BrowserController();
