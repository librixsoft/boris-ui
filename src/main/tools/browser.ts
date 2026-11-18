import BrowserController from "../browser/BrowserController";
import { Tool } from "./registry";

type BrowserAction =
  | "navigate"
  | "screenshot"
  | "findCoordinates"
  | "mouseMove"
  | "mouseClick"
  | "mouseDoubleClick"
  | "type"
  | "pressKey"
  | "pressKeyHuman"
  | "title"
  | "url"
  | "pageText"
  | "close";

interface BrowserParams {
  action: BrowserAction;
  url?: string;
  value?: string;
  key?: string;
  x?: number;
  y?: number;
  human?: boolean;
  targetColor?: string;
  options?: {
    mistakes?: boolean;
    mistakesCount?: number;
    typingSpeed?: { min: number; max: number };
  };
}

const tool: Tool = {
  name: "browser",
  description:
    "Navegación web visible y automatización basada exclusivamente en capturas de pantalla, visión y coordenadas (X, Y). Permite visitar una URL, tomar capturas de pantalla, localizar coordenadas de elementos visuales, mover el cursor físico, hacer clic en coordenadas, teclear texto con pulsaciones humanas, presionar teclas y leer texto de la página. No utiliza selectores HTML.",
  schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "navigate",
          "screenshot",
          "findCoordinates",
          "mouseMove",
          "mouseClick",
          "mouseDoubleClick",
          "type",
          "pressKey",
          "pressKeyHuman",
          "title",
          "url",
          "pageText",
          "close"
        ],
        description: "Acción visual o de interacción por coordenadas a ejecutar"
      },
      url: {
        type: "string",
        description: "URL a visitar (requerido para action navigate)"
      },
      value: {
        type: "string",
        description: "Texto a escribir con el teclado (requerido para action type)"
      },
      key: {
        type: "string",
        description: "Tecla a presionar (requerido para action pressKey o pressKeyHuman). Ej: Enter, Tab, Escape, Backspace"
      },
      x: {
        type: "number",
        description: "Coordenada horizontal X en píxeles (para mouseMove o mouseClick)"
      },
      y: {
        type: "number",
        description: "Coordenada vertical Y en píxeles (para mouseMove o mouseClick)"
      },
      human: {
        type: "boolean",
        description: "Simular movimiento o retardo humano natural"
      },
      targetColor: {
        type: "string",
        description: "Color hexadecimal (ej: #2563eb) a localizar en la captura para findCoordinates"
      }
    },
    required: ["action"],
    additionalProperties: false
  },
  async execute(params: Record<string, unknown>): Promise<{
    success: boolean;
    url?: string;
    value?: string;
    text?: string;
    error?: string;
    screenshot?: string;
    title?: string;
    key?: string;
    x?: number;
    y?: number;
  }> {
    const action = params.action as BrowserAction;

    switch (action) {
      case "navigate": {
        if (!params.url) {
          throw new Error("action navigate requiere url");
        }
        return await BrowserController.goto(params.url as string);
      }
      case "screenshot": {
        return await BrowserController.screenshot();
      }
      case "findCoordinates": {
        if (!params.targetColor) {
          throw new Error("action findCoordinates requiere targetColor");
        }
        const ss = await BrowserController.screenshot();
        const coords = await BrowserController.findCoordinatesFromScreenshot(ss.screenshot!, params.targetColor as string);
        if (!coords) {
          return { success: false, error: "Color no encontrado en la captura" };
        }
        return { success: true, x: coords.x, y: coords.y };
      }
      case "mouseMove": {
        if (typeof params.x !== "number" || typeof params.y !== "number") {
          throw new Error("action mouseMove requiere x e y numéricos");
        }
        return await BrowserController.mouseMove(params.x, params.y, { human: params.human as boolean | undefined });
      }
      case "mouseClick": {
        if (typeof params.x !== "number" || typeof params.y !== "number") {
          throw new Error("action mouseClick requiere x e y numéricos");
        }
        return await BrowserController.mouseClick(params.x, params.y, { human: params.human as boolean | undefined });
      }
      case "mouseDoubleClick": {
        if (typeof params.x !== "number" || typeof params.y !== "number") {
          throw new Error("action mouseDoubleClick requiere x e y numéricos");
        }
        return await BrowserController.mouseDoubleClick(params.x, params.y);
      }
      case "type": {
        if (typeof params.value !== "string") {
          throw new Error("action type requiere value");
        }
        return await BrowserController.type(params.value, {
          human: params.human as boolean | undefined,
          ...(params.options as object || {})
        });
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
      case "title": {
        return await BrowserController.getTitle();
      }
      case "url": {
        return await BrowserController.getUrl();
      }
      case "pageText": {
        return await BrowserController.getPageText();
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
