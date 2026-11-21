import { describe, it, expect } from "vitest";
import { execute, name, schema } from "../../src/main/tools/executeCommand";

describe("executeCommand", () => {
  it("expone name, schema y execute", () => {
    expect(name).toBe("executeCommand");
    expect(schema).toBeDefined();
    expect(typeof execute).toBe("function");
  });

  it("debe ejecutar un comando exitoso", async () => {
    const result = await execute({ command: "ls" });
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it("debe fallar si el comando no existe", async () => {
    const result = await execute({ command: "comando-que-no-existe-xyz" });
    expect(result.success).toBe(false);
  });

  it("debe rechazar comando vacío", async () => {
    const result = await execute({ command: "" });
    expect(result.success).toBe(false);
    expect(result.status).toBe("invalid");
  });

  it("debe truncar timeout", async () => {
    const result = await execute({
      command: "sleep 10",
      timeoutMs: 100
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe("timeout");
  });

  it("debe aplicar timeout máximo", async () => {
    // timeoutMs > MAX_TIMEOUT_MS se clampa a MAX_TIMEOUT_MS; sleep 10 completa dentro del límite
    const result = await execute({
      command: "sleep 10",
      timeoutMs: 999999
    });
    expect(result.success).toBe(true);
  });
});
