import { describe, it, expect } from "vitest";
import { BrowserError, toBrowserError } from "../src/main/browser/BrowserError";

describe("BrowserError", () => {
  it("toBrowserError con un BrowserError devuelve el mismo objeto", () => {
    const original = new BrowserError({ operation: "op", url: "u", originalMessage: "msg" });
    const result = toBrowserError("otra", "otra", original);
    expect(result).toBe(original);
  });

  it("con Error envuelve operation/url/originalMessage y agrega cause/stack", () => {
    const cause = new Error("boom");
    const result = toBrowserError("navigate", "http://x", cause);
    expect(result).toBeInstanceOf(BrowserError);
    expect(result.operation).toBe("navigate");
    expect(result.url).toBe("http://x");
    expect(result.originalMessage).toBe("boom");
    expect(result.causeMessage).toBe("boom");
    expect(result.stack).toContain("Causa original");
    expect(result.stack).toContain("boom");
  });

  it("con valor no-Error usa String(error)", () => {
    expect(toBrowserError("op", undefined, "texto").originalMessage).toBe("texto");
    expect(toBrowserError("op", undefined, 42).originalMessage).toBe("42");
  });

  it("con mensaje vacío usa el fallback", () => {
    const result = toBrowserError("op", undefined, new Error(""));
    expect(result.originalMessage).toBe("Error desconocido en el navegador");
  });

  it("toDetail() expone operation/url/originalMessage/stack/cause", () => {
    const cause = new Error("causa");
    const result = toBrowserError("click", "http://u", cause);
    const detail = result.toDetail();
    expect(detail.operation).toBe("click");
    expect(detail.url).toBe("http://u");
    expect(detail.originalMessage).toBe("causa");
    expect(detail.stack).toBeTruthy();
    expect(detail.cause).toBe("causa");
  });

  it("toDetail() sin url deja url undefined", () => {
    const result = toBrowserError("op", undefined, new Error("x"));
    expect(result.toDetail().url).toBeUndefined();
  });
});
