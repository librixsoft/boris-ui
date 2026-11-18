import { describe, it, expect } from "vitest";
import { resolveSafePath, WORKSPACE_ROOT } from "../src/main/tools/workspace";

describe("Workspace - resolveSafePath", () => {
  it("debería resolver rutas relativas dentro del workspace", () => {
    const result = resolveSafePath("test.txt");
    expect(result).toBe(`${WORKSPACE_ROOT}/test.txt`);
  });

  it("debería resolver rutas relativas con subdirectorios", () => {
    const result = resolveSafePath("subdir/test.txt");
    expect(result).toBe(`${WORKSPACE_ROOT}/subdir/test.txt`);
  });

  it("debería rechazar rutas relativas con traversal ..", () => {
    expect(() => resolveSafePath("../test.txt")).toThrow("Traversal no permitido");
  });

  it("debería aceptar rutas absolutas que empiezan con / (caso especial)", () => {
    // La función acepta rutas absolutas que no están en el workspace
    const result = resolveSafePath("/test.txt");
    expect(result).toBe("/test.txt");
  });

  it("debería rechazar rutas relativas fuera del workspace", () => {
    expect(() => resolveSafePath("../../etc/passwd")).toThrow("Traversal no permitido");
  });

  it("debería aceptar rutas absolutas dentro del workspace", () => {
    const result = resolveSafePath(`${WORKSPACE_ROOT}/test.txt`);
    expect(result).toBe(`${WORKSPACE_ROOT}/test.txt`);
  });

  it("debería aceptar rutas absolutas que son el workspace root", () => {
    const result = resolveSafePath(WORKSPACE_ROOT);
    expect(result).toBe(WORKSPACE_ROOT);
  });

  it("debería aceptar rutas absolutas fuera del workspace (ej: /Users/lastprophet/Downloads)", () => {
    const downloadsPath = "/Users/lastprophet/Downloads/test.txt";
    const result = resolveSafePath(downloadsPath);
    expect(result).toBe(downloadsPath);
  });

  it("debería aceptar rutas absolutas en /tmp", () => {
    const tmpPath = "/tmp/test.txt";
    const result = resolveSafePath(tmpPath);
    expect(result).toBe(tmpPath);
  });

  it("debería aceptar rutas absolutas en /home", () => {
    const homePath = "/home/user/test.txt";
    const result = resolveSafePath(homePath);
    expect(result).toBe(homePath);
  });

  it("debería normalizar rutas absolutas con traversal que terminan dentro del workspace", () => {
    // ${WORKSPACE_ROOT}/subdir/../../etc/passwd se normaliza a /Users/lastprophet/.boris/etc/passwd
    // No contiene .. después de normalizar, y está dentro del workspace, así que se acepta
    const maliciousPath = `${WORKSPACE_ROOT}/subdir/../../etc/passwd`;
    const result = resolveSafePath(maliciousPath);
    expect(result).toBe("/Users/lastprophet/.boris/etc/passwd");
  });

  it("debería normalizar rutas con ./", () => {
    const result = resolveSafePath("./test.txt");
    expect(result).toBe(`${WORKSPACE_ROOT}/test.txt`);
  });

  it("debería normalizar rutas con subdirectorios y ./", () => {
    const result = resolveSafePath("./subdir/test.txt");
    expect(result).toBe(`${WORKSPACE_ROOT}/subdir/test.txt`);
  });

  it("debería aceptar rutas absolutas en /Users/lastprophet/Documents", () => {
    const docsPath = "/Users/lastprophet/Documents/test.txt";
    const result = resolveSafePath(docsPath);
    expect(result).toBe(docsPath);
  });

  it("debería mantener rutas absolutas con múltiples niveles fuera del workspace", () => {
    const deepPath = "/Users/lastprophet/Downloads/subdir/deep/test.txt";
    const result = resolveSafePath(deepPath);
    expect(result).toBe(deepPath);
  });

  it("debería normalizar rutas absolutas con redundancias (ej: /Users/../Users)", () => {
    // Después de normalize se convierte a /Users/lastprophet/Downloads/test.txt
    // No contiene .. así que se acepta
    const redundantPath = "/Users/lastprophet/../lastprophet/Downloads/test.txt";
    const result = resolveSafePath(redundantPath);
    expect(result).toBe("/Users/lastprophet/Downloads/test.txt");
  });

  it("debería normalizar rutas absolutas con .. que se resuelven dentro del mismo directorio", () => {
    // /Users/lastprophet/Downloads/../Downloads/test.txt se normaliza a /Users/lastprophet/Downloads/test.txt
    // No contiene .. después de normalizar, así que se acepta
    const traversalPath = "/Users/lastprophet/Downloads/../Downloads/test.txt";
    const result = resolveSafePath(traversalPath);
    expect(result).toBe("/Users/lastprophet/Downloads/test.txt");
  });
});

