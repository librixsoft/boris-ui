import { Page } from "playwright";
import { RandomStream } from "./timing";
import { createRandomStreams } from "./random";
import { mouseWheelHuman } from "./scroll";

export interface ReadingConfig {
  profileSeed: number;
  sessionCounter: number;
}

export async function estimateReadingDwellMs(page: Page): Promise<number> {
  try {
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
        const text = walker.currentNode.textContent?.trim();
        if (text) texts.push(text);
      }
      return texts.join(" ");
    });
    const words = text.split(/\s+/).filter((w) => w.length > 0).length;
    return clamp(600 + 12 * words, 800, 6000);
  } catch {
    return 1000;
  }
}

export async function readingDwell(page: Page, config: ReadingConfig, stream: RandomStream): Promise<void> {
  const dwell = await estimateReadingDwellMs(page);
  await new Promise((r) => setTimeout(r, dwell));

  if (chanceGeneric(0.15, stream)) {
    const scrollUp = rangeGeneric(30, 120, stream);
    await mouseWheelHuman(page, -scrollUp, config, stream);
    await new Promise((r) => setTimeout(r, rangeGeneric(200, 500, stream)));
  }

  const images = await page.evaluate(() => document.images.length);
  if (images > 0 && chanceGeneric(0.3, stream)) {
    await new Promise((r) => setTimeout(r, rangeGeneric(500, 1500, stream)));
  }
}

export async function gotoWithReading(
  page: Page,
  url: string,
  config: ReadingConfig,
  stream: RandomStream
): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await readingDwell(page, config, stream);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function rangeGeneric(min: number, max: number, stream: RandomStream): number {
  return min + stream.next() * (max - min);
}

function chanceGeneric(p: number, stream: RandomStream): boolean {
  return stream.next() < p;
}
