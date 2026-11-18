import BrowserController from "../browser/BrowserController";
import BrowserError, { toBrowserError } from "../browser/BrowserError";
import { Tool } from "./registry";

interface BrowserErrorOutput {
  success: boolean;
  error: string;
  errorDetail: {
    operation: string;
    url?: string;
    originalMessage: string;
    stack?: string;
    cause?: string;
  };
}

type BrowserAction =
  | "navigate"
  | "screenshot"
  | "findCoordinates"
  | "findElements"
  | "getLinks"
  | "elementAtPoint"
  | "mouseMove"
  | "mouseClick"
  | "mouseDoubleClick"
  | "mouseWheel"
  | "scrollToText"
  | "scrollToBottom"
  | "type"
  | "pressKey"
  | "pressKeyHuman"
  | "title"
  | "url"
  | "pageText"
  | "close"
  | "stop";

interface BrowserParams {
  action: BrowserAction;
  url?: string;
  value?: string;
  key?: string;
  text?: string;
  placeholder?: string;
  deltaY?: number;
  x?: number;
  y?: number;
  human?: boolean;
  targetColor?: string;
  limit?: number;
  offset?: number;
  options?: {
    mistakes?: boolean;
    mistakesCount?: number;
    typingSpeed?: { min: number; max: number };
  };
}

const tool: Tool = {
  name: "browser",
  description:
    "Navegación web visible y automatización por coordenadas y visión. El modelo VE la página en cada screenshot: úsala para percibir la pantalla y confirmar clics. Combina la visión con pageText, getLinks, elementAtPoint y findCoordinates para extraer datos exactos y confirmar coordenadas. Acciones: navigate, screenshot, findCoordinates, findElements, getLinks, elementAtPoint, mouseWheel, scrollToText, scrollToBottom, mouseMove, mouseClick, mouseDoubleClick, type, pressKey, pressKeyHuman, title, url, pageText, close, stop. Reglas: (1) tras navigate, mouseClick o mouseWheel, usa screenshot para ver el resultado; (2) nunca mouseClick sin haber confirmado el punto con findCoordinates, elementAtPoint o getLinks; (3) para extraer emails, nombres o URLs usa pageText y getLinks, la imagen puede tener errores de lectura; (4) para llegar al final: scrollToBottom; para un texto concreto: scrollToText.",
  schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "navigate",
          "screenshot",
          "findCoordinates",
          "findElements",
          "getLinks",
          "elementAtPoint",
          "mouseMove",
          "mouseClick",
          "mouseDoubleClick",
          "mouseWheel",
          "scrollToText",
          "scrollToBottom",
          "type",
          "pressKey",
          "pressKeyHuman",
          "title",
          "url",
          "pageText",
          "close",
          "stop"
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
      text: {
        type: "string",
        description: "Texto visual a localizar en pantalla para findCoordinates (ej: 'Buscar', 'Crear publicación')"
      },
      placeholder: {
        type: "string",
        description: "Placeholder o etiqueta a buscar para findCoordinates (ej: 'Buscar')"
      },
      deltaY: {
        type: "number",
        description: "Píxeles verticales para mouseWheel (positivo abajo, negativo arriba)"
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
    errorDetail?: {
      operation: string;
      url?: string;
      originalMessage: string;
      stack?: string;
      cause?: string;
    };
    screenshot?: string;
    title?: string;
    key?: string;
    found?: boolean;
    x?: number;
    y?: number;
  }> {
    const action = params.action as BrowserAction;

    const validationError = (message: string): BrowserError => {
      const url = BrowserController.currentUrl;
      return new BrowserError({
        operation: action,
        url,
        originalMessage: message
      });
    };

    try {
      switch (action) {
        case "navigate": {
          if (!params.url) {
            throw validationError("action navigate requiere url");
          }
          return await BrowserController.goto(params.url as string);
        }
        case "screenshot": {
          return await BrowserController.screenshot();
        }
        case "findCoordinates": {
          if (!params.text && !params.placeholder && !params.targetColor) {
            throw validationError("action findCoordinates requiere text, placeholder o targetColor");
          }
          const coords = await BrowserController.findVisualCoordinates({
            text: params.text as string | undefined,
            placeholder: params.placeholder as string | undefined,
            targetColor: params.targetColor as string | undefined
          });
          if (!coords || (typeof coords === "object" && "found" in coords && !coords.found)) {
            return {
              success: false,
              found: false,
              error: `Elemento visual no encontrado en pantalla: "${params.text || params.placeholder || params.targetColor}"`,
              ...(typeof coords === "object" && "hint" in coords ? { hint: coords.hint } : {})
            };
          }
          return { success: true, found: true, x: (coords as { x: number; y: number }).x, y: (coords as { x: number; y: number }).y };
        }
        case "mouseWheel": {
          return await BrowserController.mouseWheel(typeof params.deltaY === "number" ? params.deltaY : 300);
        }
        case "mouseMove": {
          if (typeof params.x !== "number" || typeof params.y !== "number") {
            throw validationError("action mouseMove requiere x e y numéricos");
          }
          return await BrowserController.mouseMove(params.x, params.y, { human: params.human as boolean | undefined });
        }
        case "mouseClick": {
          if (typeof params.x !== "number" || typeof params.y !== "number") {
            throw validationError("action mouseClick requiere x e y numéricos");
          }
          return await BrowserController.mouseClick(params.x, params.y, { human: params.human as boolean | undefined });
        }
        case "mouseDoubleClick": {
          if (typeof params.x !== "number" || typeof params.y !== "number") {
            throw validationError("action mouseDoubleClick requiere x e y numéricos");
          }
          return await BrowserController.mouseDoubleClick(params.x, params.y);
        }
        case "type": {
          if (typeof params.value !== "string") {
            throw validationError("action type requiere value");
          }
          return await BrowserController.type(params.value, {
            human: params.human as boolean | undefined,
            ...(params.options as object || {})
          });
        }
        case "pressKey": {
          if (!params.key) {
            throw validationError("action pressKey requiere key");
          }
          return await BrowserController.pressKey(params.key as string);
        }
        case "pressKeyHuman": {
          if (!params.key) {
            throw validationError("action pressKeyHuman requiere key");
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
        case "findElements": {
          if (!params.text) {
            throw validationError("action findElements requiere text");
          }
          return await BrowserController.findElements(params.text as string, typeof params.limit === "number" ? params.limit : 10);
        }
        case "getLinks": {
          return await BrowserController.getLinks(typeof params.limit === "number" ? params.limit : 10);
        }
        case "elementAtPoint": {
          if (typeof params.x !== "number" || typeof params.y !== "number") {
            throw validationError("action elementAtPoint requiere x e y numéricos");
          }
          return await BrowserController.elementAtPoint(params.x, params.y);
        }
        case "scrollToText": {
          if (!params.text) {
            throw validationError("action scrollToText requiere text");
          }
          return await BrowserController.scrollToText(params.text as string, typeof params.offset === "number" ? params.offset : 0);
        }
        case "scrollToBottom": {
          return await BrowserController.scrollToBottom();
        }
        case "close": {
          return await BrowserController.close();
        }
        case "stop": {
          return await BrowserController.stop();
        }
        default:
          throw validationError(`Acción de browser no soportada: ${action}`);
      }
    } catch (error) {
      const browserError = toBrowserError(action, BrowserController.currentUrl, error);
      return {
        success: false,
        error: browserError.message,
        errorDetail: browserError.toDetail()
      } satisfies BrowserErrorOutput;
    }
  }
};

export const { name, description, schema, execute } = tool;
