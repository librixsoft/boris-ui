import { Page } from "playwright";
import { RandomStream } from "./timing";
import { createRandomStreams } from "./random";
import { interKeyDelayMs, thinkPauseMs, backspaceBurstDelayMs, correctionPauseMs, bigramFactor } from "./timing";

export interface KeyboardConfig {
  profileSeed: number;
  sessionCounter: number;
  fatigue: number;
  mistakes: "realistic" | false;
}

const KEYBOARD_ROWS = ["1234567890", "qwertyuiop", "asdfghjklñ", "zxcvbnm"];
const ELIGIBLE_CHARS = /[a-zA-Z0-9]/;

export function resolveKeystroke(char: string): { key: string; shift?: boolean } {
  if (char === "\n") return { key: "Enter" };
  if (char === "\t") return { key: "Tab" };
  if (char === " ") return { key: " " };

  const lower = char.toLowerCase();
  if (lower >= "a" && lower <= "z") {
    if (char >= "A" && char <= "Z") {
      return { key: lower, shift: true };
    }
    return { key: lower };
  }

  if (char >= "0" && char <= "9") {
    return { key: char };
  }

  const shiftMap: Record<string, string> = {
    "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
    "_": "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", '"': "'", "<": ",", ">": ".", "?": "/",
  };
  const noShiftMap: Record<string, string> = {
    "-": "-", "=": "=", "[": "]", "}": "]", "\\": "\\", ";": ";", "'": "'", ",": ",", ".": ".", "/": "/",
    "`": "`", "~": "`",
  };

  if (shiftMap[char]) {
    return { key: shiftMap[char], shift: true };
  }
  if (noShiftMap[char]) {
    return { key: noShiftMap[char] };
  }

  return { key: char };
}

export async function pressChar(page: Page, char: string, wait: number): Promise<void> {
  const ks = resolveKeystroke(char);
  const keyboard = page.keyboard;

  if (ks.shift) {
    await keyboard.down("Shift");
    await keyboard.press(ks.key);
    await keyboard.up("Shift");
  } else {
    await keyboard.press(ks.key);
  }

  await new Promise((r) => setTimeout(r, wait));
}

export async function backspaceBurst(page: Page, count: number, stream: RandomStream, traits: { typingSigma: number }): Promise<void> {
  const keyboard = page.keyboard;
  for (let i = 0; i < count; i++) {
    await keyboard.press("Backspace");
    const delay = backspaceBurstDelayMs(stream);
    await new Promise((r) => setTimeout(r, delay));
  }
}

export async function typeTextHuman(
  page: Page,
  text: string,
  config: KeyboardConfig,
  stream: RandomStream
): Promise<void> {
  const randomStreams = createRandomStreams(config.profileSeed, config.sessionCounter);
  const traits = randomStreams.traitsObj;
  const fatigue = config.fatigue;

  const chars = text.split("");
  let prevChar = "";

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];

    const thinkPause = thinkPauseMs(stream);
    if (thinkPause > 0) {
      await new Promise((r) => setTimeout(r, thinkPause));
    }

    if (config.mistakes === "realistic" && ELIGIBLE_CHARS.test(char)) {
      const shouldMistake = stream.next() < traits.mistakeRate;
      if (shouldMistake) {
        const mistakeType = stream.next();
        if (mistakeType < 0.62) {
          const adjacentChar = getAdjacentChar(char);
          if (adjacentChar) {
            await pressChar(page, adjacentChar, interKeyDelayMs(stream, traits, prevChar, char, fatigue));
            await backspaceBurst(page, 1, stream, traits);
            await new Promise((r) => setTimeout(r, correctionPauseMs(stream)));
            await pressChar(page, char, interKeyDelayMs(stream, traits, prevChar, char, fatigue));
            prevChar = char;
            continue;
          }
        }
      }
    }

    const delay = interKeyDelayMs(stream, traits, prevChar, char, fatigue);
    await pressChar(page, char, delay);
    prevChar = char;
  }
}

function getAdjacentChar(char: string): string | null {
  const lower = char.toLowerCase();
  for (const row of KEYBOARD_ROWS) {
    const idx = row.indexOf(lower);
    if (idx !== -1) {
      if (idx > 0) return row[idx - 1];
      if (idx < row.length - 1) return row[idx + 1];
    }
  }
  return null;
}

export async function isSensitiveField(page: Page): Promise<boolean> {
  try {
    const sensitive = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = (el as HTMLElement).tagName.toLowerCase();
      if (tag !== "input" && tag !== "textarea") return false;

      const input = el as HTMLInputElement;
      const type = input.type?.toLowerCase() || "";
      const autocomplete = (input.getAttribute("autocomplete") || "").toLowerCase();
      const name = (input.getAttribute("name") || "").toLowerCase();
      const id = (input.getAttribute("id") || "").toLowerCase();
      const ariaLabel = (input.getAttribute("aria-label") || "").toLowerCase();

      if (type === "password" || type === "email") return true;
      if (autocomplete.includes("current-password") || autocomplete.includes("new-password") ||
          autocomplete.includes("one-time-code") || autocomplete.includes("cc-") ||
          autocomplete.includes("username")) return true;
      if (/password|passwd|otp|token|card|cvv|cvc|credit|tarjeta|contraseña|clave/i.test(name + id + ariaLabel)) return true;

      return false;
    });
    return sensitive;
  } catch {
    return false;
  }
}
