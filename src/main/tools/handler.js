const { ipcMain } = require("electron");
const { listTools, executeTool } = require("./registry");

function registerToolsIpc(ipcMain) {
  ipcMain.handle("boris:tools:execute", async (_event, payload) => {
    try {
      const result = await executeTool(payload.name, payload.params);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle("boris:tools:list", async () => {
    return { tools: listTools() };
  });
}

module.exports = { registerToolsIpc };
