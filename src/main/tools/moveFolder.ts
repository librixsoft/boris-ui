import * as fs from "fs";
import * as path from "path";
import { resolveSafePath } from "./workspace";
import { Tool } from "./registry";

const tool: Tool = {
  name: "moveFolder",
  description: "Mueve un archivo o carpeta a una nueva ubicación en el workspace.",
  schema: {
    type: "object",
    properties: {
      from: {
        type: "string",
        description: "Ruta relativa origen del archivo o carpeta"
      },
      to: {
        type: "string",
        description: "Ruta relativa destino del archivo o carpeta"
      }
    },
    required: ["from", "to"],
    additionalProperties: false
  },
  async execute(params: Record<string, unknown>): Promise<{ success: boolean; from: string; to: string; error?: string }> {
    const fromPath = resolveSafePath(params.from as string);
    const toPath = resolveSafePath(params.to as string);

    const toDir = path.dirname(toPath);
    if (!fs.existsSync(toDir)) {
      fs.mkdirSync(toDir, { recursive: true });
    }

    if (!fs.existsSync(fromPath)) {
      return {
        success: false,
        error: `Origen no encontrado: ${params.from}`,
        from: params.from as string,
        to: params.to as string
      };
    }

    fs.renameSync(fromPath, toPath);

    return {
      success: true,
      from: params.from as string,
      to: params.to as string
    };
  }
};

export const { name, description, schema, execute } = tool;
