import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("careless", {
  openLink: (url: string) => ipcRenderer.invoke("open-link", url),
  voiceHealth: (status: unknown) => ipcRenderer.invoke("voice-health", status),
  model: (action: string) => ipcRenderer.invoke("model", action),
  voice: (value: unknown) => ipcRenderer.invoke("voice", value),
  onSpeech: (fn: (text: string) => void) =>
    ipcRenderer.on("speak", (_event, text) => fn(text)),
  onRestartVoice: (fn: () => void) =>
    ipcRenderer.on("voice-restart", () => fn()),
  onTestVoice: (fn: () => void) => ipcRenderer.on("voice-test", () => fn()),
  onResume: (fn: () => void) => ipcRenderer.on("voice-resume", () => fn()),
  onSuspend: (fn: () => void) => ipcRenderer.on("voice-suspend", () => fn()),
  onChat: (fn: () => void) => ipcRenderer.on("open-chat", () => fn()),
  snapshot: () => ipcRenderer.invoke("snapshot"),
  googleKey: (key: string) => ipcRenderer.invoke("google-key", key),
  settings: (s: unknown) => ipcRenderer.invoke("settings", s),
  chat: (t: string, source?: string) =>
    ipcRenderer.invoke("chat", { text: t, source }),
  work: (t: string) => ipcRenderer.invoke("work", t),
  mcp: (v: unknown) => ipcRenderer.invoke("mcp", v),
  action: (a: string) => ipcRenderer.invoke("action", a),
  state: (s: string) => ipcRenderer.invoke("state", s),
  moveBy: (dx: number, dy: number) => ipcRenderer.send("pet-move", dx, dy),
});
