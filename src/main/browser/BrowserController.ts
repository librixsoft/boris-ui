import { BrowserContext, Page } from "playwright";
import { launchHumanContext } from "./human/session";

export interface BrowserResult {
  success: boolean;
  url?: string;
  value?: string;
  text?: string;
  screenshot?: string;
  title?: string;
  key?: string;
  found?: boolean;
  x?: number;
  y?: number;
  error?: string;
  viewport?: { width: number; height: number };
  scroll?: { y: number; height: number; atBottom: boolean };
  links?: Array<{ href: string; text: string; x: number; y: number; visible: boolean }>;
  element?: { tag: string; text: string; href: string | null; role: string | null; visible: boolean };
}

class BrowserController {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private _launched = false;
  private _aborted = false;
  private _profileDir: string;

  constructor(profileDir?: string) {
    this._profileDir = profileDir ?? "";
  }

  private async _ensureLaunched(): Promise<void> {
    if (this._launched) return;

    if (!this._profileDir) {
      this.context = await launchHumanContext(this._getDefaultProfileDir());
    } else {
      this.context = await launchHumanContext(this._profileDir);
    }
    this._launched = true;
  }

  private _getDefaultProfileDir(): string {
    const os = require("node:os");
    const path = require("node:path");
    return path.join(os.tmpdir(), "boris-profile");
  }

  private async ensurePage(): Promise<Page> {
    if (!this.page) {
      if (!this.context) {
        throw new Error("Browser no lanzado");
      }
      const pages = this.context.pages();
      if (pages.length > 0) {
        this.page = pages[0];
      } else {
        this.page = await this.context.newPage();
      }
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
    const viewport = await this.page!.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    const scroll = await this.page!.evaluate(() => ({
      y: window.scrollY,
      height: document.documentElement.scrollHeight,
      atBottom: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
    }));
    const buffer = await this.page!.screenshot();
    return { success: true, screenshot: buffer.toString("base64"), viewport, scroll };
  }

  async mouseMove(x: number, y: number, options?: { steps?: number; human?: boolean }): Promise<BrowserResult> {
    await this.ensurePage();
    const { steps = 10, human = false } = options || {};

    if (human) {
      const intermediateSteps = Math.max(steps, 12);
      for (let i = 1; i <= intermediateSteps; i++) {
        if (this._aborted || !this.page) {
          throw new Error("Operación de navegador cancelada");
        }
        const t = i / intermediateSteps;
        const jitterX = (Math.random() - 0.5) * 3;
        const jitterY = (Math.random() - 0.5) * 3;
        await this.page.mouse.move(x * t + jitterX, y * t + jitterY);
        await this.page.waitForTimeout(10 + Math.random() * 15);
      }
    }
    if (this._aborted || !this.page) {
      throw new Error("Operación de navegador cancelada");
    }
    await this.page.mouse.move(x, y);
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
      if (this._aborted || !this.page) {
        throw new Error("Operación de navegador cancelada");
      }
      const char = chars[i];

      if (mistakes && Math.random() < 0.1 && i > 0 && mistakesCount > 0) {
        const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
        await this.page.keyboard.type(wrongChar);
        await this.page.waitForTimeout(typingSpeed.min + Math.random() * (typingSpeed.max - typingSpeed.min));
        if (this._aborted || !this.page) throw new Error("Operación de navegador cancelada");
        await this.page.keyboard.press("Backspace");
        await this.page.waitForTimeout(typingSpeed.min + Math.random() * (typingSpeed.max - typingSpeed.min));
      }

      if (this._aborted || !this.page) {
        throw new Error("Operación de navegador cancelada");
      }
      await this.page.keyboard.type(char);
      const delay = typingSpeed.min + Math.random() * (typingSpeed.max - typingSpeed.min);
      await this.page.waitForTimeout(delay);
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

  async mouseWheel(deltaY: number = 300): Promise<BrowserResult> {
    await this.ensurePage();
    await this.page!.mouse.wheel(0, deltaY);
    await this.page!.waitForTimeout(200);
    const viewport = await this.page!.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    const scroll = await this.page!.evaluate(() => ({
      y: window.scrollY,
      height: document.documentElement.scrollHeight,
      atBottom: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
    }));
    return { success: true, viewport, scroll };
  }

  async findVisualCoordinates(query: { text?: string; placeholder?: string; targetColor?: string }): Promise<{ x: number; y: number } | { found: false; closest?: { text: string; x: number; y: number }; hint?: string }> {
    await this.ensurePage();

    if (query.targetColor) {
      const ss = await this.screenshot();
      return await this.findCoordinatesFromScreenshot(ss.screenshot!, query.targetColor) ?? { found: false, hint: `Color ${query.targetColor} no encontrado en la captura` };
    }

    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    const term = normalize(query.text || query.placeholder || "");
    if (!term) return { found: false, hint: "No se proporcionó texto ni placeholder para buscar" };

    const result = await this.page!.evaluate((term) => {
      const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

      // 1. Inputs por placeholder/aria/value
      const inputs = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
      for (const input of inputs) {
        const ph = normalize(input.getAttribute("placeholder") || "");
        const aria = normalize(input.getAttribute("aria-label") || "");
        const val = normalize((input as HTMLInputElement).value || "");
        if (ph.includes(term) || aria.includes(term) || val.includes(term)) {
          const rect = input.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { type: "found" as const, x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2), text: ph || aria || val, visible: rect.top >= 0 && rect.top < window.innerHeight };
          }
        }
      }

      // 2. Todos los elementos con texto en DOM order
      const allElements = Array.from(document.querySelectorAll("a, button, h1, h2, h3, h4, h5, h6, p, span, li, div, footer, header, main, section, article"));
      const candidates: Array<{ text: string; x: number; y: number; visible: boolean; area: number }> = [];

      for (const el of allElements) {
        const text = normalize(el.textContent || "");
        if (!text || !text.includes(term)) continue;

        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;

        const aria = normalize(el.getAttribute("aria-label") || "");
        const exactMatch = text === term || aria === term;
        const partialMatch = text.includes(term) && text.length < 80;
        if (!exactMatch && !partialMatch) continue;

        const area = rect.width * rect.height;
        const visible = rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < window.innerHeight && rect.bottom > 0;

        candidates.push({ text, x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2), visible, area });
      }

      if (candidates.length === 0) return { type: "notFound" as const };

      // Descartar wrappers que contienen otros candidatos con <= 40% de su área
      const filtered = candidates.filter((c) => !candidates.some((other) => other.area <= c.area * 0.4 && other.text !== c.text));

      if (filtered.length === 0) return { type: "notFound" as const };

      // Priorizar visible, luego el más pequeño (leaf-ish)
      const visible = filtered.filter((c) => c.visible);
      const sorted = (visible.length > 0 ? visible : filtered).sort((a, b) => a.area - b.area);
      const best = sorted[0];

      return { type: "found" as const, x: best.x, y: best.y, text: best.text, visible: best.visible };
    }, term);

