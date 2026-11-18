import BrowserController from "../browser/BrowserController";
import { Tool } from "./registry";

type BrowserAction = "navigate" | "click" | "clickHuman" | "fill" | "fillHuman" | "extract" | "close" | "pressKey" | "pressKeyHuman" | "search" | "screenshot" | "title" | "url";

interface BrowserParams {
  action: BrowserAction;
  url?: string;
  selector?: string;
  value?: string;
  key?: string;
  query?: string;
}

const tool: Tool = {
  name: "browser",
  description:
    "Navegación web visible. Abre un navegador en ventana visible y permite ir a una URL, hacer clic (normal o humano), rellenar campos (normal o humano), extraer texto, presionar teclas (normal o humano), buscar en la página, capturar pantalla y obtener título/URL. La ventana se mantiene abierta hasta que se cierra. Las acciones 'Human' simulan comportamiento humano: clickHuman mueve el mouse antes de click, fillHuman escribe letra por letra con errores aleatorios, pressKeyHuman tiene retraso humano.",
  schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["navigate", "click", "clickHuman", "fill", "fillHuman", "extract", "close", "pressKey", "pressKeyHuman", "search", "screenshot", "title", "url"],
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
      },
      key: {
        type: "string",
        description: "Tecla a presionar (requerido para action pressKey). Ej: Enter, Tab, Escape, Backspace"
      },
      query: {
        type: "string",
        description: "Texto a buscar en la página (requerido para action search)"
      }
    },
    required: ["action"],
    additionalProperties: false
  },
  async execute(params: Record<string, unknown>): Promise<{ success: boolean; url?: string; selector?: string; value?: string; text?: string; error?: string; screenshot?: string; title?: string; key?: string; query?: string; found?: boolean }> {
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
      case "clickHuman": {
        if (!params.selector) {
          throw new Error("action clickHuman requiere selector");
        }
        return await BrowserController.clickHuman(params.selector as string);
      }
      case "fill": {
        if (!params.selector || !params.value) {
          throw new Error("action fill requiere selector y value");
        }
        return await BrowserController.fill(params.selector as string, params.value as string);
      }
      case "fillHuman": {
        if (!params.selector || !params.value) {
          throw new Error("action fillHuman requiere selector y value");
        }
        return await BrowserController.fillHuman(params.selector as string, params.value as string);
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
      case "pressKey": {
        if (!params.key) {
          throw new Error("action pressKey requiere key");
        }
        return await BrowserController.pressKey(params.key as string);
      }
      case "pressKeyHuman": {
        if (!params.key) {
          throw new Error("action pressKeyHuman requiere key");
        }
        return await BrowserController.pressKeyHuman(params.key as string);
      }
      case "search": {
        if (!params.query) {
          throw new Error("action search requiere query");
        }
        return await BrowserController.search(params.query as string);
      }
      case "screenshot": {
        return await BrowserController.screenshot();
      }
      case "title": {
        return await BrowserController.getTitle();
      }
      case "url": {
        return await BrowserController.getUrl();
      }
      default:
        throw new Error(`Acción de browser no soportada: ${action}`);
    }
  }
};

export const { name, description, schema, execute } = tool;
