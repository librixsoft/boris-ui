const fs = require("fs");
const path = require("path");
const { resolveSafePath } = require("./workspace");

module.exports = {
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
  async execute(params) {
    const fromPath = resolveSafePath(params.from);
    const toPath = resolveSafePath(params.to);

    const toDir = path.dirname(toPath);
    if (!fs.existsSync(toDir)) {
      fs.mkdirSync(toDir, { recursive: true });
    }

    if (!fs.existsSync(fromPath)) {
      return {
        success: false,
        error: `Origen no encontrado: ${params.from}`
      };
    }

    fs.renameSync(fromPath, toPath);

    return {
      success: true,
      from: params.from,
      to: params.to
    };
  }
};
