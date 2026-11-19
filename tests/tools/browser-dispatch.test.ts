import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/main/browser/BrowserController", () => {
  const BrowserController = class {
    static currentUrl = "http://current";
    static goto = vi.fn(async () => ({ success: true, url: "http://x" }));
    static screenshot = vi.fn(async () => ({ success: true }));
    static findVisualCoordinates = vi.fn(async () => ({ x: 1, y: 2 }));
    static mouseWheel = vi.fn(async () => ({ success: true }));
    static mouseMove = vi.fn(async () => ({ success: true }));
    static mouseClick = vi.fn(async () => ({ success: true }));
    static mouseDoubleClick = vi.fn(async () => ({ success: true }));
    static type = vi.fn(async () => ({ success: true }));
    static pressKey = vi.fn(async () => ({ success: true }));
    static pressKeyHuman = vi.fn(async () => ({ success: true }));
    static getTitle = vi.fn(async () => ({ success: true, title: "t" }));
    static getUrl = vi.fn(async () => ({ success: true, url: "u" }));
    static getPageText = vi.fn(async () => ({ success: true, text: "t" }));
    static findElements = vi.fn(async () => ({ success: true, elements: [] }));
    static getLinks = vi.fn(async () => ({ success: true, links: [] }));
    static elementAtPoint = vi.fn(async () => ({ success: true }));
    static scrollToText = vi.fn(async () => ({ success: true }));
    static scrollToBottom = vi.fn(async () => ({ success: true }));
    static close = vi.fn(async () => ({ success: true }));
    static stop = vi.fn(async () => ({ success: true }));
  };
  return { default: BrowserController };
});

import { execute } from "../../src/main/tools/browser";
import BrowserController from "../../src/main/browser/BrowserController";

describe("browser dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    BrowserController.currentUrl = "http://current";
  });

  it("acción no soportada → success false con errorDetail.operation", async () => {
    const result = await execute({ action: "accionInvalida" });
    expect(result.success).toBe(false);
    expect(result.errorDetail?.operation).toBe("accionInvalida");
    expect(result.errorDetail?.url).toBe("http://current");
  });

  it("navigate sin url → error con errorDetail", async () => {
    const result = await execute({ action: "navigate" });
    expect(result.success).toBe(false);
    expect(result.errorDetail?.operation).toBe("navigate");
    expect(result.error).toContain("navigate requiere url");
  });

  it("navigate con url delega en goto", async () => {
    const result = await execute({ action: "navigate", url: "http://x" });
    expect(result.success).toBe(true);
    expect(BrowserController.goto).toHaveBeenCalledWith("http://x");
  });

  it("mouseMove/mouseClick/mouseDoubleClick/elementAtPoint sin x/y → error de validación", async () => {
    for (const action of ["mouseMove", "mouseClick", "mouseDoubleClick", "elementAtPoint"]) {
      const result = await execute({ action });
      expect(result.success).toBe(false);
      expect(result.errorDetail?.operation).toBe(action);
      expect(result.error).toContain("requiere x e y");
    }
  });

  it("type sin value → error", async () => {
    const result = await execute({ action: "type" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("type requiere value");
  });

  it("pressKey/pressKeyHuman sin key → error", async () => {
    for (const action of ["pressKey", "pressKeyHuman"]) {
      const result = await execute({ action });
      expect(result.success).toBe(false);
      expect(result.error).toContain(`${action} requiere key`);
    }
  });

  it("findElements/scrollToText sin text → error", async () => {
    for (const action of ["findElements", "scrollToText"]) {
      const result = await execute({ action });
      expect(result.success).toBe(false);
      expect(result.error).toContain(`${action} requiere text`);
    }
  });

  it("mouseWheel usa deltaY default 300", async () => {
    await execute({ action: "mouseWheel" });
    expect(BrowserController.mouseWheel).toHaveBeenCalledWith(300);
  });

  it("mouseWheel respeta deltaY explícito", async () => {
    await execute({ action: "mouseWheel", deltaY: 120 });
    expect(BrowserController.mouseWheel).toHaveBeenCalledWith(120);
  });

  it("findElements usa limit default 10", async () => {
    await execute({ action: "findElements", text: "buscar" });
    expect(BrowserController.findElements).toHaveBeenCalledWith("buscar", 10);
  });

  it("getLinks usa limit default 10", async () => {
    await execute({ action: "getLinks" });
    expect(BrowserController.getLinks).toHaveBeenCalledWith(10);
  });

  it("scrollToText usa offset default 0", async () => {
    await execute({ action: "scrollToText", text: "fin" });
    expect(BrowserController.scrollToText).toHaveBeenCalledWith("fin", 0);
  });

  it("cuando el controller lanza, retorna success false con errorDetail de toBrowserError", async () => {
    vi.mocked(BrowserController.goto).mockRejectedValueOnce(new Error("net error"));
    const result = await execute({ action: "navigate", url: "http://x" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("net error");
    expect(result.errorDetail?.operation).toBe("navigate");
    expect(result.errorDetail?.originalMessage).toBe("net error");
  });
});
