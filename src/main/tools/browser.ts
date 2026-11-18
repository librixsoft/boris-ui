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
  | "mouseMove"
  | "mouseClick"
  | "mouseDoubleClick"
  | "mouseWheel"
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
          "mouseWheel",
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
          if (!coords) {
            return {
              success: false,
              found: false,
              error: `Elemento visual no encontrado en pantalla: "${params.text || params.placeholder || params.targetColor}"`
            };
          }
          return { success: true, found: true, x: coords.x, y: coords.y };
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
