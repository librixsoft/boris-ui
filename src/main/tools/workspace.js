const path = require("path");

const WORKSPACE_ROOT = path.join(__dirname, "..", "..", "..", "workspace");

function resolveSafePath(userPath) {
  if (path.isAbsolute(userPath)) {
    throw new Error(`Ruta absoluta no permitida: ${userPath}`);
  }

  const normalized = path.normalize(userPath);
  if (normalized.startsWith("..") || normalized.startsWith("/")) {
    throw new Error(`Traversal no permitido: ${userPath}`);
  }

  const resolved = path.resolve(WORKSPACE_ROOT, normalized);
  const sep = path.sep;
  const prefix = WORKSPACE_ROOT + sep;

  if (resolved !== WORKSPACE_ROOT && !resolved.startsWith(prefix)) {
    throw new Error(`Ruta fuera del workspace: ${resolved}`);
  }

  return resolved;
}

module.exports = { WORKSPACE_ROOT, resolveSafePath };
