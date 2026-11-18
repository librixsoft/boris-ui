import { describe, it, expect, afterAll } from "vitest";
import BrowserController from "../src/main/browser/BrowserController";
import { execute as executeBrowserTool } from "../src/main/tools/browser";

// Réplica visual autocontenida de interfaz tipo LinkedIn (con barra superior "Buscar" y feed "Crear publicación")
const LINKEDIN_SIMULATION_HTML = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>LinkedIn Feed Simulation</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f3f2ef;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    /* Barra de navegación superior */
    header {
      background-color: #ffffff;
      height: 54px;
      border-bottom: 1px solid #e0dfdc;
      display: flex;
      align-items: center;
      padding: 0 40px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .logo {
      background-color: #0a66c2;
      color: #ffffff;
      font-weight: bold;
      font-size: 18px;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      margin-right: 12px;
    }
    /* Caja de búsqueda real tipo LinkedIn */
    .search-container {
      position: relative;
      display: flex;
      align-items: center;
    }
    .search-input {
      background-color: #edf3f8;
      border: 1px solid transparent;
      border-radius: 4px;
      height: 34px;
      width: 280px;
      padding: 0 12px;
      font-size: 14px;
      color: #191919;
      outline: none;
      box-sizing: border-box;
    }
    .search-input:focus {
      background-color: #ffffff;
      border-color: #0a66c2;
      box-shadow: 0 0 0 2px rgba(10, 102, 194, 0.2);
    }
    /* Feed principal */
    main {
      max-width: 560px;
      margin: 20px auto;
      padding: 0 16px;
    }
    .post-box-card {
      background-color: #ffffff;
      border-radius: 8px;
      border: 1px solid #e0dfdc;
      padding: 16px;
      margin-bottom: 16px;
    }
    .post-trigger-btn {
      width: 100%;
      height: 48px;
      border-radius: 24px;
      border: 1px solid rgba(0,0,0,0.3);
      background-color: transparent;
      text-align: left;
      padding-left: 20px;
      font-size: 14px;
      font-weight: 600;
      color: #666666;
      cursor: pointer;
    }
    .post-trigger-btn:hover {
      background-color: rgba(0,0,0,0.05);
    }
    #search-status, #post-status {
      font-size: 12px;
      color: #0a66c2;
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">in</div>
    <div class="search-container">
      <input
        type="text"
        class="search-input"
        placeholder="Buscar"
        aria-label="Buscar"
        oninput="document.getElementById('search-status').textContent = 'Buscando: ' + this.value"
      />
    </div>
    <div id="search-status"></div>
  </header>

  <main>
    <div class="post-box-card">
      <button
        class="post-trigger-btn"
        onclick="document.getElementById('post-status').textContent = 'Modal de publicación abierto'"
      >
        Crear publicación
      </button>
      <div id="post-status">Esperando acción...</div>
    </div>
  </main>
</body>
</html>
`;

const LINKEDIN_PAGE_URL = `data:text/html;charset=utf-8,${encodeURIComponent(LINKEDIN_SIMULATION_HTML)}`;

describe("Browser E2E - Flujos de Detección de Coordenadas y Manejo de Errores", () => {
  afterAll(async () => {
    await BrowserController.close();
  });

  describe("Caso 1: El agente encuentra la caja de búsqueda en UI real y escribe", () => {
    it("debería navegar a la página y tomar la captura", async () => {
      const navRes = await BrowserController.goto(LINKEDIN_PAGE_URL);
      expect(navRes.success).toBe(true);

      const ssRes = await BrowserController.screenshot();
      expect(ssRes.success).toBe(true);
      expect(ssRes.screenshot).toBeDefined();
    });

    it("debería localizar las coordenadas de la caja 'Buscar', hacer click y escribir", async () => {
      // 1. El agente localiza las coordenadas de la caja de búsqueda mediante su etiqueta/placeholder visible
      const coords = await BrowserController.findVisualCoordinates({ placeholder: "Buscar" });
      expect(coords).not.toBeNull();
      expect(coords!.x).toBeGreaterThan(0);
      expect(coords!.y).toBeGreaterThan(0);

      // 2. Mueve el cursor físico y hace clic en las coordenadas calculadas
      await BrowserController.mouseClick(coords!.x, coords!.y, { human: true });

      // 3. Escribe en la caja con el teclado físico
      await BrowserController.type("Anthropic", { human: true });

      // 4. Comprueba que el texto fue escrito en la caja de búsqueda
      const pageText = await BrowserController.getPageText();
      expect(pageText.text).toContain("Buscando: Anthropic");
    });

    it("debería hacer clic por coordenadas en el botón 'Crear publicación'", async () => {
      const coords = await BrowserController.findVisualCoordinates({ text: "Crear publicación" });
      expect(coords).not.toBeNull();

      // Clic directo en las coordenadas
      await BrowserController.mouseClick(coords!.x, coords!.y, { human: true });

      const pageText = await BrowserController.getPageText();
      expect(pageText.text).toContain("Modal de publicación abierto");
    });
  });

  describe("Caso 2: El agente NO encuentra la caja (Manejo de Fallo y Recuperación)", () => {
    it("debería retornar found: false sin crash cuando la caja no existe en pantalla", async () => {
      // El agente intenta buscar una caja inexistente (ej. 'CajaDeComentarios' o 'BuscarAmigos')
      const coords = await BrowserController.findVisualCoordinates({ text: "CajaDeComentarios" });
      expect(coords).toBeNull();

      // Vía executeBrowserTool
      const toolRes = await executeBrowserTool({
        action: "findCoordinates",
        text: "CajaDeComentarios"
      });

      expect(toolRes.success).toBe(false);
      expect(toolRes.found).toBe(false);
      expect(toolRes.error).toContain("Elemento visual no encontrado en pantalla");
    });

    it("flujo de recuperación: el agente intenta scroll si no encuentra la caja inicialmente", async () => {
      // 1. Intento 1: No encuentra la caja
      const intento1 = await executeBrowserTool({
        action: "findCoordinates",
        text: "ElementoOcultoAbajo"
      });

      expect(intento1.found).toBe(false);

      // 2. Acción correctiva: el agente NO hace clic a ciegas, sino que realiza scroll para explorar
      const scrollRes = await executeBrowserTool({
        action: "mouseWheel",
        deltaY: 400
      });
      expect(scrollRes.success).toBe(true);

      // 3. Vuelve a tomar captura
      const ssRes = await executeBrowserTool({ action: "screenshot" });
      expect(ssRes.success).toBe(true);

      // 4. Si definitivamente no está, reporta el resultado de forma controlada sin romper la sesión
      const intento2 = await executeBrowserTool({
        action: "findCoordinates",
        text: "ElementoOcultoAbajo"
      });
      expect(intento2.found).toBe(false);
      expect(intento2.error).toBeDefined();
    });
  });

  describe("Cierre limpio de sesión", () => {
    it("debería cerrar el navegador correctamente", async () => {
      const result = await executeBrowserTool({ action: "close" });
      expect(result.success).toBe(true);
      expect(BrowserController.isLaunched).toBe(false);
    });
  });
});
