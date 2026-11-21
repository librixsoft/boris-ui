import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import { registerLlmIpc } from "./llm";
import { registerToolsIpc } from "./tools/handler";
import { executionModeService } from "./executionMode/service";
import { commandApprovalService } from "./commandApproval/service";
import type { ExecutionMode } from "./executionMode/service";

let win: BrowserWindow | null = null;

function createWindow(): void {
  const window = new BrowserWindow({
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

  window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  win = window;

  window.on("closed", () => {
    win = null;
  });
}

function sendModeChanged(): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send("boris:execution-mode:changed", {
      mode: executionModeService.getMode()
    });
  }
}

app.whenReady().then(() => {
  registerLlmIpc();
  registerToolsIpc(ipcMain);

  ipcMain.handle("boris:execution-mode:get", () => {
    return { mode: executionModeService.getMode() };
  });

  ipcMain.handle("boris:execution-mode:set", (_event, payload: { mode: ExecutionMode }) => {
    executionModeService.setMode(payload.mode);
    sendModeChanged();
    return { mode: executionModeService.getMode() };
  });

  ipcMain.handle("boris:execution-mode:toggle", () => {
    const mode = executionModeService.toggle();
    sendModeChanged();
    return { mode };
  });

  ipcMain.handle("boris:command:approve", (_event, payload: { approvalId: string }) => {
    commandApprovalService.approve(payload.approvalId);
    return { ok: true };
  });

  ipcMain.handle("boris:command:deny", (_event, payload: { approvalId: string }) => {
    commandApprovalService.deny(payload.approvalId);
    return { ok: true };
  });

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
