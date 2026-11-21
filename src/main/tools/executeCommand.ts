import { Tool } from "./registry";

const MAX_TIMEOUT_MS = 300000;
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_OUTPUT_CHARS = 50000;

const tool: Tool = {
  name: "executeCommand",
  description: "Ejecuta un comando de shell en el proceso principal. Requiere aprobación previa en modo controlado.",
  schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "Comando de shell a ejecutar"
      },
      cwd: {
        type: "string",
        description: "Directorio de trabajo. Si no se especifica, se usa el workspace root."
      },
      timeoutMs: {
        type: "number",
        description: "Timeout en milisegundos. Por defecto 30000. Máximo 300000."
      }
    },
    required: ["command"],
    additionalProperties: false
  },
  async execute(params: Record<string, unknown>): Promise<{
    success: boolean;
    exitCode?: number;
    stdout?: string;
    stderr?: string;
    durationMs?: number;
    status?: "success" | "error" | "timeout" | "denied" | "aborted" | "invalid";
    approvalId?: string;
    error?: string;
  }> {
    const command = params.command as string | undefined;
    const cwd = params.cwd as string | undefined;
    const timeoutMs = params.timeoutMs as number | undefined;

    if (typeof command !== "string" || command.trim() === "") {
      return {
        success: false,
        error: "Comando vacío",
        status: "invalid"
      };
    }

    if (cwd !== undefined && typeof cwd !== "string") {
      return {
        success: false,
        error: "cwd debe ser un string",
        status: "invalid"
      };
    }

    let resolvedTimeout = DEFAULT_TIMEOUT_MS;
    if (timeoutMs !== undefined) {
      if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        return {
          success: false,
          error: "timeoutMs debe ser un número positivo",
          status: "invalid"
        };
      }
      resolvedTimeout = Math.min(timeoutMs, MAX_TIMEOUT_MS);
    }

    const { spawn } = await import("child_process");
    const workspaceRoot = process.cwd();
    const resolvedCwd = cwd || workspaceRoot;

    const start = Date.now();
    const args = String(command).split(" ");
    const child = spawn(args[0], args.slice(1), {
      cwd: resolvedCwd,
      timeout: resolvedTimeout,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
      if (stdout.length > MAX_OUTPUT_CHARS) {
        stdout = stdout.slice(0, MAX_OUTPUT_CHARS);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
      if (stderr.length > MAX_OUTPUT_CHARS) {
        stderr = stderr.slice(0, MAX_OUTPUT_CHARS);
      }
    });

    return new Promise((resolve) => {
      child.on("error", (error: Error) => {
        resolve({
          success: false,
          error: error.message,
          status: "error"
        });
      });

      child.on("close", (code: number | null, signal: string | null) => {
        const durationMs = Date.now() - start;
        const exitCode = code !== null ? code : undefined;
        const truncatedStdout = stdout.length > MAX_OUTPUT_CHARS ? stdout.slice(0, MAX_OUTPUT_CHARS) + `... (truncado, ${stdout.length} chars)` : stdout;
        const truncatedStderr = stderr.length > MAX_OUTPUT_CHARS ? stderr.slice(0, MAX_OUTPUT_CHARS) + `... (truncado, ${stderr.length} chars)` : stderr;

        if (signal === "SIGTERM" || signal === "SIGKILL") {
          resolve({
            success: false,
            error: `Comando terminado por señal: ${signal}`,
            status: "timeout",
            exitCode,
            stdout: truncatedStdout,
            stderr: truncatedStderr,
            durationMs
          });
          return;
        }

        if (exitCode === 0) {
          resolve({
            success: true,
            exitCode,
            stdout: truncatedStdout,
            stderr: truncatedStderr,
            durationMs,
            status: "success"
          });
          return;
        }

        resolve({
          success: false,
          exitCode,
          stdout: truncatedStdout,
          stderr: truncatedStderr,
          durationMs,
          status: "error",
          error: truncatedStderr || `Comando falló con código ${exitCode}`
        });
      });

      child.on("timeout", () => {
        child.kill("SIGTERM");
      });
    });
  }
};

export const { name, description, schema, execute } = tool;
