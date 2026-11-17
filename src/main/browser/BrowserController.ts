import { chromium, Browser, Page } from "playwright";

export interface BrowserResult {
  success: boolean;
  url?: string;
  selector?: string;
  value?: string;
  text?: string;
  screenshot?: string;
  title?: string;
  key?: string;
  query?: string;
  found?: boolean;
  error?: string;
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
      await this.page.setViewportSize({ width: 1280, height: 800 });
    }
    return this.page;
  }

  private async ensureVisible(): Promise<void> {
    if (!this.page) return;
    try {
      await this.page.bringToFront();
    } catch {}
  }

  async goto(url: string): Promise<BrowserResult> {
    await this._ensureLaunched();
    await this.ensurePage();
    await this.page!.goto(url, { waitUntil: "domcontentloaded" });
    await this.page!.waitForLoadState("domcontentloaded").catch(() => {});
    await this.ensureVisible();
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

  async screenshot(): Promise<BrowserResult> {
    await this.ensurePage();
    const buffer = await this.page!.screenshot();
    return { success: true, screenshot: buffer.toString("base64") };
  }

  async pressKey(key: string): Promise<BrowserResult> {
    await this.ensurePage();
    await this.page!.keyboard.press(key);
    return { success: true, key };
  }

  async search(query: string): Promise<BrowserResult> {
    await this.ensurePage();
    const locator = this.page!.locator(`:text("${query}")`).first();
    const count = await locator.count();
    if (count > 0) {
      await locator.scrollIntoViewIfNeeded();
      return { success: true, query, found: true };
    }
    return { success: true, query, found: false };
  }

  async getTitle(): Promise<BrowserResult> {
    await this.ensurePage();
    const title = await this.page!.title();
    return { success: true, title };
  }

  async getUrl(): Promise<BrowserResult> {
    await this.ensurePage();
    return { success: true, url: this.page!.url() };
  }

  async getPageText(): Promise<BrowserResult> {
    await this.ensurePage();
    const text = await this.page!.evaluate(() => {
      const el = document.body;
      if (!el) return "";
      const walker = document.createTreeWalker(
        el,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (parent.tagName === "SCRIPT" || parent.tagName === "STYLE" || parent.tagName === "NOSCRIPT") {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );
      const texts: string[] = [];
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent?.trim();
        if (text) texts.push(text);
      }
      return texts.join("\n");
    });
    return { success: true, text: text || "" };
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
