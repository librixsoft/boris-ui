import { Tool } from "./tools/registry";
import * as fs from "node:fs";
import * as path from "node:path";

const BORIS_MD_PATH = path.join(__dirname, "..", "BORIS.md");

function loadSystemPromptFromBoris(): string {
  try {
    const content = fs.readFileSync(BORIS_MD_PATH, "utf-8");
    const startMarker = "## System Prompt (LLM)";
    const endMarker = "```";
    const startIdx = content.indexOf(startMarker);
    if (startIdx === -1) return "";
    const afterHeader = content.slice(startIdx + startMarker.length);
    const codeStart = afterHeader.indexOf("```");
    const codeEnd = afterHeader.indexOf("```", codeStart + 3);
    if (codeStart === -1 || codeEnd === -1) return "";
    return afterHeader.slice(codeStart + 3, codeEnd).trim();
  } catch {
    return "";
  }
}

export function buildSystemPrompt(tools: Tool[]): string {
  const toolInstructions = tools
    .map(
      (t) =>
        `Herramienta: ${t.name}
Descripción: ${t.description}
Schema JSON: ${JSON.stringify(t.schema, null, 2)}
`
    )
    .join("\n");

  const basePrompt = loadSystemPromptFromBoris();
  return basePrompt.replace("{toolInstructions}", toolInstructions);
}
