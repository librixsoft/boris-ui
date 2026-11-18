import { Page } from "playwright";
import { findTarget } from "../targeting";
import { typeTextHuman } from "../keyboard";
import { ApprovalRequest, requestApproval } from "../approval";
import { KeyboardConfig } from "../keyboard";

const SELECTORS = {
  feed: 'main, [data-testid="mainFeed"], [role="feed"]',
  search: 'input[placeholder*="Buscar" i], input[aria-label*="Buscar" i], input[role="combobox"]',
  results: '[data-testid="lazy-column"] li, [role="list"] li',
  profile: 'main h1, [data-testid="profile-card"]',
  message: 'button[aria-label*="Mensaje" i], a[href*="/messaging/"], [data-testid="message-button"]',
  composer: 'div[contenteditable="true"][role="textbox"], div.msg-form__contenteditable',
  send: 'button[type="submit"], button[aria-label*="Enviar" i], [data-testid="send-button"]',
};

export interface LinkedInConfig {
  profileSeed: number;
  sessionCounter: number;
  keyboardConfig: KeyboardConfig;
}

export async function openFeed(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

export async function search(page: Page, query: string, config: LinkedInConfig): Promise<void> {
  const target = await findTarget(page, { placeholder: "Buscar", text: "Buscar" });
  if (!target) {
    throw new Error("Adapter fail-closed: search input not found");
  }

  await page.mouse.move(target.x, target.y);
  await page.mouse.click(target.x, target.y);
  await typeTextHuman(page, query, config.keyboardConfig, { next: () => Math.random() });
  await page.keyboard.press("Enter");
}

export async function openProfile(page: Page, index: number): Promise<void> {
  const results = await page.$$(SELECTORS.results);
  if (results[index]) {
    await results[index].click();
  } else {
    throw new Error("Adapter fail-closed: profile result not found");
  }
}

export async function composeMessage(page: Page, text: string, config: LinkedInConfig): Promise<void> {
  await requestApproval({ kind: "message", text, recipientRouteClass: "messaging" });

  const composer = await page.$(SELECTORS.composer);
  if (!composer) {
    throw new Error("Adapter fail-closed: composer not found");
  }

  await composer.click();
  await typeTextHuman(page, text, config.keyboardConfig, { next: () => Math.random() });

  const verified = await page.evaluate((t) => {
    const el = document.querySelector(SELECTORS.composer);
    return el ? el.textContent === t : false;
  }, text);

  if (!verified) {
    throw new Error("Adapter: message text verification failed");
  }
}

export async function send(page: Page): Promise<void> {
  const sendBtn = await page.$(SELECTORS.send);
  if (!sendBtn) {
    throw new Error("Adapter fail-closed: send button not found");
  }

  await sendBtn.click();
}

export async function waitForSent(page: Page, timeoutMs: number = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const composer = await page.$(SELECTORS.composer);
    if (!composer) return true;
    const text = await composer.evaluate((el) => el.textContent);
    if (!text || text.length === 0) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

export function similarityJaccard(a: string, b: string, shingleSize: number = 3): number {
  const shinglesA = getShingles(a, shingleSize);
  const shinglesB = getShingles(b, shingleSize);
  if (shinglesA.size === 0 && shinglesB.size === 0) return 1;
  if (shinglesA.size === 0 || shinglesB.size === 0) return 0;

  let intersection = 0;
  for (const s of shinglesA) {
    if (shinglesB.has(s)) intersection++;
  }

  const union = new Set([...shinglesA, ...shinglesB]).size;
  return intersection / union;
}

function getShingles(text: string, size: number): Set<string> {
  const words = text.toLowerCase().split(/\s+/);
  const shingles = new Set<string>();
  for (let i = 0; i <= words.length - size; i++) {
    shingles.add(words.slice(i, i + size).join(" "));
  }
  return shingles;
}
