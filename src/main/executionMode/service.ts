export type ExecutionMode = "bypass" | "controlled";

class ExecutionModeService {
  private mode: ExecutionMode = "controlled";

  getMode(): ExecutionMode {
    return this.mode;
  }

  setMode(mode: ExecutionMode): void {
    if (mode !== "bypass" && mode !== "controlled") {
      throw new Error("Modo de ejecución inválido");
    }
    this.mode = mode;
  }

  isBypass(): boolean {
    return this.mode === "bypass";
  }

  isControlled(): boolean {
    return this.mode === "controlled";
  }

  toggle(): ExecutionMode {
    this.mode = this.mode === "bypass" ? "controlled" : "bypass";
    return this.mode;
  }
}

export const executionModeService = new ExecutionModeService();
