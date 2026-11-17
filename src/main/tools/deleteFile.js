const fs = require("fs");
const path = require("path");
const { resolveSafePath } = require("./workspace");

module.exports = {
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
  async execute(params) {
    const filePath = resolveSafePath(params.path);

    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: `Archivo no encontrado: ${params.path}`
      };
    }

    fs.unlinkSync(filePath);

    return {
      success: true,
      path: params.path
    };
  }
};
