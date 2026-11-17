import * as path from "path";

export const WORKSPACE_ROOT = "/Users/lastprophet/.boris/workspace";

export function resolveSafePath(userPath: string): string {
  const normalized = path.normalize(userPath);

  if (path.isAbsolute(userPath)) {
    if (normalized.split(path.sep).includes("..")) {
      throw new Error(`Traversal no permitido en ruta absoluta: ${userPath}`);
    }
    if (!normalized.startsWith(WORKSPACE_ROOT + path.sep) && normalized !== WORKSPACE_ROOT) {
      return normalized;
    }
    return normalized;
  }

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
