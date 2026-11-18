import { Page } from "playwright";

export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TargetResult {
  x: number;
  y: number;
  rect: TargetRect;
}

export async function findTarget(page: Page, query: { text?: string; placeholder?: string }): Promise<TargetResult | null> {
  const result = await page.evaluate(({ text, placeholder }) => {
    const term = (text || placeholder || "").trim().toLowerCase();
    if (!term) return null;

    const inputs = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
    for (const input of inputs) {
      const ph = (input.getAttribute("placeholder") || "").toLowerCase();
      const aria = (input.getAttribute("aria-label") || "").toLowerCase();
      const val = ((input as HTMLInputElement).value || "").toLowerCase();
      if (ph.includes(term) || aria.includes(term) || val.includes(term)) {
        const rect = input.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
            rect: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
          };
        }
      }
    }

    const interactives = Array.from(document.querySelectorAll("button, a, div, span, p, h1, h2, h3"));
    for (const el of interactives) {
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      const textContent = (el.textContent || "").toLowerCase().trim();
      if (aria === term || textContent === term || (textContent.includes(term) && textContent.length < 60)) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
            rect: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
          };
        }
      }
    }

    return null;
  }, { text: query.text, placeholder: query.placeholder });

  return result;
}

export async function verifyTarget(page: Page, target: Element | null, x: number, y: number): Promise<boolean> {
  try {
    const elementAtPoint = await page.evaluate(({ px, py }) => {
      const el = document.elementFromPoint(px, py);
      if (!el) return false;
      return true;
    }, { px: x, py: y });
    return elementAtPoint;
  } catch {
    return false;
  }
}

export async function intersectWithViewport(rect: TargetRect, viewportWidth: number, viewportHeight: number): Promise<TargetRect> {
  const intersectedX = Math.max(0, Math.min(rect.x, viewportWidth - rect.width));
  const intersectedY = Math.max(0, Math.min(rect.y, viewportHeight - rect.height));
  return {
    x: intersectedX,
    y: intersectedY,
    width: rect.width,
    height: rect.height,
  };
}
