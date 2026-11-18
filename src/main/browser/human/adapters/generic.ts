import { Page } from "playwright";
import { findTarget } from "../targeting";
import { typeTextHuman } from "../keyboard";
import { KeyboardConfig } from "../keyboard";

export interface GenericAdapterConfig {
  profileSeed: number;
  sessionCounter: number;
  keyboardConfig: KeyboardConfig;
}

export async function openPage(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
}

export async function clickText(page: Page, text: string): Promise<void> {
  const target = await findTarget(page, { text });
  if (!target) {
    throw new Error(`Generic adapter: text "${text}" not found`);
  }
  await page.mouse.click(target.x, target.y);
}

export async function typeAt(page: Page, x: number, y: number, text: string, config: GenericAdapterConfig): Promise<void> {
  await page.mouse.click(x, y);
  await typeTextHuman(page, text, config.keyboardConfig, { next: () => Math.random() });
}

export async function readVisible(page: Page): Promise<string> {
  const text = await page.evaluate(() => {
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
      const t = walker.currentNode.textContent?.trim();
      if (t) texts.push(t);
    }
    return texts.join("\n");
  });
  return text;
}
