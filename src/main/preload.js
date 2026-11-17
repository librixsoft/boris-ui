const { contextBridge, ipcRenderer } = require("electron");

function attachListeners(requestId, handlers) {
  const onChunk = (_event, data) => {
    if (data.requestId === requestId) handlers.onChunk(data.content);
  };

  const onDone = (_event, data) => {
    if (data.requestId !== requestId) return;
    detach();
    handlers.onDone();
  };

  const onError = (_event, data) => {
    if (data.requestId !== requestId) return;
    detach();
    handlers.onError(data.message);
  };

  function detach() {
    ipcRenderer.off("boris:chat:chunk", onChunk);
    ipcRenderer.off("boris:chat:done", onDone);
    ipcRenderer.off("boris:chat:error", onError);
  }

  ipcRenderer.on("boris:chat:chunk", onChunk);
  ipcRenderer.on("boris:chat:done", onDone);
  ipcRenderer.on("boris:chat:error", onError);

  return detach;
}

contextBridge.exposeInMainWorld("boris", {
  platform: process.platform,
  chat: {
    stream(messages, handlers) {
      const requestId = crypto.randomUUID();
      const detach = attachListeners(requestId, handlers);

      ipcRenderer.invoke("boris:chat:stream", { requestId, messages });

      return {
        stop() {
          ipcRenderer.invoke("boris:chat:abort", { requestId });
        }
      };
    }
  }
});
