import { describe, it, expect, afterAll } from "vitest";
import BrowserController from "../src/main/browser/BrowserController";
import { execute as executeBrowserTool } from "../src/main/tools/browser";

// Página HTML con elementos visuales reconocibles por color y coordenadas fijas/medibles
const VISUAL_TEST_HTML = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Prueba Visual por Coordenadas</title>
  <style>
    body {
      margin: 0;
      padding: 40px;
      font-family: Arial, sans-serif;
      background-color: #f8fafc;
    }
    .titulo {
      font-size: 24px;
      margin-bottom: 30px;
      color: #0f172a;
    }
    /* Campo de texto con borde distintivo verde para detección visual (#10b981) */
    .input-box {
      width: 320px;
      height: 48px;
      border: 4px solid #10b981;
      background-color: #ffffff;
      font-size: 18px;
      padding: 0 16px;
      box-sizing: border-box;
      outline: none;
      display: block;
      margin-bottom: 24px;
    }
    /* Botón con color azul primario (#2563eb) para detección en screenshot */
    .btn-target {
      width: 220px;
      height: 52px;
      background-color: #2563eb;
      color: #ffffff;
      border: none;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      border-radius: 6px;
      display: block;
    }
    .btn-target:active {
      background-color: #1d4ed8;
    }
    #estado-click {
      margin-top: 20px;
      font-size: 16px;
      color: #334155;
    }
  </style>
</head>
<body>
  <div class="titulo">Automatización por Coordenadas y Screenshots</div>

  <input type="text" id="campo-texto" class="input-box" placeholder="Haz click aquí y escribe..." oninput="document.getElementById('estado-input').textContent = this.value" />
  <button id="boton-accion" class="btn-target" onclick="document.getElementById('estado-click').textContent = '¡Click detectado por coordenadas!'">
    Acción Visual
  </button>

  <div id="estado-click">Esperando click...</div>
  <div id="estado-input"></div>
