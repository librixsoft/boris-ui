import BrowserController from "../browser/BrowserController";
import { Tool } from "./registry";

type BrowserAction = "navigate" | "click" | "fill" | "extract" | "close";

interface BrowserParams {
  action: BrowserAction;
  url?: string;
  selector?: string;
  value?: string;
}

const tool: Tool = {
  name: "browser",
  description:
    "Navegación web visible. Abre un navegador en ventana visible y permite ir a una URL, hacer clic, rellenar campos y extraer texto. La ventana se mantiene abierta hasta que se cierra.",
  schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["navigate", "click", "fill", "extract", "close"],
        description: "Acción de navegación a ejecutar"
      },
      url: {
        type: "string",
        description: "URL a visitar (requerido para action navigate)"
      },
      selector: {
        type: "string",
        description: "Selector CSS del elemento (requerido para click/fill/extract)"
      },
      value: {
        type: "string",
        description: "Valor a escribir (requerido para action fill)"
      }
    },
    required: ["action"],
    additionalProperties: false
  },
  async execute(params: Record<string, unknown>): Promise<{ success: boolean; url?: string; selector?: string; value?: string; text?: string; error?: string }> {
    const action = params.action as BrowserAction;

    switch (action) {
      case "navigate": {
        if (!params.url) {
          throw new Error("action navigate requiere url");
        }
        return await BrowserController.goto(params.url as string);
      }
      case "click": {
        if (!params.selector) {
          throw new Error("action click requiere selector");
        }
        return await BrowserController.click(params.selector as string);
      }
      case "fill": {
        if (!params.selector || !params.value) {
          throw new Error("action fill requiere selector y value");
        }
        return await BrowserController.fill(params.selector as string, params.value as string);
      }
      case "extract": {
        if (!params.selector) {
          throw new Error("action extract requiere selector");
        }
        return await BrowserController.extract(params.selector as string);
      }
      case "close": {
        return await BrowserController.close();
      }
      default:
        throw new Error(`Acción de browser no soportada: ${action}`);
    }
  }
};

export const { name, description, schema, execute } = tool;
