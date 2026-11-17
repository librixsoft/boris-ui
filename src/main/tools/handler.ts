import { ipcMain } from "electron";
import { listTools, executeTool } from "./registry";

export function registerToolsIpc(ipcMain: typeof import("electron").ipcMain): void {
  ipcMain.handle("boris:tools:execute", async (_event, payload: { name: string; params: Record<string, unknown> }) => {
    try {
      const result = await executeTool(payload.name, payload.params);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido"
      };
    }
  });

  ipcMain.handle("boris:tools:list", async () => {
    return { tools: listTools() };
  });
}
