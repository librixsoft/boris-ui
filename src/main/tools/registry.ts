import * as fs from "fs";
import * as path from "path";

export interface Tool {
  name: string;
  description: string;
  schema: object;
  execute(params: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  path?: string;
  from?: string;
  to?: string;
  error?: string;
  [key: string]: unknown;
}

const toolsDir = __dirname;
const registry: Tool[] = [];

const files = fs.readdirSync(toolsDir).filter((f: string) => {
  if (f === "registry.ts" || f === "handler.ts" || f === "registry.js" || f === "handler.js") return false;
  if (f.endsWith(".d.ts") || f.endsWith(".map")) return false;
  if (!f.endsWith(".ts") && !f.endsWith(".js")) return false;
  return true;
});

for (const file of files) {
  const modulePath = path.join(toolsDir, file);
  const mod = require(modulePath) as { name?: string; description?: string; schema?: object; execute?: Function };

  if (mod.name && mod.execute) {
    registry.push({
      name: mod.name,
      description: mod.description || "",
      schema: mod.schema || {},
      execute: mod.execute as (params: Record<string, unknown>) => Promise<ToolResult>
    });
  }
}

export function listTools(): Tool[] {
  return registry;
}

export async function executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
  const tool = registry.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Herramienta no encontrada: ${name}`);
  }
  return tool.execute(params);
}
