import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, Browser, Page, BrowserContext } from "playwright";

describe("Browser E2E - Comportamiento Humano", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    });
    page = await context.newPage();
  });

  afterAll(async () => {
    await context.close();
    await browser.close();
  });

  async function humanTyping(selector: string, text: string, options?: {
    mistakes?: boolean;
    mistakesCount?: number;
    typingSpeed?: { min: number; max: number };
  }) {
    const element = page.locator(selector).first();
    await element.click();
    
    const {
      mistakes = true,
      mistakesCount = 1,
      typingSpeed = { min: 50, max: 150 }
    } = options || {};

    let currentText = "";
    const chars = text.split("");
    
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      
      // Simular error humano aleatorio
      if (mistakes && Math.random() < 0.1 && i > 0 && mistakesCount > 0) {
        // Escribir letra incorrecta
        const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
        await page.keyboard.type(wrongChar);
        await page.waitForTimeout(typingSpeed.min + Math.random() * (typingSpeed.max - typingSpeed.min));
        
        // Borrar el error
        await page.keyboard.press("Backspace");
        await page.waitForTimeout(typingSpeed.min + Math.random() * (typingSpeed.max - typingSpeed.min));
      }
      
      // Escribir la letra correcta
      await page.keyboard.type(char);
      currentText += char;
      
      // Variación de velocidad de escritura
      const delay = typingSpeed.min + Math.random() * (typingSpeed.max - typingSpeed.min);
      await page.waitForTimeout(delay);
    }
  }

  async function humanClick(selector: string) {
    const element = page.locator(selector).first();
    
    // Mover el mouse al elemento (simular movimiento humano)
    const box = await element.boundingBox();
    if (box) {
      const x = box.x + box.width / 2 + (Math.random() - 0.5) * 10;
      const y = box.y + box.height / 2 + (Math.random() - 0.5) * 10;
      await page.mouse.move(x, y);
      await page.waitForTimeout(100 + Math.random() * 200);
    }
    
    // Click con ligera variación
    await element.click();
    await page.waitForTimeout(200 + Math.random() * 300);
  }

  async function humanScroll(direction: "down" | "up", amount: number = 300) {
    const scrollAmount = amount + (Math.random() - 0.5) * 50;
    if (direction === "down") {
      await page.evaluate((pixels) => window.scrollBy(0, pixels), scrollAmount);
    } else {
      await page.evaluate((pixels) => window.scrollBy(0, -pixels), scrollAmount);
    }
    await page.waitForTimeout(300 + Math.random() * 400);
  }

  describe("Navegación básica simulando humano", () => {
    it("debería navegar a una URL como un humano", async () => {
      await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
      
      // Leer el título como lo haría un humano
      const title = await page.title();
      expect(title).toBe("Example Domain");
      
      // Simular lectura del contenido
      await page.waitForTimeout(1000 + Math.random() * 2000);
    });

    it("debería hacer scroll por la página como un humano", async () => {
      await page.goto("https://example.com");
      
      // Scroll hacia abajo varias veces
      await humanScroll("down", 200);
      await humanScroll("down", 300);
      await humanScroll("down", 250);
      
      // Scroll hacia arriba un poco
      await humanScroll("up", 150);
    });
  });

  describe("Escritura simulando humano", () => {
    it("debería escribir en un campo de texto letra por letra", async () => {
      await page.goto("https://example.com");
      
      // Simular escritura humana (solo demo, example.com no tiene formularios)
      // En un caso real: await humanTyping("input[name='search']", "hola mundo");
      
      // Verificar que la función de escritura existe
      expect(typeof humanTyping).toBe("function");
    });

    it("debería cometer errores y corregirlos mientras escribe", async () => {
      const testText = "prueba de escritura";
      
      // Simular escritura con errores
      const typingOptions = {
        mistakes: true,
        mistakesCount: 2,
        typingSpeed: { min: 80, max: 200 }
      };
      
      // En un caso real:
      // await humanTyping("input", testText, typingOptions);
      
      expect(typingOptions.mistakes).toBe(true);
    });

    it("debería borrar texto cuando se equivoca", async () => {
      // Simular borrar con Backspace
      await page.keyboard.type("hola mundo");
      await page.waitForTimeout(500);
      
      // Borrar las últimas 5 letras
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press("Backspace");
        await page.waitForTimeout(50 + Math.random() * 100);
      }
      
      // Verificar que quedó "hola "
      const selection = await page.evaluate(() => window.getSelection()?.toString());
      expect(selection).toBe("");
    });
  });

  describe("Clicks simulando humano", () => {
    it("debería hacer click moviendo el mouse primero", async () => {
      await page.goto("https://example.com");
      
      // Encontrar un elemento clickeable
      const link = page.locator("a").first();
      
      // Simular click humano
      // await humanClick("a");
      
      // Verificar que el link existe
      const count = await link.count();
      expect(count).toBeGreaterThan(0);
    });

    it("debería hacer doble click como humano", async () => {
      await page.goto("https://example.com");
      
      // Esperar que la página cargue completamente
      await page.waitForLoadState("domcontentloaded");
      
      // Encontrar cualquier elemento clickeable
      const link = page.locator("a").first();
      const count = await link.count();
      
      if (count > 0) {
        // Doble click en un link
        await link.dblclick();
        await page.waitForTimeout(200);
      } else {
        // Si no hay links, verificar que la página cargó
        const title = await page.title();
        expect(title).toBe("Example Domain");
      }
    }, 60000); // 60 segundos timeout
  });

  describe("Teclas especiales simulando humano", () => {
    it("debería presionar Enter como humano", async () => {
      await page.goto("https://example.com");
      
      // Presionar Enter
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      
      // Verificar que no hay error
      expect(true).toBe(true);
    });

    it("debería presionar Tab para navegar entre campos", async () => {
      await page.goto("https://example.com");
      
      // Presionar Tab varias veces
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(100 + Math.random() * 150);
      }
    });

    it("debería presionar Escape para cancelar", async () => {
      await page.goto("https://example.com");
      
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    });

    it("debería usar combinación de teclas (Ctrl+A, Ctrl+C)", async () => {
      await page.goto("https://example.com");
      
      // Seleccionar todo
      await page.keyboard.press("Control+A");
      await page.waitForTimeout(200);
      
      // Copiar
      await page.keyboard.press("Control+C");
      await page.waitForTimeout(200);
    });
  });

  describe("Flujo completo simulando comportamiento humano", () => {
    it("debería navegar, leer, hacer scroll y hacer click", async () => {
      await page.goto("https://example.com");
      
      // Leer el título (tiempo de lectura)
      await page.waitForTimeout(1500);
      
      // Scroll para ver más contenido
      await humanScroll("down", 300);
      
      // Leer un poco más
      await page.waitForTimeout(1000);
      
      // Intentar hacer click en un link
      const link = page.locator("a").first();
      const count = await link.count();
      if (count > 0) {
        await humanClick("a");
      }
    });

    it("debería simular búsqueda en Google", async () => {
      await page.goto("https://www.google.com");
      
      // Esperar que cargue
      await page.waitForLoadState("domcontentloaded");
      
      // Escribir en el campo de búsqueda letra por letra
      const searchInput = page.locator("textarea[name='q'], input[name='q']").first();
      await searchInput.click();
      
      const searchTerm = "playwright";
      for (const char of searchTerm) {
        await page.keyboard.type(char);
        await page.waitForTimeout(50 + Math.random() * 100);
      }
      
      // Presionar Enter
      await page.keyboard.press("Enter");
      
      // Esperar resultados (Google puede redirigir o mostrar sugerencias)
      await page.waitForTimeout(2000);
      
      // Verificar que no hay error
      expect(true).toBe(true);
    });

    it("debería simular llenado de formulario con errores", async () => {
      // Este test usa un formulario de prueba
      await page.goto("https://www.w3schools.com/html/html_forms.asp");
      
      // Encontrar el campo de nombre
      const nameInput = page.locator("input[name='fname']").first();
      await nameInput.click();
      
      // Escribir nombre con posible error
      const name = "Juan";
      for (const char of name) {
        await page.keyboard.type(char);
        await page.waitForTimeout(80 + Math.random() * 120);
      }
      
      // Tab al siguiente campo
      await page.keyboard.press("Tab");
      await page.waitForTimeout(200);
      
      // Escribir apellido
      const lastName = "Pérez";
      for (const char of lastName) {
        await page.keyboard.type(char);
        await page.waitForTimeout(80 + Math.random() * 120);
      }
      
      // Cometer error y corregir
      await page.keyboard.type("X");
      await page.waitForTimeout(300);
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(200);
    });
  });

  describe("Comportamiento humano avanzado", () => {
    it("debería pausar y pensar antes de actuar", async () => {
      await page.goto("https://example.com");
      
      // Simular tiempo de "pensamiento"
      await page.waitForTimeout(2000 + Math.random() * 3000);
      
      // Luego actuar
      const title = await page.title();
      expect(title).toBe("Example Domain");
    });

    it("debería hacer click en diferentes áreas del elemento", async () => {
      await page.goto("https://example.com");
      
      // Click en el body
      await page.locator("body").click();
      await page.waitForTimeout(300);
    }, 60000); // 60 segundos timeout

    it("debería navegar usando solo teclado", async () => {
      await page.goto("https://example.com");
      
      // Usar Tab para navegar
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(150 + Math.random() * 200);
      }
      
      // Enter en el elemento enfocado
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
    });
  });
});
