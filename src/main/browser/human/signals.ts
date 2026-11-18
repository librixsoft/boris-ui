import { Page } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const signalTextsPath = path.join(__dirname, "signal-texts.json");
let signalTexts: string[] = [];

try {
  signalTexts = JSON.parse(fs.readFileSync(signalTextsPath, "utf-8")) as string[];
} catch {
  signalTexts = [
    "actividad inusual",
    "verificación",
    "límite",
    "temporalmente restringida",
    "algo salió mal",
    "unusual activity",
    "temporarily restricted",
    "captcha",
    "challenge",
    "rate limit",
    "too many requests",
    "please verify",
    "action blocked",
    "sending limit",
  ];
}

let consecutiveEmptyFeeds = 0;
let composerDisabled = false;
let messageSentTime = 0;
let lastMessageText = "";

export interface SignalDetectorState {
  consecutiveEmptyFeeds: number;
  composerDisabled: boolean;
  messageSentTime: number;
  lastMessageText: string;
}

export function attachSignalDetector(page: Page, onSignal: (reason: string) => void): () => void {
  page.on("response", async (response) => {
    const status = response.status();
    if (status === 429 || status === 999) {
      onSignal(`HTTP ${status} from ${response.url()}`);
      return;
    }
  });

  const checkTextOnPage = async (): Promise<boolean> => {
    try {
      const bodyText = await page.evaluate(() => {
        const el = document.body;
        return el ? el.textContent || "" : "";
      });
      const lowerText = bodyText.toLowerCase();
      for (const text of signalTexts) {
        if (lowerText.includes(text.toLowerCase())) {
          return true;
        }
      }
    } catch {
      // Page may be closed
    }
    return false;
  };

  const checkCaptcha = async (): Promise<boolean> => {
    try {
      const hasCaptcha = await page.evaluate(() => {
        const selectors = [
          'iframe[src*="captcha"]',
          '[id*="captcha"]',
          '[class*="captcha"]',
          'iframe[src*="challenge"]',
          '[id*="challenge"]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) return true;
        }
        return false;
      });
      return hasCaptcha;
    } catch {
      return false;
    }
  };

  const checkComposerDisabled = async (): Promise<boolean> => {
    try {
      const disabled = await page.evaluate(() => {
        const composers = document.querySelectorAll('[contenteditable="true"][aria-disabled="true"]');
        if (composers.length > 0) return true;
        const buttons = document.querySelectorAll('button[aria-disabled="true"]');
        for (const btn of buttons) {
          const text = (btn.textContent || "").toLowerCase();
          if (text.includes("enviar") || text.includes("send") || text.includes("post")) {
            return true;
          }
        }
        return false;
      });
      return disabled;
    } catch {
      return false;
    }
  };

  const checkEmptyFeed = async (): Promise<boolean> => {
    try {
      const feedContent = await page.evaluate(() => {
        const feedSelectors = ["main", '[data-testid="mainFeed"]', '[role="feed"]'];
        for (const sel of feedSelectors) {
          const feed = document.querySelector(sel);
          if (feed && feed.textContent && feed.textContent.trim().length < 50) {
            return true;
          }
        }
        return false;
      });
      return feedContent;
    } catch {
      return false;
    }
  };

  const checkMessageSent = async (): Promise<boolean> => {
    if (messageSentTime === 0) return false;
    const elapsed = Date.now() - messageSentTime;
    if (elapsed > 10000) {
      messageSentTime = 0;
      return true;
    }
    return false;
  };

  const checkAllSignals = async () => {
    const hasTextSignal = await checkTextOnPage();
    if (hasTextSignal) {
      onSignal("Signal text detected on page");
      return;
    }

    const hasCaptchaSignal = await checkCaptcha();
    if (hasCaptchaSignal) {
      onSignal("CAPTCHA detected");
      return;
    }

    const isComposerDisabled = await checkComposerDisabled();
    if (isComposerDisabled) {
      onSignal("Composer disabled");
      return;
    }

    const isEmptyFeed = await checkEmptyFeed();
    if (isEmptyFeed) {
      consecutiveEmptyFeeds++;
      if (consecutiveEmptyFeeds >= 2) {
        onSignal("Empty feed detected twice");
        return;
      }
    } else {
      consecutiveEmptyFeeds = 0;
    }

    const messageNotAppeared = await checkMessageSent();
    if (messageNotAppeared) {
      onSignal("Sent message did not appear");
      return;
    }
  };

  page.on("domcontentloaded", checkAllSignals);
  page.on("load", checkAllSignals);

  return () => {
    page.off("domcontentloaded", checkAllSignals);
    page.off("load", checkAllSignals);
  };
}

export function recordMessageSent(text: string): void {
  messageSentTime = Date.now();
  lastMessageText = text;
}

export function getState(): SignalDetectorState {
  return {
    consecutiveEmptyFeeds,
    composerDisabled,
    messageSentTime,
    lastMessageText,
  };
}

export function resetState(): void {
  consecutiveEmptyFeeds = 0;
  composerDisabled = false;
  messageSentTime = 0;
  lastMessageText = "";
}
