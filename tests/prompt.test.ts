import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../src/main/systemPrompt";
import type { Tool } from "../src/main/tools/registry";

const browserTool: Tool = {
  name: "browser",
  description: "Navega y opera un navegador visible.",
  schema: { type: "object" },
  execute: async () => ({ success: true })
};

const prompt = buildSystemPrompt([browserTool]);

describe("buildSystemPrompt - contrato de finalización", () => {
  it("contiene la sección de tareas del navegador", () => {
    expect(prompt).toContain("Tareas del navegador");
  });

  it("exige verificar la última acción con screenshot antes de cerrar", () => {
    const normalized = prompt.replace(/\s+/g, " ");
    expect(normalized).toMatch(/verific[áa] que el resultado esperado se vea/i);
    expect(prompt).toContain("screenshot");
  });

  it("prohibe más tool calls de browser tras confirmar la última acción", () => {
    expect(prompt).toContain("NO emitas más tool calls");
    expect(prompt).toContain("de browser");
  });

  it("exige cerrar el turno con una frase corta en español", () => {
    expect(prompt).toContain("UNA frase corta en español");
  });

  it("prohibe acciones redundantes tras confirmar", () => {
    expect(prompt).toContain("No repitás el clic");
    expect(prompt).toContain("No hagas pasos");
  });

  it("la estrategia de navegador existente se mantiene (regresión)", () => {
    expect(prompt).toContain("Estrategia de navegador (visión):");
    expect(prompt).toContain("findCoordinates");
    expect(prompt).toContain("scrollToBottom");
    expect(prompt).toContain("pageText");
  });

  it("el prompt sigue siendo en español y lista las herramientas", () => {
    expect(prompt).toContain("Sos Boris");
    expect(prompt).toContain("Herramienta: browser");
  });
});
