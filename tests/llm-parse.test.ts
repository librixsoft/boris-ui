import { describe, it, expect, vi } from "vitest";

vi.mock("../src/main/tools/registry", () => ({
  listTools: vi.fn(() => []),
  executeTool: vi.fn()
}));

import { parseSseLine, extractCleanText, extractReasoningFromTags, buildToolsParam } from "../src/main/llm";

describe("parseSseLine", () => {
  it("data: [DONE] → { type: done }", () => {
    expect(parseSseLine("data: [DONE]")).toEqual({ type: "done" });
  });

  it("línea sin data: → null", () => {
    expect(parseSseLine("event: message")).toBeNull();
    expect(parseSseLine("data:")).toBeNull();
    expect(parseSseLine("")).toBeNull();
  });

  it("data: vacío → null", () => {
    expect(parseSseLine("data:   ")).toBeNull();
  });

  it("error JSON → { type: error, message }", () => {
    const result = parseSseLine('data: {"error":{"message":"fallo"}}');
    expect(result).toEqual({ type: "error", message: "fallo" });
  });

  it("reasoning_content → { type: reasoning }", () => {
    const result = parseSseLine('data: {"choices":[{"delta":{"reasoning_content":"pienso"}}]}');
    expect(result).toEqual({ type: "reasoning", content: "pienso" });
  });

  it("tool_calls → { type: tool_call } con campos", () => {
    const payload = { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "createFile", arguments: JSON.stringify({ path: "a.txt" }) } }] } }] };
    const result = parseSseLine("data: " + JSON.stringify(payload));
    expect(result).toEqual({
      type: "tool_call",
      toolCall: { index: 0, id: "call_1", name: "createFile", arguments: JSON.stringify({ path: "a.txt" }) }
    });
    // Sin tool_calls ni content ni reasoning → null
    expect(parseSseLine('data: {"choices":[{"delta":{}}]}')).toBeNull();
  });

  it("content plano → { type: content }", () => {
    const result = parseSseLine('data: {"choices":[{"delta":{"content":"Hola"}}]}');
    expect(result).toEqual({ type: "content", content: "Hola" });
  });

  it("JSON inválido → null (no throw)", () => {
    expect(() => parseSseLine("data: {no es json")).not.toThrow();
    expect(parseSseLine("data: {no es json")).toBeNull();
  });

  it("choices vacías → null", () => {
    expect(parseSseLine('data: {"choices":[]}')).toBeNull();
  });

  it("delta sin contenido → null", () => {
    expect(parseSseLine('data: {"choices":[{"delta":{}}]}')).toBeNull();
  });
});

describe("extractCleanText", () => {
  it("tag completo con cierre", () => {
    expect(extractCleanText('Hola<tool name="createFile">{ "path": "test.txt" }</tool>Adiós')).toBe("HolaAdiós");
  });

  it("tag sin cierre al final devora el resto (comportamiento actual)", () => {
    expect(extractCleanText('<tool name="createFile">{ "path": "test.txt" }')).toBe("");
  });

  it("múltiples tool calls", () => {
    expect(extractCleanText('Inicio<tool name="a">{}</tool>Medio<tool name="b">{}</tool>Fin')).toBe("InicioMedioFin");
  });

  it("tag de cierre huérfano", () => {
    expect(extractCleanText('Texto</tool>Más texto')).toBe("TextoMás texto");
  });

  it("texto sin tool calls", () => {
    expect(extractCleanText("Hola mundo, cómo estás?")).toBe("Hola mundo, cómo estás?");
  });

  it("string vacío", () => {
    expect(extractCleanText("")).toBe("");
  });

  it("solo tool calls sin texto", () => {
    expect(extractCleanText('<tool name="createFile">{ "path": "test.txt" }</tool>')).toBe("");
  });

  it("tags thinking/reasoning no eliminados", () => {
    expect(extractCleanText('<thinking>Pensamiento</thinking>Texto<tool name="a">{}</tool>Más')).toBe("<thinking>Pensamiento</thinking>TextoMás");
  });

  it("JSON con newlines", () => {
    expect(extractCleanText('Texto<tool name="a">{\n  "path": "test"\n}</tool>Más texto')).toBe("TextoMás texto");
  });
});

describe("extractReasoningFromTags", () => {
  it("<thinking>r</thinking>c → reasoning y content", () => {
    const result = extractReasoningFromTags("<thinking>razonamiento</thinking>contenido");
    expect(result).toEqual({ reasoning: "razonamiento", content: "contenido" });
  });

  it("solo thinking → content vacío", () => {
    const result = extractReasoningFromTags("<thinking>solo razonamiento</thinking>");
    expect(result).toEqual({ reasoning: "solo razonamiento", content: "" });
  });

  it("sin thinking → reasoning vacío, content original", () => {
    const result = extractReasoningFromTags("solo contenido");
    expect(result).toEqual({ reasoning: "", content: "solo contenido" });
  });

  it("tags thinking anidados/limpiados", () => {
    const result = extractReasoningFromTags("<thinking>con <thinking>anidado</thinking> fin</thinking>resto");
    expect(result.reasoning).toBe("con anidado");
    expect(result.content).toBe("finresto");
  });
});

describe("buildToolsParam", () => {
  it("mapea name/description/schema → parameters", () => {
    const tools = [
      { name: "createFile", description: "Crea archivo", schema: { type: "object", properties: { path: { type: "string" } } } }
    ];
    const result = buildToolsParam(tools);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "function",
      function: {
        name: "createFile",
        description: "Crea archivo",
        parameters: { type: "object", properties: { path: { type: "string" } } }
      }
    });
  });

  it("lista vacía → array vacío", () => {
    expect(buildToolsParam([])).toEqual([]);
  });
});
