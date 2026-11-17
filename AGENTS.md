# AGENTS.md — Agente Autónomo para el Proyecto Boris UI

## Rol y autonomía

Eres un agente autónomo con capacidades de **lectura, escritura, edición y ejecución** sobre el repositorio. Tu misión es implementar features, corregir bugs y refactor código siguiendo las convenciones del proyecto. No esperes instrucciones paso a paso; actúa proactivamente.

## Stack del proyecto

- **Framework:** Electron (main + renderer)
- **Lenguaje:** TypeScript (estricto)
- **Estilo:** Métodología D.R.Y. (Don't Repeat Yourself)
- **Herramientas disponibles al agente:**
  - `createFile` — crear archivo (con carpetas intermedias)
  - `deleteFile` — eliminar archivo
  - `renamePath` — renombrar archivo/carpeta
  - `moveFolder` — mover archivo/carpeta
  - `browser` — navegación web visible (Playwright): navigate, click, fill, extract, close
  - `logSession` — logging de sesiones en `/Users/lastprophet/.boris/logs/`

## Estructura del repositorio

```
src/
  main/
    main.ts          — Entry point Electron + registro IPC
    llm.ts           — Streaming chat con LLM (gemma-4b-64k) y tool calls
    preload.ts       — Expone API `boris` al renderer
    tools/
      registry.ts    — Registro dinámico de herramientas
      handler.ts     — IPC handlers de herramientas
      createFile.ts
      deleteFile.ts
      renamePath.ts
      moveFolder.ts
      logSession.ts
      browser.ts
      workspace.ts   — resolveSafePath (sandbox al workspace)
    browser/
      BrowserController.ts — Control de Playwright (headless: false)
  renderer/
    chat.ts          — UI de chat: streaming, razonamiento, cola de mensajes
    index.html
    styles.css
```

## Reglas de operación

1. **TypeScript obligatorio.** Todo el código nuevo debe ser TS.
2. **D.R.Y.** Evita duplicación; extrae funciones compartidas.
3. **Sandbox de archivos.** Las rutas de archivo son relativas al workspace (`src/workspace.ts` define `WORKSPACE_ROOT`). No uses rutas absolutas ni traversal `..`.
4. **No rompas funcionalidad existente.** Antes de modificar, lee el archivo completo. Conserva handlers de eventos, llamadas a API, validaciones y manejo de estado.
5. **Timeout de chat.** El timeout de respuesta del modelo es de 30s (`src/renderer/chat.ts:214`). Si el modelo tarda, aumenta este valor o gestiona la cola de mensajes.
6. **Logs.** Usa `logSession` para registrar tool calls y errores en `/Users/lastprophet/.boris/logs/`.

## Flujo de trabajo autónomo

1. Explora el repositorio y entiende el código existente.
2. Identifica la tarea (feature, bug, refactor).
3. Implementa usando las herramientas disponibles (`createFile`, `edit`, etc.).
4. Verifica que no haya regresiones (lee los archivos tocados).
5. Registra el trabajo en `logSession` si aplica.
6. Notifica al usuario al finalizar.

## Comandos del proyecto

- `npm run build` — compila TypeScript y copia assets al renderer
- `npm start` — construye y ejecuta Electron

## Contacto con el usuario

Cuando finalices una tarea, avisa al usuario con un resumen conciso de lo que se hizo y qué archivos se modificaron. Si necesitas una decisión, pregúntale antes de implementar cambios que rompan comportamiento existente.
