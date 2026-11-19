import { contextBridge, ipcRenderer, IpcRendererEvent, shell } from "electron";

interface ChatHandlers {
  onChunk: (content: string) => void;
  onReasoning: (content: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
  onToolCall?: (data: { name: string; args: Record<string, unknown> }) => void;
  onToolResult?: (data: { name: string; result: unknown; success: boolean }) => void;
}

interface AttachListenersResult {
  (): void;
}

function attachListeners(requestId: string, handlers: ChatHandlers): AttachListenersResult {
  const onChunk = (_event: IpcRendererEvent, data: { requestId: string; content: string }): void => {
    if (data.requestId === requestId) {
      handlers.onChunk(data.content);
    }
  };

  const onReasoning = (_event: IpcRendererEvent, data: { requestId: string; content: string }): void => {
    if (data.requestId === requestId) {
      handlers.onReasoning(data.content);
    }
  };

  const onDone = (_event: IpcRendererEvent, data: { requestId: string }): void => {
    if (data.requestId !== requestId) return;
    detach();
    handlers.onDone();
  };

  const onError = (_event: IpcRendererEvent, data: { requestId: string; message: string }): void => {
    if (data.requestId !== requestId) return;
    detach();
    handlers.onError(data.message);
  };

  function detach(): void {
    ipcRenderer.off("boris:chat:chunk", onChunk);
    ipcRenderer.off("boris:chat:reasoning", onReasoning);
    ipcRenderer.off("boris:chat:done", onDone);
    ipcRenderer.off("boris:chat:error", onError);
    ipcRenderer.off("boris:chat:tool-call", onToolCallInner);
    ipcRenderer.off("boris:chat:tool-result", onToolResultInner);
  }

  const onToolCallInner = (_event: IpcRendererEvent, data: { requestId: string; name: string; args: Record<string, unknown> }): void => {
    if (data.requestId === requestId && handlers.onToolCall) {
      handlers.onToolCall({ name: data.name, args: data.args });
    }
  };

  const onToolResultInner = (_event: IpcRendererEvent, data: { requestId: string; name: string; result: unknown; success: boolean }): void => {
    if (data.requestId === requestId && handlers.onToolResult) {
      handlers.onToolResult({ name: data.name, result: data.result, success: data.success });
    }
  };

  ipcRenderer.on("boris:chat:chunk", onChunk);
  ipcRenderer.on("boris:chat:reasoning", onReasoning);
  ipcRenderer.on("boris:chat:done", onDone);
  ipcRenderer.on("boris:chat:error", onError);
  ipcRenderer.on("boris:chat:tool-call", onToolCallInner);
  ipcRenderer.on("boris:chat:tool-result", onToolResultInner);

  return detach;
}

interface ChatApi {
  stream(messages: Array<{ role: string; content: string }>, handlers: ChatHandlers, sessionId?: string): { stop(): void };
}

interface ToolsApi {
  execute(name: string, params: Record<string, unknown>): Promise<unknown>;
  list(): Promise<unknown>;
}

interface ShellApi {
  openExternal(url: string): void;
}

interface BorisApi {
  platform: string;
  chat: ChatApi;
  tools: ToolsApi;
  shell: ShellApi;
}

declare global {
  interface Window {
    boris: BorisApi;
  }
}

contextBridge.exposeInMainWorld("boris", {
  platform: process.platform,
  chat: {
    stream(messages: Array<{ role: string; content: string }>, handlers: ChatHandlers, sessionId?: string): { stop(): void } {
      const requestId = crypto.randomUUID();
      const chatSessionId = sessionId || crypto.randomUUID();
      const detach = attachListeners(requestId, handlers);

      ipcRenderer.invoke("boris:chat:stream", { requestId, sessionId: chatSessionId, messages });

      return {
        stop() {
          ipcRenderer.invoke("boris:chat:abort", { requestId });
        }
      };
    }
  },
  tools: {
    execute(name: string, params: Record<string, unknown>): Promise<unknown> {
      return ipcRenderer.invoke("boris:tools:execute", { name, params });
    },
    list(): Promise<unknown> {
      return ipcRenderer.invoke("boris:tools:list");
    }
  },
  shell: {
    openExternal(url: string): void {
      shell.openExternal(url);
    }
  }
});

export { attachListeners };
