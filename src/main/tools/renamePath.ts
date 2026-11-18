import * as fs from "fs";
import * as path from "path";
import { resolveSafePath } from "./workspace";
import { Tool } from "./registry";

const tool: Tool = {
  name: "renamePath",
  description: "Renombra un archivo o carpeta. Acepta rutas relativas al workspace o rutas absolutas.",
  schema: {
    type: "object",
    properties: {
      from: {
        type: "string",
        description: "Ruta actual del archivo o carpeta (relativa al workspace o absoluta)"
      },
      to: {
        type: "string",
        description: "Nueva ruta del archivo o carpeta (relativa al workspace o absoluta). Para rutas absolutas, especifica la ruta completa"
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
