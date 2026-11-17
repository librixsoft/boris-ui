import * as fs from "fs";
import * as path from "path";
import { resolveSafePath } from "./workspace";
import { Tool } from "./registry";

const tool: Tool = {
  name: "deleteFile",
  description: "Elimina un archivo del workspace.",
  schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Ruta relativa al workspace del archivo a eliminar"
      }
    },
    required: ["path"],
    additionalProperties: false
  },
  async execute(params: Record<string, unknown>): Promise<{ success: boolean; path: string; error?: string }> {
    const filePath = resolveSafePath(params.path as string);

    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: `Archivo no encontrado: ${params.path}`,
        path: params.path as string
      };
    }

    fs.unlinkSync(filePath);

    return {
      success: true,
      path: params.path as string
    };
  }
};

export const { name, description, schema, execute } = tool;
