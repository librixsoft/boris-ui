import * as fs from "fs";
import * as path from "path";
import { resolveSafePath } from "./workspace";
import { Tool } from "./registry";

const tool: Tool = {
  name: "deleteFile",
  description: "Elimina un archivo. Acepta rutas relativas al workspace o rutas absolutas.",
  schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Ruta del archivo a eliminar (relativa al workspace o absoluta). Para rutas absolutas, especifica la ruta completa (ej: /Users/lastprophet/Downloads/archivo.txt)"
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
