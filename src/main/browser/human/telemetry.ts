import * as fs from "node:fs";
import * as path from "node:path";

export interface HumanTelemetryEvent {
  ts: number;
  phase: string;
  action: "read" | "navigate" | "write";
  routeClass: "feed" | "search" | "profile" | "messaging" | "other";
  level: string;
  durationMs: number;
  success: boolean;
  code?: string;
  metrics?: Record<string, number>;
}

function getTelemetryPath(): string {
  return process.env.BORIS_HUMAN_TELEMETRY ?? path.join(process.cwd(), "human-telemetry.jsonl");
}

function rotateIfNeeded(filePath: string): void {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > 5 * 1024 * 1024) {
      const rotated = `${filePath}.1`;
      fs.renameSync(filePath, rotated);
    }
  } catch {
    // File doesn't exist yet, no rotation needed
  }
}

export function recordHumanEvent(event: HumanTelemetryEvent, filePath?: string): void {
  const targetPath = filePath ?? getTelemetryPath();
  const dir = path.dirname(targetPath);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // Directory might not be writable
  }

  rotateIfNeeded(targetPath);
  const line = JSON.stringify(event);
  fs.appendFileSync(targetPath, line + "\n");
}

export function readTelemetryEvents(filePath?: string): HumanTelemetryEvent[] {
  const targetPath = filePath ?? getTelemetryPath();
  try {
    const content = fs.readFileSync(targetPath, "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as HumanTelemetryEvent);
  } catch {
    return [];
  }
}

export function clearTelemetry(filePath?: string): void {
  const targetPath = filePath ?? getTelemetryPath();
  try {
    fs.unlinkSync(targetPath);
  } catch {
    // File might not exist
  }
}
