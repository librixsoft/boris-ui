import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { compareBaseline, scoreDetections, DetectionScores } from "../src/main/browser/human/humanness";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const baselinePath = join(__dirname, "..", "plans", "baseline.json");
const afterPath = join(__dirname, "..", "plans", "after.json");

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
  console.error("Error generating report:", e);
  process.exit(1);
}
