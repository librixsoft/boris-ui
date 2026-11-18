import { readdirSync, readFileSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const humanDir = join(__dirname, "..", "src", "main", "browser", "human");
const exceptions = ["random.ts"];

function walk(dir) {
  const files = readdirSync(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    const stats = import("fs").then((fs) => fs.statSync(filePath));
    stats.then((s) => {
      if (s.isDirectory()) {
        walk(filePath);
      } else if (extname(file) === ".ts" && !exceptions.includes(file)) {
        checkFile(filePath, file);
      }
    });
  }
}

function checkFile(filePath, fileName) {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\bMath\.random\s*\(/.test(line)) {
      console.error(`FAIL: ${filePath}:${i + 1}: Math.random() found outside random.ts`);
      console.error(`  ${line.trim()}`);
      found = true;
    }
    if (/\bpage\.fill\s*\(/.test(line)) {
      console.error(`FAIL: ${filePath}:${i + 1}: page.fill() found in human layer`);
      console.error(`  ${line.trim()}`);
      found = true;
    }
    if (/\binsertText\s*\(/.test(line)) {
      console.error(`FAIL: ${filePath}:${i + 1}: insertText found in human layer`);
      console.error(`  ${line.trim()}`);
      found = true;
    }
    if (/\bwaitForTimeout\s*\(\s*\d+\s*\)/.test(line)) {
      console.error(`FAIL: ${filePath}:${i + 1}: waitForTimeout with literal found in human layer`);
      console.error(`  ${line.trim()}`);
      found = true;
    }
  }
  return found;
}

let anyFail = false;
walk(humanDir);

if (anyFail) {
  console.error("\nGate failed: violations found in human layer");
  process.exit(1);
} else {
  console.log("Gate passed: all human layer checks passed");
}
