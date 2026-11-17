const fs = require("fs");
const path = require("path");

const toolsDir = __dirname;
const registry = [];

const files = fs.readdirSync(toolsDir).filter((f) => {
  if (f === "registry.js" || f === "handler.js") return false;
  if (!f.endsWith(".js")) return false;
  return true;
});

for (const file of files) {
  const modulePath = path.join(toolsDir, file);
  const mod = require(modulePath);

  if (mod.name && mod.execute) {
    registry.push({
      name: mod.name,
      description: mod.description,
      schema: mod.schema,
      execute: mod.execute
    });
  }
}

function listTools() {
  return registry;
}

async function executeTool(name, params) {
  const tool = registry.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Herramienta no encontrada: ${name}`);
  }
  return tool.execute(params);
}

module.exports = { listTools, executeTool };
