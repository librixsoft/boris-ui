import { describe, it, expect, beforeEach } from "vitest";
import { executionModeService, ExecutionMode } from "../src/main/executionMode/service";

describe("ExecutionModeService", () => {
  beforeEach(() => {
    executionModeService.setMode("controlled");
  });

  it("debe iniciar en controlled", () => {
    expect(executionModeService.getMode()).toBe("controlled");
  });

  it("debe cambiar a bypass", () => {
    executionModeService.setMode("bypass");
    expect(executionModeService.isBypass()).toBe(true);
    expect(executionModeService.isControlled()).toBe(false);
  });

  it("debe cambiar a controlled", () => {
    executionModeService.setMode("controlled");
    expect(executionModeService.isControlled()).toBe(true);
    expect(executionModeService.isBypass()).toBe(false);
  });

  it("debe alternar con toggle", () => {
    executionModeService.setMode("controlled");
    const mode = executionModeService.toggle();
    expect(mode).toBe("bypass");
    expect(executionModeService.getMode()).toBe("bypass");

    const mode2 = executionModeService.toggle();
    expect(mode2).toBe("controlled");
  });

  it("debe lanzar error con modo inválido", () => {
    expect(() => executionModeService.setMode("unknown" as ExecutionMode)).toThrow();
  });
});