    if (result.type === "found") {
      if (!result.visible) {
        return { found: false, closest: { text: result.text, x: result.x, y: result.y }, hint: `Elemento existe pero fuera de pantalla. Usa scrollToText("${query.text}")` };
      }
      return { x: result.x, y: result.y, found: true };
    }

    // 3. Verificar si el texto existe en el DOM
    const inDom = await this.page!.evaluate((term) =>
      (document.body?.textContent ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(term)
    );

    if (inDom) {
      return { found: false, hint: `El texto existe en el DOM pero no es interactivo/visible aquí. Usa pageText o scrollToText` };
    }

    // 4. Fuzzy match
    const fuzzyResult = await this.page!.evaluate((term) => {
      const allText = Array.from(document.querySelectorAll("a, button, h1, h2, h3, h4, h5, h6, p, span, li"))
        .map((el) => ({ text: (el.textContent || "").trim(), rect: el.getBoundingClientRect() }))
        .filter((e) => e.text.length > 0 && e.text.length < 80 && e.rect.width > 0)
        .map((e) => {
          const normalized = e.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
          let matches = 0;
          for (let i = 0; i <= normalized.length - term.length; i++) {
            if (normalized.substring(i, i + term.length) === term) matches++;
          }
          const charDiff = Math.abs(e.text.length - term.length);
          return { text: e.text, score: matches / Math.max(term.length, 1) - charDiff * 0.01, x: Math.round(e.rect.left + e.rect.width / 2), y: Math.round(e.rect.top + e.rect.height / 2) };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 1);
      return allText;
    }, term);

    const closest = fuzzyResult[0];
    return { found: false, closest: closest ? { text: closest.text, x: closest.x, y: closest.y } : undefined, hint: `No existe un elemento con ese texto. Revisá pageText: el texto real puede diferir (acentos, mayúsculas, URL)` };
  }

  async getLinks(limit: number): Promise<BrowserResult> {
    await this.ensurePage();
    const links = await this.page!.evaluate((limit) => {
      const out: Array<{ href: string; text: string; x: number; y: number; visible: boolean }> = [];
      for (const a of Array.from(document.querySelectorAll("a[href]"))) {
        const r = a.getBoundingClientRect();
        const visible = r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0;
        if (!visible) continue;
        out.push({ href: a.href, text: a.textContent.trim().slice(0, 120), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), visible });
        if (out.length >= limit) break;
      }
      return out;
    }, limit);
    return { success: true, links };
  }

  async elementAtPoint(x: number, y: number): Promise<BrowserResult> {
    await this.ensurePage();
    const el = await this.page!.evaluate(({ x, y }) => {
      const node = document.elementFromPoint(x, y) as HTMLElement;
      const a = node?.closest("a[href]") ?? null;
      return {
        tag: node?.tagName.toLowerCase() ?? "none",
        text: (node?.textContent ?? "").trim().slice(0, 120),
        href: a?.href ?? null,
        role: node?.getAttribute("role") ?? null,
        visible: node !== null && node.getBoundingClientRect().width > 0
      };
    }, { x, y });
    return { success: true, element: el };
  }

