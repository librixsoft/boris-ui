import { RandomStream } from "./timing";
import { createRandomStreams } from "./random";
import { Page } from "playwright";

const KEYBOARD_ROWS = ["1234567890", "qwertyuiop", "asdfghjklñ", "zxcvbnm"];
export const ELIGIBLE_CHARS = /[a-zA-Z0-9]/;

export interface TypoResult {
  original: string;
  typed: string;
  corrections: { position: number; action: string }[];
}

export function shouldCommitTypo(stream: RandomStream, rate: number): boolean {
  return stream.next() < rate;
}

export function getAdjacentChar(char: string): string | null {
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

export function generateTypo(char: string, stream: RandomStream, rate: number): { typo: string; type: string } | null {
  if (!ELIGIBLE_CHARS.test(char)) return null;
  if (stream.next() >= rate) return null;

  const mistakeType = stream.next();
  if (mistakeType < 0.62) {
    const adjacent = getAdjacentChar(char);
    if (adjacent) return { typo: adjacent, type: "adjacent" };
  }
  if (mistakeType < 0.85) {
    return { typo: char + char, type: "duplication" };
  }
  return null;
}

export function generateTypoForText(text: string, stream: RandomStream, rate: number): TypoResult {
  const chars = text.split("");
  const typed: string[] = [];
  const corrections: { position: number; action: string }[] = [];

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const typo = generateTypo(char, stream, rate);

    if (typo) {
      typed.push(typo.typo);
      corrections.push({ position: typed.length - 1, action: typo.type });
    } else {
      typed.push(char);
    }
  }

  return { original: text, typed: typed.join(""), corrections };
}

export function verifyTextFinal(page: Page, expected: string): Promise<boolean> {
  return page.evaluate((text) => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === "INPUT" || tag === "TEXTAREA") {
      return (el as HTMLInputElement).value === text;
    }
    if (el.getAttribute("contenteditable") === "true") {
      return el.textContent === text;
    }
    return false;
  }, expected);
}