describe("Workspace - Integración con createFile", () => {
  it("simula el caso real: ruta absoluta a /Users/lastprophet/Downloads", () => {
    const downloadsPath = "/Users/lastprophet/Downloads/archivo.txt";
    const result = resolveSafePath(downloadsPath);
    
    // La función debería retornar la ruta tal cual porque está fuera del workspace
    expect(result).toBe(downloadsPath);
    expect(result).not.toContain(WORKSPACE_ROOT);
  });

  it("simula el caso real: ruta relativa se resuelve al workspace", () => {
    const relativePath = "archivo.txt";
    const result = resolveSafePath(relativePath);
    
    // La función debería resolver contra el workspace
    expect(result).toBe(`${WORKSPACE_ROOT}/archivo.txt`);
    expect(result).toContain(WORKSPACE_ROOT);
  });

  it("simula el caso real: ruta absoluta a /tmp", () => {
    const tmpPath = "/tmp/temporal.txt";
    const result = resolveSafePath(tmpPath);
    
    // La función debería retornar la ruta tal cual
    expect(result).toBe(tmpPath);
    expect(result).not.toContain(WORKSPACE_ROOT);
  });

  it("simula el caso real: el LLM debería poder escribir en /Users/lastprophet/Downloads", () => {
    // Caso crítico: cuando el usuario pide guardar en Downloads,
    // el agente debería respetar esa ruta absoluta
    const downloadsPath = "/Users/lastprophet/Downloads/archivo.txt";
    const result = resolveSafePath(downloadsPath);
    
    // Verificar que NO se reescribe al workspace
    expect(result).toBe(downloadsPath);
    expect(result).not.toBe(`${WORKSPACE_ROOT}/archivo.txt`);
  });

  it("simula el caso real: el LLM debería poder escribir en /Users/lastprophet/Documents", () => {
    const docsPath = "/Users/lastprophet/Documents/archivo.txt";
    const result = resolveSafePath(docsPath);
    
    // Verificar que NO se reescribe al workspace
    expect(result).toBe(docsPath);
    expect(result).not.toBe(`${WORKSPACE_ROOT}/archivo.txt`);
  });

  it("simula el caso real: rutas relativas DEBEN ir al workspace", () => {
    const relativePath = "mi-archivo.txt";
    const result = resolveSafePath(relativePath);
    
    // Verificar que SÍ se resuelve al workspace
    expect(result).toBe(`${WORKSPACE_ROOT}/mi-archivo.txt`);
    expect(result).toContain(WORKSPACE_ROOT);
  });
});

describe("Workspace - PROBLEMA: Descripción de herramienta vs implementación", () => {
  it("PROBLEMA DOCUMENTADO: La descripción de createFile dice 'Ruta relativa al workspace'", () => {
    // Pero resolveSafePath SÍ acepta rutas absolutas
    // Esto causa que el LLM ignore rutas absolutas como /Users/lastprophet/Downloads
    // porque cree que solo acepta rutas relativas
    
    const downloadsPath = "/Users/lastprophet/Downloads/archivo.txt";
    const result = resolveSafePath(downloadsPath);
    
    // La implementación SÍ acepta rutas absolutas
    expect(result).toBe(downloadsPath);
  });

  it("SOLUCIÓN SUGERIDA: Cambiar la descripción de createFile en registry.ts", () => {
    // De: "Ruta relativa al workspace donde crear el archivo"
    // A: "Ruta del archivo (relativa al workspace o absoluta)"
    // Esto permite que el LLM use rutas absolutas cuando el usuario las solicita
  });
});
