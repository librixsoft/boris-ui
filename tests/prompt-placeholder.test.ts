import { describe, it, expect, vi, beforeEach } from "vitest";

const fsMock = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  actual: null as null | typeof import("node:fs")
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  fsMock.actual = actual;
  fsMock.readFileSync.mockImplementation(actual.readFileSync);
  return { ...actual, readFileSync: fsMock.readFileSync };
});

import { buildSystemPrompt } from "../src/main/systemPrompt";
import type { Tool } from "../src/main/tools/registry";

const tool: Tool = {
  name: "createFile",
  description: "Crea un archivo",
  schema: { type: "object" },
  execute: async () => ({ success: true })
};

beforeEach(() => {
  fsMock.readFileSync.mockImplementation(fsMock.actual!.readFileSync);
});

describe("buildSystemPrompt - placeholder", () => {
  it("reemplaza {toolInstructions} con las herramientas", () => {
    const prompt = buildSystemPrompt([tool]);
    expect(prompt).not.toContain("{toolInstructions}");
    expect(prompt).toContain("Herramienta: createFile");
    expect(prompt).toContain("Descripción: Crea un archivo");
    expect(prompt).toContain("Schema JSON:");
  });

  it("si falta el marker en BORIS.md retorna string vacío", () => {
    fsMock.readFileSync.mockReturnValue("contenido sin el header del system prompt");
    const prompt = buildSystemPrompt([tool]);
    expect(prompt).toBe("");
  });
});
