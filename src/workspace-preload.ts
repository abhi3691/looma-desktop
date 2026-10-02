import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("loomaDesktop", {
  onOpenSettings: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("looma:open-settings", listener);
    return () => ipcRenderer.removeListener("looma:open-settings", listener);
  },
  onHistoryChanged: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("looma:history-changed", listener);
    return () => ipcRenderer.removeListener("looma:history-changed", listener);
  },
  restoreSession: () => ipcRenderer.invoke("looma:restore-workspace-session"),
});
