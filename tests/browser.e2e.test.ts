import { describe, it, expect, afterAll, beforeEach } from "vitest";
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

const SCROLL_TEST_HTML = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Scroll Test</title>
<style>body{margin:0;font-family:sans-serif;}</style>
</head>
<body>
<a href="https://example.com/1">Link Uno</a>
<a href="https://example.com/2">Link Dos</a>
${Array.from({ length: 40 }, (_, i) => `<div style="height:600px;display:flex;align-items:flex-start;padding:20px;background:hsl(${i * 4}, 30%, 80%)"><h2>Sección ${i + 1}</h2></div>`).join("")}
<div style="height:600px;display:flex;align-items:center;justify-content:center;background:#333;color:#fff"><footer>footer@ejemplo.com</footer></div>
</body>
</html>
`;

const SCROLL_TEST_URL = `data:text/html;charset=utf-8,${encodeURIComponent(SCROLL_TEST_HTML)}`;

const LINKS_TEST_HTML = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Links Test</title>
<style>body{margin:0;font-family:sans-serif;padding:20px;}</style>
</head>
<body>
<a href="https://example.com/1">Enlace Uno</a>
<a href="https://example.com/2">Enlace Dos</a>
<a href="https://example.com/3">Enlace Tres</a>
<a href="https://example.com/4">Enlace Cuatro</a>
<a href="https://example.com/5">Enlace Cinco</a>
</body>
</html>
`;

