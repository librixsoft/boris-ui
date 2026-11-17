import * as fs from "fs";
import * as path from "path";
import { resolveSafePath } from "./workspace";
import { Tool } from "./registry";

const tool: Tool = {
  name: "createFile",
  description: "Crea un archivo en el workspace. Crea carpetas intermedias si es necesario.",
  schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Ruta relativa al workspace donde crear el archivo"
      },
      content: {
        type: "string",
        description: "Contenido del archivo"
      }
    },
    required: ["path"],
    additionalProperties: false
  },
  async execute(params: Record<string, unknown>): Promise<{ success: boolean; path: string }> {
    const filePath = resolveSafePath(params.path as string);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, (params.content as string) || "", "utf-8");

    return {
      success: true,
      path: params.path as string
    };
  }
};

export const { name, description, schema, execute } = tool;
