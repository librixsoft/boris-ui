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

  async clickHuman(selector: string): Promise<BrowserResult> {
    await this.ensurePage();
    const element = this.page!.locator(selector).first();
    
    // Mover el mouse al elemento (simular movimiento humano)
    const box = await element.boundingBox();
    if (box) {
      const x = box.x + box.width / 2 + (Math.random() - 0.5) * 10;
      const y = box.y + box.height / 2 + (Math.random() - 0.5) * 10;
      await this.page!.mouse.move(x, y);
      await this.page!.waitForTimeout(100 + Math.random() * 200);
    }
    
    // Click con ligera variación
    await element.click();
    await this.page!.waitForTimeout(200 + Math.random() * 300);
    
    return { success: true, selector };
  }

  async fill(selector: string, value: string): Promise<BrowserResult> {
    await this.ensurePage();
    await this.page!.locator(selector).first().fill(value);
    return { success: true, selector, value };
  }

  async fillHuman(selector: string, value: string, options?: {
    mistakes?: boolean;
    mistakesCount?: number;
    typingSpeed?: { min: number; max: number };
  }): Promise<BrowserResult> {
    await this.ensurePage();
    const element = this.page!.locator(selector).first();
    await element.click();
    
    const {
      mistakes = true,
      mistakesCount = 1,
      typingSpeed = { min: 50, max: 150 }
    } = options || {};

    let currentText = "";
    const chars = value.split("");
    
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      
      // Simular error humano aleatorio
      if (mistakes && Math.random() < 0.1 && i > 0 && mistakesCount > 0) {
        // Escribir letra incorrecta
        const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
        await this.page!.keyboard.type(wrongChar);
        await this.page!.waitForTimeout(typingSpeed.min + Math.random() * (typingSpeed.max - typingSpeed.min));
        
        // Borrar el error
        await this.page!.keyboard.press("Backspace");
        await this.page!.waitForTimeout(typingSpeed.min + Math.random() * (typingSpeed.max - typingSpeed.min));
      }
      
      // Escribir la letra correcta
      await this.page!.keyboard.type(char);
      currentText += char;
      
      // Variación de velocidad de escritura
      const delay = typingSpeed.min + Math.random() * (typingSpeed.max - typingSpeed.min);
      await this.page!.waitForTimeout(delay);
    }
    
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

  async pressKeyHuman(key: string): Promise<BrowserResult> {
    await this.ensurePage();
    // Simular tiempo de reacción humano antes de presionar
    await this.page!.waitForTimeout(200 + Math.random() * 300);
    await this.page!.keyboard.press(key);
    await this.page!.waitForTimeout(100 + Math.random() * 200);
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