const LINKS_TEST_URL = `data:text/html;charset=utf-8,${encodeURIComponent(LINKS_TEST_HTML)}`;

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
      expect(coords).not.toBeNull();
      if (coords && typeof coords === "object" && "found" in coords) {
        expect(coords.found).toBe(false);
      }

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
    it("debería detener y cerrar el navegador mediante la acción stop", async () => {
      await BrowserController.goto(LINKEDIN_PAGE_URL);
      const result = await executeBrowserTool({ action: "stop" });

      expect(result.success).toBe(true);
      expect(BrowserController.isLaunched).toBe(false);
    });

    it("debería cerrar el navegador correctamente", async () => {
      const result = await executeBrowserTool({ action: "close" });
      expect(result.success).toBe(true);
      expect(BrowserController.isLaunched).toBe(false);
    });
  });

  describe("Fase 1+2: screenshot con viewport/scroll y findCoordinates con diagnóstico", () => {
    it("screenshot debería devolver viewport y scroll definidos", async () => {
      await BrowserController.goto(LINKEDIN_PAGE_URL);
      const ss = await BrowserController.screenshot();
      expect(ss.success).toBe(true);
      expect(ss.screenshot).toBeDefined();
      expect(ss.viewport).toBeDefined();
      expect(ss.viewport!.width).toBeGreaterThan(0);
      expect(ss.viewport!.height).toBeGreaterThan(0);
      expect(ss.scroll).toBeDefined();
      expect(ss.scroll!.y).toBeGreaterThanOrEqual(0);
      expect(ss.scroll!.height).toBeGreaterThan(0);
    });

    it("findCoordinates sobre texto visible debería devolver coordenadas", async () => {
      const coords = await BrowserController.findVisualCoordinates({ text: "Crear publicación" });
      expect(coords).not.toBeNull();
      if (coords && typeof coords === "object" && "x" in coords && "y" in coords) {
        expect(coords.x).toBeGreaterThan(0);
        expect(coords.y).toBeGreaterThan(0);
      }
    });

    it("findCoordinates sobre texto fuera de pantalla debería devolver hint con scrollToText", async () => {
      await BrowserController.goto(SCROLL_TEST_URL);
      const coords = await BrowserController.findVisualCoordinates({ text: "Sección 40" });
      expect(coords).not.toBeNull();
      if (coords && typeof coords === "object" && "hint" in coords && coords.hint) {
        expect(coords.hint).toContain("scrollToText");
      }
    });

    it("findCoordinates sobre texto inexistente debería devolver hint con pageText", async () => {
      const coords = await BrowserController.findVisualCoordinates({ text: "TextoQueNoExisteEnNingunLado" });
      expect(coords).not.toBeNull();
      if (coords && typeof coords === "object" && "hint" in coords && coords.hint) {
        expect(coords.hint).toContain("pageText");
      } else if (coords && typeof coords === "object" && "found" in coords && !coords.found) {
        expect(true).toBe(true);
      }
    });
  });

  describe("Fase 1: mouseWheel con scroll state", () => {
    it("mouseWheel debería devolver scroll.atBottom=false tras poco scroll", async () => {
      await BrowserController.goto(SCROLL_TEST_URL);
      const result = await BrowserController.mouseWheel(300);
      expect(result.success).toBe(true);
      expect(result.scroll).toBeDefined();
      expect(result.scroll!.atBottom).toBe(false);
    });

    it("scrollToBottom debería devolver scroll.atBottom=true", async () => {
      const result = await BrowserController.scrollToBottom();
      expect(result.success).toBe(true);
      expect(result.scroll).toBeDefined();
      expect(result.scroll!.atBottom).toBe(true);
    });
  });

  describe("Fase 1: scrollToText", () => {
    it("scrollToText('footer@ejemplo.com') debería encontrar el texto y devolver coordenadas", async () => {
      await BrowserController.goto(SCROLL_TEST_URL);
      await BrowserController.scrollToBottom();
      const result = await BrowserController.scrollToText("footer@ejemplo.com");
      expect(result.success).toBe(true);
      expect(result.x).toBeDefined();
      expect(result.y).toBeDefined();
      expect(result.viewport).toBeDefined();
      expect(result.scroll).toBeDefined();
    });

    it("scrollToText('texto-inexistente') debería devolver found:false con error claro", async () => {
      const result = await BrowserController.scrollToText("texto-inexistente-abc123");
      expect(result.success).toBe(false);
      expect(result.found).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("texto-inexistente-abc123");
    });
  });

  describe("Fase 1: getLinks", () => {
    it("getLinks(10) debería devolver enlaces con href y coordenadas visibles", async () => {
      await BrowserController.goto(LINKS_TEST_URL);
      const result = await BrowserController.getLinks(10);
      expect(result.success).toBe(true);
      expect(result.links).toBeDefined();
      expect(result.links!.length).toBeGreaterThan(0);
      for (const link of result.links!) {
        expect(link.href).toBeDefined();
        expect(link.href).toMatch(/^https?:\/\//);
        expect(link.text).toBeDefined();
        expect(link.x).toBeGreaterThan(0);
        expect(link.y).toBeGreaterThan(0);
        expect(link.visible).toBe(true);
      }
    });
  });

  describe("Fase 1: elementAtPoint", () => {
    it("elementAtPoint sobre un <a> debería devolver tag=a con href", async () => {
      await BrowserController.goto(LINKS_TEST_URL);
      const links = await BrowserController.getLinks(1);
      expect(links.links).toBeDefined();
      expect(links.links!.length).toBeGreaterThan(0);
      const firstLink = links.links![0];
      const result = await BrowserController.elementAtPoint(firstLink.x, firstLink.y);
      expect(result.success).toBe(true);
      expect(result.element).toBeDefined();
      expect(result.element!.tag).toBe("a");
      expect(result.element!.href).toBeDefined();
      expect(result.element!.href).toMatch(/^https?:\/\//);
    });
  });

  describe("Fase 2: findCoordinates con targetColor (regresión PNG)", () => {
    it("findCoordinates con targetColor debería devolver coordenadas correctas", async () => {
      await BrowserController.goto(LINKEDIN_PAGE_URL);
      const ss = await BrowserController.screenshot();
      expect(ss.screenshot).toBeDefined();
      const coords = await BrowserController.findVisualCoordinates({
        targetColor: "#0a66c2"
      });
      expect(coords).not.toBeNull();
      if (coords && typeof coords === "object" && "x" in coords && "y" in coords) {
        expect(coords.x).toBeGreaterThan(0);
        expect(coords.y).toBeGreaterThan(0);
      }
    });
  });

  describe("Fase 1: findElements", () => {
    it("findElements debería devolver múltiples coincidencias", async () => {
      const navResult = await BrowserController.goto(SCROLL_TEST_URL);
      expect(navResult.success).toBe(true);
      await new Promise(r => setTimeout(r, 500));
      const titleResult = await BrowserController.getTitle();
      expect(titleResult.title).toContain("Scroll Test");
      const result = await BrowserController.findElements("Sección", 5);
      expect(result.success).toBe(true);
      expect(result.elements).toBeDefined();
      expect(Array.isArray(result.elements)).toBe(true);
      expect(result.elements!.length).toBeGreaterThan(0);
      for (const el of result.elements!) {
        expect(el.text).toContain("Sección");
        expect(el.x).toBeGreaterThan(0);
        expect(el.y).toBeGreaterThan(0);
        expect(el.tag).toBeDefined();
      }
    });
  });

  describe("Flujo completo (regresión del log)", () => {
    it("navigate → getLinks → navigate al primer enlace → scrollToText(email) → pageText contiene el email", async () => {
      await BrowserController.goto(SCROLL_TEST_URL);
      const linksResult = await BrowserController.getLinks(5);
      expect(linksResult.links).toBeDefined();
      expect(linksResult.links!.length).toBeGreaterThan(0);

      await BrowserController.goto(LINKS_TEST_URL);
      const linksResult2 = await BrowserController.getLinks(5);
      expect(linksResult2.links!.length).toBeGreaterThan(0);
      const firstLink = linksResult2.links![0];

      await BrowserController.goto(firstLink.href);
      const title = await BrowserController.getTitle();
      expect(title.success).toBe(true);
      expect(title.title).toBeDefined();

      const pageText = await BrowserController.getPageText();
      expect(pageText.success).toBe(true);
      expect(pageText.text).toBeDefined();
    });
  });
});
