export interface DetectionSignals {
  static: { webdriver: boolean; plugins: number; innerWidth: number; outerWidth: number };
  mouse: { speedCv: number; pathLength: number; straightDistance: number; firstX: number | null; firstY: number | null };
  keyboard: { intervalCv: number; bursts: number; keydownPerCharRatio: number };
  click: { offsets: number[]; trusted: boolean[] };
  wheel: { deltaCv: number };
}

export interface DetectionScores {
  static: number;
  mouse: number;
  keyboard: number;
  click: number;
  wheel: number;
  total: number;
}

export function scoreDetections(d: DetectionSignals): DetectionScores {
  const staticScore = normalizeStaticScore(d.static);
  const mouseScore = normalizeMouseScore(d.mouse);
  const keyboardScore = normalizeKeyboardScore(d.keyboard);
  const clickScore = normalizeClickScore(d.click);
  const wheelScore = normalizeWheelScore(d.wheel);

  const total = staticScore * 0.30 + mouseScore * 0.20 + keyboardScore * 0.25 + clickScore * 0.10 + wheelScore * 0.15;

  return {
    static: staticScore,
    mouse: mouseScore,
    keyboard: keyboardScore,
    click: clickScore,
    wheel: wheelScore,
    total,
  };
}

function normalizeStaticScore(s: DetectionSignals["static"]): number {
  let score = 0;
  if (s.webdriver) score += 0.3;
  if (s.plugins === 0) score += 0.2;
  if (Math.abs(s.innerWidth - s.outerWidth) > 100) score += 0.15;
  return Math.min(score, 1);
}

function normalizeMouseScore(m: DetectionSignals["mouse"]): number {
  let score = 0;
  if (m.firstX !== null && m.firstX < 5 && m.firstY !== null && m.firstY < 5) score += 0.3;
  if (m.speedCv < 0.05) score += 0.3;
  if (m.straightDistance > 0 && m.pathLength / m.straightDistance < 1.05) score += 0.3;
  return Math.min(score, 1);
}

function normalizeKeyboardScore(k: DetectionSignals["keyboard"]): number {
  let score = 0;
  if (k.intervalCv < 0.1) score += 0.4;
  if (k.keydownPerCharRatio < 0.5) score += 0.3;
  if (k.bursts < 0.02) score += 0.3;
  return Math.min(score, 1);
}

function normalizeClickScore(c: DetectionSignals["click"]): number {
  let score = 0;
  if (c.offsets.length > 0 && mean(c.offsets) < 3) score += 0.3;
  if (c.trusted.length > 0) {
    const trustedCount = c.trusted.filter((t) => t).length;
    if (trustedCount / c.trusted.length < 0.5) score += 0.3;
  }
  return Math.min(score, 1);
}

function normalizeWheelScore(w: DetectionSignals["wheel"]): number {
  let score = 0;
  if (w.deltaCv < 0.1) score += 0.4;
  return Math.min(score, 1);
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function compareBaseline(baseline: DetectionScores, after: DetectionScores): { signal: string; before: number; after: number; delta: number }[] {
  const signals = ["static", "mouse", "keyboard", "click", "wheel"] as const;
  return signals.map((signal) => ({
    signal,
    before: baseline[signal],
    after: after[signal],
    delta: after[signal] - baseline[signal],
  }));
}
