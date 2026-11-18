import { chromium, Browser, Page } from "playwright";

export interface BrowserResult {
  success: boolean;
  url?: string;
  value?: string;
  text?: string;
  screenshot?: string;
  title?: string;
  key?: string;
  x?: number;
  y?: number;
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

  async screenshot(): Promise<BrowserResult> {
    await this.ensurePage();
    await this.ensureVisible();
    await this.page!.waitForTimeout(100);
    const buffer = await this.page!.screenshot();
    return { success: true, screenshot: buffer.toString("base64") };
  }

  async mouseMove(x: number, y: number, options?: { steps?: number; human?: boolean }): Promise<BrowserResult> {
    await this.ensurePage();
    const { steps = 10, human = false } = options || {};

    if (human) {
      const intermediateSteps = Math.max(steps, 12);
      for (let i = 1; i <= intermediateSteps; i++) {
        const t = i / intermediateSteps;
        const jitterX = (Math.random() - 0.5) * 3;
        const jitterY = (Math.random() - 0.5) * 3;
        await this.page!.mouse.move(x * t + jitterX, y * t + jitterY);
        await this.page!.waitForTimeout(10 + Math.random() * 15);
      }
    }
    await this.page!.mouse.move(x, y);
    return { success: true, x, y };
  }

  async mouseClick(x: number, y: number, options?: { human?: boolean; button?: "left" | "right" | "middle" }): Promise<BrowserResult> {
    await this.ensurePage();
    const { human = false, button = "left" } = options || {};

    if (human) {
      await this.mouseMove(x, y, { human: true });
      await this.page!.waitForTimeout(80 + Math.random() * 120);
    } else {
      await this.page!.mouse.move(x, y);
    }

    await this.page!.mouse.click(x, y, { button });
    if (human) {
      await this.page!.waitForTimeout(100 + Math.random() * 150);
    }
    return { success: true, x, y };
  }

  async mouseDoubleClick(x: number, y: number): Promise<BrowserResult> {
    await this.ensurePage();
    await this.page!.mouse.move(x, y);
    await this.page!.mouse.dblclick(x, y);
    return { success: true, x, y };
  }

  async type(value: string, options?: {
    human?: boolean;
    mistakes?: boolean;
    mistakesCount?: number;
    typingSpeed?: { min: number; max: number };
  }): Promise<BrowserResult> {
    await this.ensurePage();
    const {
      human = true,
      mistakes = false,
      mistakesCount = 1,
      typingSpeed = { min: 25, max: 60 }
    } = options || {};

    if (!human) {
      await this.page!.keyboard.type(value);
      return { success: true, value };
    }

    const chars = value.split("");
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];

      if (mistakes && Math.random() < 0.1 && i > 0 && mistakesCount > 0) {
        const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
        await this.page!.keyboard.type(wrongChar);
        await this.page!.waitForTimeout(typingSpeed.min + Math.random() * (typingSpeed.max - typingSpeed.min));
        await this.page!.keyboard.press("Backspace");
        await this.page!.waitForTimeout(typingSpeed.min + Math.random() * (typingSpeed.max - typingSpeed.min));
      }

      await this.page!.keyboard.type(char);
      const delay = typingSpeed.min + Math.random() * (typingSpeed.max - typingSpeed.min);
      await this.page!.waitForTimeout(delay);
    }

    return { success: true, value };
  }

  async findCoordinatesFromScreenshot(
    base64Screenshot: string,
    targetColorHex: string,
    tolerance: number = 20
  ): Promise<{ x: number; y: number } | null> {
    await this.ensurePage();
    return await this.page!.evaluate(
      ({ base64, targetHex, tol }) => {
        return new Promise<{ x: number; y: number } | null>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return resolve(null);
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            const hex = targetHex.replace("#", "");
            const targetR = parseInt(hex.substring(0, 2), 16);
            const targetG = parseInt(hex.substring(2, 4), 16);
            const targetB = parseInt(hex.substring(4, 6), 16);

            let sumX = 0;
            let sumY = 0;
            let count = 0;

            for (let y = 0; y < canvas.height; y++) {
              for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                if (
                  Math.abs(r - targetR) <= tol &&
                  Math.abs(g - targetG) <= tol &&
                  Math.abs(b - targetB) <= tol
                ) {
                  sumX += x;
                  sumY += y;
                  count++;
                }
              }
            }

            if (count > 0) {
              resolve({
                x: Math.round(sumX / count),
                y: Math.round(sumY / count)
              });
            } else {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = `data:image/png;base64,${base64}`;
        });
      },
      { base64: base64Screenshot, targetHex: targetColorHex, tol: tolerance }
    );
  }

  async pressKey(key: string): Promise<BrowserResult> {
    await this.ensurePage();
    await this.page!.keyboard.press(key);
    return { success: true, key };
  }

  async pressKeyHuman(key: string): Promise<BrowserResult> {
    await this.ensurePage();
    await this.page!.waitForTimeout(200 + Math.random() * 300);
    await this.page!.keyboard.press(key);
    await this.page!.waitForTimeout(100 + Math.random() * 200);
    return { success: true, key };
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

export { BrowserController };
export default new BrowserController();
