export interface StuckState {
  history: string[];
  nudgeCount: number;
}

const WINDOW = 3;

export function browserSignature(args: Record<string, unknown>): string {
  const { action, url, value, key, text, x, y } = args;
  if (action === "navigate") return `nav:${url}`;
  if (action === "screenshot") return "shot";
  if (action === "mouseClick") return `click:${round(x)},${round(y)}`;
  if (action === "mouseMove") return `move:${round(x)},${round(y)}`;
  if (action === "type") return `type:${value}`;
  if (action === "pressKey" || action === "pressKeyHuman") return `key:${key}`;
  if (action === "findCoordinates") return `find:${text || value}`;
  if (action === "getLinks") return `links:${value ?? ""}`;
  if (action === "scrollToText") return `scrolltext:${text}`;
  if (action === "scrollToBottom") return "scrollbottom";
  return `other:${action}`;
}

function round(v: unknown): string {
  return typeof v === "number" ? String(Math.round(v)) : String(v ?? "");
}

export type StuckVerdict = "ok" | "nudge" | "stop";

export function evaluateStuck(state: StuckState, args: Record<string, unknown>):
  { verdict: StuckVerdict; next: StuckState; message: string | null } {
  const sig = browserSignature(args);
  const history = [...state.history, sig].slice(-WINDOW);
  const isStuck = history.length === WINDOW && history.every((s) => s === history[0]);
  let verdict: StuckVerdict = "ok";
  if (isStuck) {
    verdict = state.nudgeCount === 0 ? "nudge" : "stop";
  } else {
    state.nudgeCount = 0;
  }
  const next = { history, nudgeCount: isStuck && verdict !== "stop" ? state.nudgeCount + 1 : state.nudgeCount };
  const message =
    verdict === "nudge"
      ? "Estás repitiendo la misma acción sin avanzar. Tomá una screenshot para confirmar el estado real o cambiá la estrategia antes de repetir."
      : verdict === "stop"
        ? "Estás repetiendo la misma acción una y otra vez sin avance. La ejecución fue detenida."
        : null;
  return { verdict, next, message };
}
