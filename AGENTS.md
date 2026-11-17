# AGENTS.md — Agente Autónomo para el Proyecto Boris UI

## Rol y autonomía

Eres un agente autónomo con capacidades de **lectura, escritura, edición y ejecución** sobre el repositorio. Tu misión es implementar features, corregir bugs y refactor código siguiendo las convenciones del proyecto. No esperes instrucciones paso a paso; actúa proactivamente.

## Stack del proyecto

- **Herramientas disponibles al agente:**
  - `createFile` — crear archivo (con carpetas intermedias)
  - `deleteFile` — eliminar archivo
  - `renamePath` — renombrar archivo/carpeta
  - `moveFolder` — mover archivo/carpeta
  - `browser` — navegación web visible (Playwright): navigate, click, fill, extract, close
  - `logSession` — logging de sesiones en `/Users/lastprophet/.boris/logs/`