  async scrollToText(text: string, offset = 0): Promise<BrowserResult> {
    const term = text.trim().toLowerCase();
    const maxAttempts = 12;
    for (let i = 0; i < maxAttempts; i++) {
      const found = await this.findVisualCoordinates({ text });
      if (found && typeof found === "object" && "x" in found && "y" in found && "found" in found && found.found) {
        const viewport = await this.page!.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
        const scroll = await this.page!.evaluate(() => ({ y: window.scrollY, height: document.documentElement.scrollHeight, atBottom: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2 }));
        return { success: true, x: (found as { x: number; y: number }).x + offset, y: (found as { x: number; y: number }).y, viewport, scroll };
      }
      const scrollState = await this.page!.evaluate(() => ({ y: window.scrollY, height: document.documentElement.scrollHeight, atBottom: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2 }));
      if (scrollState.atBottom) {
        return { success: false, found: false, error: `Texto no existe en la página o está fuera del alcance del scroll: "${text}"` };
      }
      await this.mouseWheel(300);
    }
    return { success: false, found: false, error: `Texto no visible tras varios scrolls: "${text}"` };
  }

  async scrollToBottom(): Promise<BrowserResult> {
    await this.ensurePage();
    const maxScrolls = 50;
    for (let i = 0; i < maxScrolls; i++) {
      const scrollBefore = await this.page!.evaluate(() => window.scrollY);
      await this.page!.mouse.wheel(0, 800);
      await this.page!.waitForTimeout(200);
      const scrollAfter = await this.page!.evaluate(() => window.scrollY);
      const scrollHeight = await this.page!.evaluate(() => document.documentElement.scrollHeight);
      const viewportH = await this.page!.evaluate(() => window.innerHeight);
      if (scrollAfter + viewportH >= scrollHeight - 10) {
        const viewport = await this.page!.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
        const scroll = await this.page!.evaluate(() => ({ y: window.scrollY, height: document.documentElement.scrollHeight, atBottom: true }));
        return { success: true, viewport, scroll };
      }
      if (scrollAfter === scrollBefore && i > 0) {
        const viewport = await this.page!.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
        const scroll = await this.page!.evaluate(() => ({ y: window.scrollY, height: document.documentElement.scrollHeight, atBottom: true }));
        return { success: true, viewport, scroll };
      }
    }
    await this.page!.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await this.page!.waitForTimeout(300);
    const viewport = await this.page!.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    const scroll = await this.page!.evaluate(() => ({ y: window.scrollY, height: document.documentElement.scrollHeight, atBottom: true }));
    return { success: true, viewport, scroll };
  }

  async findElements(text: string, limit: number): Promise<BrowserResult> {
    await this.ensurePage();
    const bodyText = await this.page!.evaluate(({ term, maxLimit }) => {
      const lowerTerm = term.toLowerCase();
      const results: Array<{ text: string; x: number; y: number; visible: boolean; tag: string }> = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      const elementsToCheck: Element[] = [];
      let node = walker.nextNode() as Element;
      while (node) {
        if (["SCRIPT", "STYLE", "NOSCRIPT", "HEAD"].includes(node.tagName)) {
          walker.currentNode = node;
          walker.nextNode();
          continue;
        }
        elementsToCheck.push(node);
        node = walker.nextNode() as Element;
      }
      for (const el of elementsToCheck) {
        const elText = (el.textContent || "").trim();
        if (!elText || !elText.toLowerCase().includes(lowerTerm)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const visible = rect.top >= 0 && rect.top < window.innerHeight && rect.bottom > 0;
        results.push({ text: elText.slice(0, 120), x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2), visible, tag: el.tagName.toLowerCase() });
        if (results.length >= maxLimit) break;
      }
      return results;
    }, { term: text, maxLimit: limit });
    return { success: true, elements: bodyText };
  }

  private async isInViewport(coords: { x: number; y: number }): Promise<boolean> {
    await this.ensurePage();
    return await this.page!.evaluate((coords) => {
      const node = document.elementFromPoint(coords.x, coords.y) as HTMLElement;
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < window.innerHeight;
    }, coords);
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
    this._aborted = true;
    try {
      if (this.page) {
        await this.page.close().catch(() => {});
        this.page = null;
      }
      if (this.context) {
        await this.context.close().catch(() => {});
        this.context = null;
      }
      this._launched = false;
      return { success: true };
    } finally {
      this._aborted = false;
    }
  }

  async stop(): Promise<BrowserResult> {
    return await this.close();
  }

  get isLaunched(): boolean {
    return this._launched;
  }

  get currentUrl(): string | undefined {
    if (!this.page) return undefined;
    return this.page.url();
  }
}

export { BrowserController };
export default new BrowserController();