</body>
</html>
`;

const VISUAL_PAGE_URL = `data:text/html;charset=utf-8,${encodeURIComponent(VISUAL_TEST_HTML)}`;

describe("Browser E2E - Automatización basada en Screenshots y Coordenadas", () => {
  afterAll(async () => {
    await BrowserController.close();
  });

  describe("Flujo guiado por Captura de Pantalla y Coordenadas (Sin selectores de elementos)", () => {
    it("1. Debería navegar a la página mediante BrowserController.goto", async () => {
      const result = await BrowserController.goto(VISUAL_PAGE_URL);
      expect(result.success).toBe(true);
      expect(result.url).toContain("data:text/html");
    });

    it("2. Debería tomar un screenshot completo de la pantalla", async () => {
      const result = await BrowserController.screenshot();
      expect(result.success).toBe(true);
      expect(result.screenshot).toBeDefined();
      expect(typeof result.screenshot).toBe("string");
      expect(result.screenshot!.length).toBeGreaterThan(1000);
    });

    it("3. Debería localizar las coordenadas del botón (#2563eb) a partir de la captura", async () => {
      const ssResult = await BrowserController.screenshot();
      const coords = await BrowserController.findCoordinatesFromScreenshot(ssResult.screenshot!, "#2563eb");
      
      expect(coords).not.toBeNull();
      expect(coords!.x).toBeGreaterThan(0);
      expect(coords!.y).toBeGreaterThan(0);
    });

    it("4. Debería mover el mouse a las coordenadas encontradas con movimiento humano", async () => {
      const ssResult = await BrowserController.screenshot();
      const coords = await BrowserController.findCoordinatesFromScreenshot(ssResult.screenshot!, "#2563eb");
      expect(coords).not.toBeNull();

      const moveResult = await BrowserController.mouseMove(coords!.x, coords!.y, { human: true, steps: 15 });
      expect(moveResult.success).toBe(true);
      expect(moveResult.x).toBe(coords!.x);
      expect(moveResult.y).toBe(coords!.y);
    });

    it("5. Debería hacer click en las coordenadas del botón y activar su evento", async () => {
      const ssResult = await BrowserController.screenshot();
      const coords = await BrowserController.findCoordinatesFromScreenshot(ssResult.screenshot!, "#2563eb");
      expect(coords).not.toBeNull();

      // Click directo a nivel de coordenadas (sin pasar ningún selector)
      const clickResult = await BrowserController.mouseClick(coords!.x, coords!.y, { human: true });
      expect(clickResult.success).toBe(true);

      // Verificar que el click se ejecutó en la interfaz
      const pageTextResult = await BrowserController.getPageText();
      expect(pageTextResult.text).toContain("¡Click detectado por coordenadas!");
    });

    it("6. Debería localizar las coordenadas del campo de entrada (#10b981) en la captura", async () => {
      const ssResult = await BrowserController.screenshot();
      const inputCoords = await BrowserController.findCoordinatesFromScreenshot(ssResult.screenshot!, "#10b981");
      
      expect(inputCoords).not.toBeNull();
      expect(inputCoords!.x).toBeGreaterThan(0);
      expect(inputCoords!.y).toBeGreaterThan(0);
    });

    it("7. Debería hacer click en las coordenadas del input y escribir texto con teclado simulando humano", async () => {
      const ssResult = await BrowserController.screenshot();
      const inputCoords = await BrowserController.findCoordinatesFromScreenshot(ssResult.screenshot!, "#10b981");
      expect(inputCoords).not.toBeNull();

      // 1. Mover y hacer click en las coordenadas para darle foco
      await BrowserController.mouseClick(inputCoords!.x, inputCoords!.y, { human: true });

      // 2. Escribir mediante teclado (sin selector)
      const textoAEscribir = "Texto por coordenadas";
      const typeResult = await BrowserController.type(textoAEscribir, {
        human: true,
        mistakes: false,
        typingSpeed: { min: 15, max: 40 }
      });

      expect(typeResult.success).toBe(true);
      expect(typeResult.value).toBe(textoAEscribir);

      // 3. Verificar que el texto está presente en la página
      const pageTextCheck = await BrowserController.getPageText();
      expect(pageTextCheck.text).toContain(textoAEscribir);
    });
  });

  describe("Ejecución mediante la herramienta Browser (Tool Execute)", () => {
    it("debería ejecutar findCoordinates a través de executeBrowserTool", async () => {
      const result = await executeBrowserTool({
        action: "findCoordinates",
        targetColor: "#2563eb"
      });

      expect(result.success).toBe(true);
      expect(typeof result.x).toBe("number");
      expect(typeof result.y).toBe("number");
    });

    it("debería mover el mouse a coordenadas usando executeBrowserTool", async () => {
      const result = await executeBrowserTool({
        action: "mouseMove",
        x: 120,
        y: 120,
        human: true
      });

      expect(result.success).toBe(true);
      expect(result.x).toBe(120);
      expect(result.y).toBe(120);
    });

    it("debería hacer click y escribir mediante executeBrowserTool", async () => {
      // 1. Localizar coordenadas del input
      const coordsRes = await executeBrowserTool({
        action: "findCoordinates",
        targetColor: "#10b981"
      });
      expect(coordsRes.success).toBe(true);

      // 2. Click en coordenadas
      const clickRes = await executeBrowserTool({
        action: "mouseClick",
        x: coordsRes.x!,
        y: coordsRes.y!,
        human: true
      });
      expect(clickRes.success).toBe(true);

      // 3. Escribir texto
      const typeRes = await executeBrowserTool({
        action: "type",
        value: " - Boris UI",
        human: true
      });
      expect(typeRes.success).toBe(true);
    });

    it("debería validar parámetros requeridos para acciones de coordenadas", async () => {
      await expect(executeBrowserTool({ action: "mouseMove" })).rejects.toThrow("action mouseMove requiere x e y numéricos");
      await expect(executeBrowserTool({ action: "mouseClick" })).rejects.toThrow("action mouseClick requiere x e y numéricos");
      await expect(executeBrowserTool({ action: "type" })).rejects.toThrow("action type requiere value");
      await expect(executeBrowserTool({ action: "findCoordinates" })).rejects.toThrow("action findCoordinates requiere targetColor");
    });
  });

  describe("Cierre del navegador", () => {
    it("debería cerrar la sesión del navegador mediante executeBrowserTool", async () => {
      const result = await executeBrowserTool({ action: "close" });
      expect(result.success).toBe(true);
      expect(BrowserController.isLaunched).toBe(false);
    });
  });
});
