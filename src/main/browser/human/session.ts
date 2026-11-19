import { chromium, BrowserContext } from "playwright";
import * as os from "node:os";
import * as path from "node:path";
import { readProfile, writeProfile, acquireProfileLock, HumanProfileFile } from "./profile";

function resolveHeadlessFromEnv(): boolean {
  const raw = (process.env.BORIS_HUMAN_HEADLESS ?? "").trim().toLowerCase();
  if (raw === "") return false;
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  throw new Error(`Valor invalido para BORIS_HUMAN_HEADLESS: ${process.env.BORIS_HUMAN_HEADLESS}`);
}

export async function launchHumanContext(profileDir: string): Promise<BrowserContext> {
  const headless = resolveHeadlessFromEnv();
  const releaseLock = acquireProfileLock(profileDir);

  const profile = readProfile(profileDir);
  profile.sessionCounter++;
  writeProfile(profileDir, profile);

  const releaseLockRef = [releaseLock];

  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      channel: "chrome",
      headless,
      viewport: null,
      locale: process.env.BORIS_HUMAN_LOCALE,
      timezoneId: process.env.BORIS_HUMAN_TZ,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });
  } catch (launchError) {
    context = await chromium.launchPersistentContext(profileDir, {
      headless,
      viewport: null,
      locale: process.env.BORIS_HUMAN_LOCALE,
      timezoneId: process.env.BORIS_HUMAN_TZ,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });
  }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
      configurable: true,
    });
  });

  const originalClose = context.close.bind(context);
  const wrappedClose: typeof context.close = async (options) => {
    try {
      await originalClose(options);
    } finally {
      releaseLockRef[0]();
    }
  };
  context.close = wrappedClose;

  return context;
}

export function getTempProfileDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "boris-"));
}

import * as fs from "node:fs";
