# boris-ui

## Instalación

```bash
npm install
```

## Ejecutar la aplicación

```bash
npm run build
npm start
```

## Ejecutar tests

### Todos los tests (unitarios + E2E)

```bash
npm test
```

### Solo tests unitarios

```bash
npm test tests/toolParser.test.ts tests/workspace.test.ts
```

### Solo tests E2E del browser

```bash
npm test tests/browser.e2e.test.ts
```

## Tests disponibles

- **toolParser.test.ts** (67 tests): Parser de tool calls del LLM, cobertura de tags malformados y stream progresivo
- **workspace.test.ts** (25 tests): Resolución de rutas absolutas y relativas del workspace
- **browser.e2e.test.ts** (17 tests): Tests E2E que simulan comportamiento humano en el navegador (escritura letra por letra, clicks con movimiento de mouse, errores y correcciones)

## Stack

- Electron
- TypeScript
- Playwright (para automatización de browser)
- Vitest (para tests)
