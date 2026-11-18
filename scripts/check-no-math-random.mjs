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
    const stat = readdirSync(dir);
    if (stat.includes(file)) {
      const stats = import("fs").then(fs => fs.statSync(filePath));
      stats.then(s => {
        if (s.isDirectory()) {
          walk(filePath);
        } else if (extname(file) === ".ts" && !exceptions.includes(file)) {
          checkFile(filePath, file);
        }
      });
    }
  }
}

function checkFile(filePath, fileName) {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (/\bMath\.random\s*\(/.test(lines[i])) {
      console.error(`FAIL: ${filePath}:${i + 1}: Math.random() found outside random.ts`);
      console.error(`  ${lines[i].trim()}`);
      found = true;
    }
  }
  return found;
}

let anyFail = false;
walk(humanDir);

if (anyFail) {
  console.error("\nGate failed: Math.random() found outside random.ts");
  process.exit(1);
} else {
  console.log("Gate passed: no Math.random() outside random.ts");
}
