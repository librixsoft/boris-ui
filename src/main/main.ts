import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import { registerLlmIpc } from "./llm";
import { registerToolsIpc } from "./tools/handler";
import BrowserStopOverlay from "./browser/BrowserStopOverlay";

function createWindow(): void {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 480,
    minHeight: 600,
    title: "Boris",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

app.whenReady().then(() => {
  registerLlmIpc({
    onBrowserControlChange: (active) => {
      if (active) {
        BrowserStopOverlay.show();
      } else {
        BrowserStopOverlay.hide();
      }
    }
  });
  registerToolsIpc(ipcMain);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
