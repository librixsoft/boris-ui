import { BrowserWindow, screen } from "electron";
import * as path from "path";

class BrowserStopOverlay {
  private window: BrowserWindow | null = null;

  show(): void {
    if (this.window) return;

    const size = 160;
    const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
    const window = new BrowserWindow({
      width: size,
      height: size,
      x: Math.round(x + (width - size) / 2),
      y: Math.round(y + (height - size) / 2),
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "..", "preload.js"),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    this.window = window;
    window.setAlwaysOnTop(true, "screen-saver");
    window.on("closed", () => {
      if (this.window === window) this.window = null;
    });
    void window.loadFile(path.join(__dirname, "..", "..", "renderer", "browser-stop.html")).then(() => {
      if (this.window === window && !window.isDestroyed()) window.showInactive();
    }).catch((error: unknown) => {
      if (this.window !== window || window.isDestroyed()) return;
      console.error("No se pudo cargar el control de parada del navegador:", error);
      this.hide();
    });
  }

  hide(): void {
    this.window?.close();
    this.window = null;
  }
}

export default new BrowserStopOverlay();
