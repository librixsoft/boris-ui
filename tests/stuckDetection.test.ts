import { describe, it, expect } from "vitest";
import { evaluateStuck, browserSignature, StuckState, StuckVerdict } from "../src/main/stuckDetection";

describe("browserSignature", () => {
  it("genera signature para navigate", () => {
    expect(browserSignature({ action: "navigate", url: "https://example.com" })).toBe("nav:https://example.com");
  });

  it("genera signature para screenshot", () => {
    expect(browserSignature({ action: "screenshot" })).toBe("shot");
  });

  it("genera signature para mouseClick con coordenadas redondeadas", () => {
    expect(browserSignature({ action: "mouseClick", x: 10.7, y: 20.3 })).toBe("click:11,20");
  });

  it("genera signature para type", () => {
    expect(browserSignature({ action: "type", value: "hola" })).toBe("type:hola");
  });

  it("genera signature para pressKey", () => {
    expect(browserSignature({ action: "pressKey", key: "Enter" })).toBe("key:Enter");
  });

  it("genera signature para findCoordinates", () => {
    expect(browserSignature({ action: "findCoordinates", text: "boton" })).toBe("find:boton");
  });

  it("genera signature para scrollToBottom", () => {
    expect(browserSignature({ action: "scrollToBottom" })).toBe("scrollbottom");
  });

  it("genera signature para scrollToText", () => {
    expect(browserSignature({ action: "scrollToText", text: "footer" })).toBe("scrolltext:footer");
  });

  it("genera signature para getLinks", () => {
    expect(browserSignature({ action: "getLinks", value: "links" })).toBe("links:links");
  });
});

describe("evaluateStuck", () => {
  it("no marca stuck con acciones distintas (alternando)", () => {
    const s0 = { history: [] as string[], nudgeCount: 0 };
    const r1 = evaluateStuck(s0, { action: "navigate", url: "a" });
    expect(r1.verdict).toBe("ok");
    const r2 = evaluateStuck(r1.next, { action: "screenshot" });
    expect(r2.verdict).toBe("ok");
    const r3 = evaluateStuck(r2.next, { action: "navigate", url: "b" });
    expect(r3.verdict).toBe("ok");
  });

  it("3 screenshots iguales consecutivos -> nudge", () => {
    let s: StuckState = { history: [], nudgeCount: 0 };
    s = evaluateStuck(s, { action: "screenshot" }).next;
    s = evaluateStuck(s, { action: "screenshot" }).next;
    const r = evaluateStuck(s, { action: "screenshot" });
    expect(r.verdict).toBe("nudge");
    expect(r.message).toContain("screenshot");
  });

  it("si repite tras el nudge -> stop", () => {
    let s: StuckState = { history: [], nudgeCount: 0 };
    s = evaluateStuck(s, { action: "screenshot" }).next;
    s = evaluateStuck(s, { action: "screenshot" }).next;
    s = evaluateStuck(s, { action: "screenshot" }).next;
    const r = evaluateStuck(s, { action: "screenshot" });
    expect(r.verdict).toBe("stop");
    expect(r.message).toContain("detenida");
  });

  it("cambiar de acción resetea el nudge", () => {
    let s: StuckState = { history: [], nudgeCount: 0 };
    s = evaluateStuck(s, { action: "screenshot" }).next;
    s = evaluateStuck(s, { action: "screenshot" }).next;
    s = evaluateStuck(s, { action: "screenshot" }).next;
    expect(s.nudgeCount).toBe(1);
    const r = evaluateStuck(s, { action: "navigate", url: "https://example.com" });
    expect(r.verdict).toBe("ok");
    expect(s.nudgeCount).toBe(0);
  });

  it("nudgeCount se incrementa correctamente", () => {
    let s: StuckState = { history: [], nudgeCount: 0 };
    s = evaluateStuck(s, { action: "mouseClick", x: 10, y: 20 }).next;
    s = evaluateStuck(s, { action: "mouseClick", x: 10, y: 20 }).next;
    const r1 = evaluateStuck(s, { action: "mouseClick", x: 10, y: 20 });
    expect(r1.verdict).toBe("nudge");
    expect(r1.next.nudgeCount).toBe(1);
    const r2 = evaluateStuck(r1.next, { action: "mouseClick", x: 10, y: 20 });
    expect(r2.verdict).toBe("stop");
  });

  it("verdict stop tiene mensaje descriptivo", () => {
    let s: StuckState = { history: [], nudgeCount: 0 };
    s = evaluateStuck(s, { action: "type", value: "test" }).next;
    s = evaluateStuck(s, { action: "type", value: "test" }).next;
    s = evaluateStuck(s, { action: "type", value: "test" }).next;
    const r = evaluateStuck(s, { action: "type", value: "test" });
    expect(r.message).toContain("misma acción");
    expect(r.message).toContain("detenida");
  });
});
