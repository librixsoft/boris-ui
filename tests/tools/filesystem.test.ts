import { describe, it, expect, afterAll, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

vi.mock("../../src/main/tools/registry", () => ({
  listTools: vi.fn(() => []),
  executeTool: vi.fn()
}));

import { execute as executeCreateFile } from "../../src/main/tools/createFile";
import { execute as executeDeleteFile } from "../../src/main/tools/deleteFile";
import { execute as executeMoveFolder } from "../../src/main/tools/moveFolder";
import { execute as executeRenamePath } from "../../src/main/tools/renamePath";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "boris-fs-"));

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("createFile", () => {
  it("crea archivo con content", async () => {
    const file = path.join(tmpDir, "sub", "archivo.txt");
    const result = await executeCreateFile({ path: file, content: "hola mundo" });
    expect(result.success).toBe(true);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file, "utf-8")).toBe("hola mundo");
  });

  it("crea carpetas intermedias", async () => {
    const file = path.join(tmpDir, "a", "b", "c.txt");
    const result = await executeCreateFile({ path: file, content: "x" });
    expect(result.success).toBe(true);
    expect(fs.existsSync(file)).toBe(true);
  });

  it("sin content escribe vacío", async () => {
    const file = path.join(tmpDir, "vacio.txt");
    const result = await executeCreateFile({ path: file });
    expect(result.success).toBe(true);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file, "utf-8")).toBe("");
  });

  it("path con traversal lanza error vía resolveSafePath", async () => {
    await expect(executeCreateFile({ path: "../outside.txt", content: "x" })).rejects.toThrow();
  });
});

describe("deleteFile", () => {
  it("borra archivo existente", async () => {
    const file = path.join(tmpDir, "para-borrar.txt");
    fs.writeFileSync(file, "contenido");
    const result = await executeDeleteFile({ path: file });
    expect(result.success).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
  });

  it("archivo inexistente → success false sin throw", async () => {
    const file = path.join(tmpDir, "no-existe.txt");
    const result = await executeDeleteFile({ path: file });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Archivo no encontrado");
  });
});

describe("moveFolder", () => {
  it("mueve archivo", async () => {
    const from = path.join(tmpDir, "origen.txt");
    const to = path.join(tmpDir, "destino", "movido.txt");
    fs.writeFileSync(from, "contenido");
    const result = await executeMoveFolder({ from, to });
    expect(result.success).toBe(true);
    expect(fs.existsSync(to)).toBe(true);
    expect(fs.existsSync(from)).toBe(false);
  });

  it("crea directorio destino", async () => {
    const from = path.join(tmpDir, "origen.txt");
    const to = path.join(tmpDir, "deep", "destino", "movido.txt");
    fs.writeFileSync(from, "contenido");
    const result = await executeMoveFolder({ from, to });
    expect(result.success).toBe(true);
    expect(fs.existsSync(to)).toBe(true);
  });

  it("origen inexistente → success false", async () => {
    const from = path.join(tmpDir, "no-existe.txt");
    const to = path.join(tmpDir, "destino.txt");
    const result = await executeMoveFolder({ from, to });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Origen no encontrado");
  });

  it("mueve carpeta completa", async () => {
    const fromDir = path.join(tmpDir, "carpeta-origen");
    const toDir = path.join(tmpDir, "carpeta-destino");
    fs.mkdirSync(fromDir, { recursive: true });
    fs.writeFileSync(path.join(fromDir, "dentro.txt"), "x");
    const result = await executeMoveFolder({ from: fromDir, to: toDir });
    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(toDir, "dentro.txt"))).toBe(true);
    expect(fs.existsSync(fromDir)).toBe(false);
  });
});

describe("renamePath", () => {
  it("renombra archivo", async () => {
    const from = path.join(tmpDir, "antiguo.txt");
    const to = path.join(tmpDir, "nuevo.txt");
    fs.writeFileSync(from, "contenido");
    const result = await executeRenamePath({ from, to });
    expect(result.success).toBe(true);
    expect(fs.existsSync(to)).toBe(true);
    expect(fs.existsSync(from)).toBe(false);
  });

  it("crea destino intermedio", async () => {
    const from = path.join(tmpDir, "antiguo.txt");
    const to = path.join(tmpDir, "intermedio", "nuevo.txt");
    fs.writeFileSync(from, "contenido");
    const result = await executeRenamePath({ from, to });
    expect(result.success).toBe(true);
    expect(fs.existsSync(to)).toBe(true);
  });

  it("origen inexistente → success false", async () => {
    const from = path.join(tmpDir, "no-existe.txt");
    const to = path.join(tmpDir, "nuevo.txt");
    const result = await executeRenamePath({ from, to });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Origen no encontrado");
  });
});
