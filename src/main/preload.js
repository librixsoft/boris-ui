const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("boris", {
  platform: process.platform
});
