const fs = require("fs");
const path = require("path");
const { resolveSafePath } = require("./workspace");

module.exports = {
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
  async execute(params) {
    const filePath = resolveSafePath(params.path);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, params.content || "", "utf-8");

    return {
      success: true,
      path: params.path
    };
  }
};
