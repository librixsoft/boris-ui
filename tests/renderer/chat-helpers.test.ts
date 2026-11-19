// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";

type HttpStatusLabel = (status: number) => string;
type SplitErrorHint = (text: string) => { message: string; hint: string };
type ParseErrorPayload = (raw: string) => { title: string; message: string; hint: string; detail: string };
type FormatArgs = (args: Record<string, unknown>) => string;
type FormatResult = (result: unknown) => string;
type RenderBrowserDetailHtml = (result: unknown) => string;

let httpStatusLabel: HttpStatusLabel;
let splitErrorHint: SplitErrorHint;
let parseErrorPayload: ParseErrorPayload;
let formatArgs: FormatArgs;
let formatResult: FormatResult;
let renderBrowserDetailHtml: RenderBrowserDetailHtml;

beforeAll(async () => {
  document.body.innerHTML = `
    <div id="messages"></div>
    <textarea id="input"></textarea>
    <button id="send"></button>
    <div id="browser-control-overlay"></div>
    <button id="browser-stop"></button>
  `;
  const mod = await import("../../src/renderer/chat");
  httpStatusLabel = mod.httpStatusLabel;
  splitErrorHint = mod.splitErrorHint;
  parseErrorPayload = mod.parseErrorPayload;
  formatArgs = mod.formatArgs;
  formatResult = mod.formatResult;
  renderBrowserDetailHtml = mod.renderBrowserDetailHtml;
});

describe("httpStatusLabel", () => {
  it("mapea los códigos conocidos", () => {
    expect(httpStatusLabel(400)).toBe("Solicitud inválida");
    expect(httpStatusLabel(401)).toBe("No autorizado");
    expect(httpStatusLabel(403)).toBe("Acceso denegado");
    expect(httpStatusLabel(404)).toBe("Recurso no encontrado");
    expect(httpStatusLabel(408)).toBe("Tiempo de espera agotado");
    expect(httpStatusLabel(413)).toBe("Solicitud demasiado grande");
    expect(httpStatusLabel(422)).toBe("Datos no procesables");
    expect(httpStatusLabel(429)).toBe("Demasiadas solicitudes");
    expect(httpStatusLabel(500)).toBe("Error interno del servidor");
    expect(httpStatusLabel(502)).toBe("Respuesta inválida del servidor");
    expect(httpStatusLabel(503)).toBe("Servicio no disponible");
    expect(httpStatusLabel(504)).toBe("Tiempo de espera del servidor");
  });

  it("usa default para códigos desconocidos", () => {
    expect(httpStatusLabel(418)).toBe("Error del servidor");
  });
});

describe("splitErrorHint", () => {
  it("separa con - hint:", () => {
    expect(splitErrorHint("algo falló - hint: probá de nuevo")).toEqual({
      message: "algo falló",
      hint: "probá de nuevo"
    });
  });

  it("separa con — hint: (em dash)", () => {
    expect(splitErrorHint("algo falló — hint: probá de nuevo")).toEqual({
      message: "algo falló",
      hint: "probá de nuevo"
    });
  });

  it("sin hint devuelve todo como mensaje", () => {
    expect(splitErrorHint("solo mensaje")).toEqual({ message: "solo mensaje", hint: "" });
  });
});

describe("parseErrorPayload", () => {
  it("parsea HTTP 500 con body JSON", () => {
    const parsed = parseErrorPayload('HTTP 500: {"error":{"message":"boom"}}');
    expect(parsed.title).toBe("HTTP 500 \u00b7 Error interno del servidor");
    expect(parsed.message).toBe("boom");
    expect(parsed.detail).toContain("boom");
  });

  it("parsea body plano", () => {
    const parsed = parseErrorPayload("HTTP 400: bad request");
    expect(parsed.title).toBe("HTTP 400 \u00b7 Solicitud inválida");
    expect(parsed.message).toBe("bad request");
  });

  it("incluye type en detail", () => {
    const parsed = parseErrorPayload('HTTP 500: {"error":{"message":"boom","type":"server_error"}}');
    expect(parsed.detail).toContain("server_error");
  });

  it("fallback a mensaje inesperado", () => {
    const parsed = parseErrorPayload("");
    expect(parsed.message).toBe("Se produjo un error inesperado.");
  });
});

describe("formatArgs / formatResult", () => {
  it("formatArgs con string", () => {
    expect(formatArgs({ path: "a.txt" })).toBe("path: a.txt");
  });

  it("formatArgs con objeto indentado", () => {
    const result = formatArgs({ nested: { a: 1 } });
    expect(result).toContain("nested:");
    expect(result).toContain('"a": 1');
  });

  it("formatResult con string devuelve tal cual", () => {
    expect(formatResult("hola")).toBe("hola");
  });

  it("formatResult con objeto usa JSON indentado", () => {
    expect(formatResult({ a: 1 })).toBe(JSON.stringify({ a: 1 }, null, 2));
  });
});

describe("renderBrowserDetailHtml", () => {
  it("devuelve vacío para no-objeto", () => {
    expect(renderBrowserDetailHtml(null)).toBe("");
    expect(renderBrowserDetailHtml("x")).toBe("");
  });

  it("escapa HTML (XSS)", () => {
    const html = renderBrowserDetailHtml({ url: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("muestra url, título, selector, key, query, text y screenshot", () => {
    const html = renderBrowserDetailHtml({
      url: "http://x",
      title: "Titulo",
      selector: "#sel",
      key: "Enter",
      query: "buscar",
      found: true,
      text: "texto visible",
      screenshot: "BASE64"
    });
    expect(html).toContain("http://x");
    expect(html).toContain("Titulo");
    expect(html).toContain("#sel");
    expect(html).toContain("Enter");
    expect(html).toContain("buscar");
    expect(html).toContain("encontrado");
    expect(html).toContain("texto visible");
    expect(html).toContain("data:image/png;base64,BASE64");
  });

  it("muestra error y errorDetail", () => {
    const html = renderBrowserDetailHtml({
      error: "boom",
      errorDetail: { operation: "navigate", url: "http://x", cause: "net" }
    });
    expect(html).toContain("boom");
    expect(html).toContain("navigate");
    expect(html).toContain("http://x");
    expect(html).toContain("net");
  });
});
