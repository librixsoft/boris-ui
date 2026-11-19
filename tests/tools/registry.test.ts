import { describe, it, expect, vi } from "vitest";
import * as path from "node:path";

vi.mock("node:fs", () => {
  const actual = vi.importActual("node:fs");
  return {
    ...actual,
    readdirSync: vi.fn((dir: string) => {
      if (dir === path.join(process.cwd(), "src", "main", "tools")) {
        return ["registry.ts", "handler.ts"];
      }
      return actual.readdirSync(dir);
    })
  };
});

import { listTools, executeTool } from "../../src/main/tools/registry";

describe("registry", () => {
  it("listTools() no incluye registry ni handler", () => {
    const names = listTools().map((t) => t.name);
    expect(names).not.toContain("registry");
    expect(names).not.toContain("handler");
  });

  it("listTools() devuelve un array", () => {
    expect(Array.isArray(listTools())).toBe(true);
  });

  it("executeTool tool inexistente lanza 'Herramienta no encontrada'", async () => {
    await expect(executeTool("noExiste", {})).rejects.toThrow("Herramienta no encontrada: noExiste");
  });
});
