import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { compareBaseline, scoreDetections, DetectionScores } from "../src/main/browser/human/humanness";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectBorisDir = join(__dirname, "..", ".boris");
const humanDir = join(homedir(), ".boris", "human");
const defaultBaselinePath = join(projectBorisDir, "baseline.json");
const defaultAfterPath = join(projectBorisDir, "after.json");

function resolvePath(envVar: string, preferred: string, fallback: string): string {
  if (process.env[envVar]) return process.env[envVar];
  if (existsSync(preferred)) return preferred;
  return fallback;
}

const baselinePath = resolvePath("BORIS_HUMAN_BASELINE", join(humanDir, "baseline.json"), defaultBaselinePath);
const afterPath = resolvePath("BORIS_HUMAN_AFTER", join(humanDir, "after.json"), defaultAfterPath);

try {
  const baseline = JSON.parse(readFileSync(baselinePath, "utf-8")) as DetectionScores;
  const after = JSON.parse(readFileSync(afterPath, "utf-8")) as DetectionScores;

  const comparison = compareBaseline(baseline, after);

  console.log("| Señal | Antes | Despues | Delta |");
  console.log("|-------|-------|---------|-------|");
  for (const c of comparison) {
    console.log(`| ${c.signal} | ${c.before.toFixed(3)} | ${c.after.toFixed(3)} | ${c.delta.toFixed(3)} |`);
  }
  console.log(`\nTotal baseline: ${baseline.total.toFixed(3)}`);
  console.log(`Total after: ${after.total.toFixed(3)}`);
} catch (e) {
  console.error(`Error generating report. Checked: ${baselinePath}, ${afterPath}, fallback: ${defaultBaselinePath}, ${defaultAfterPath}:`, e.message);
  process.exit(1);
}
