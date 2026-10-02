import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { open, mkdir, rename, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, basename } from "node:path";
export const GEMMA_MODEL = "gemma4:e2b-it-qat";
export const DEFAULT_MODEL = "qwen3.5:4b";
export type RuntimeStatus = {
  online: boolean;
  models: string[];
  selectedInstalled: boolean;
  downloading: boolean;
  progress: number;
  message: string;
  ollamaAvailable: boolean;
  whisperAvailable: boolean;
  speechModelAvailable: boolean;
  malayalamVoiceAvailable: boolean;
  meeraAvailable: boolean;
  onlineVoiceAvailable: boolean;
  speechDownloading: boolean;
  speechProgress: number;
  speechMessage: string;
};
export class LocalRuntime {
  private child?: ChildProcess;
  private config: Record<string, string> = {};
  private lastRefresh = 0;
  readonly status: RuntimeStatus = {
    online: false,
    models: [],
    selectedInstalled: false,
    downloading: false,
    progress: 0,
    message: "Check connection to your local model.",
    ollamaAvailable: false,
    whisperAvailable: false,
    speechModelAvailable: false,
    malayalamVoiceAvailable: false,
    meeraAvailable: false,
    onlineVoiceAvailable: false,
    speechDownloading: false,
    speechProgress: 0,
    speechMessage: "Multilingual speech model needed.",
  };
  constructor(
    private appPath: string,
    private dataDir: string,
    private resourcesPath: string,
  ) {
    try {
      this.config = JSON.parse(
        readFileSync(join(dataDir, "runtime.json"), "utf8"),
      );
    } catch {}
    this.detect();
  }
  private find(name: string) {
    const configured = this.config[name];
    if (configured && existsSync(configured)) return configured;
    const file = process.platform === "win32" ? name + ".exe" : name;
    const dirs = [
      join(
        this.dataDir,
        "piper-env",
        process.platform === "win32" ? "Scripts" : "bin",
      ),
      join(this.resourcesPath, "voice-runtime"),
      join(this.appPath, "voice-runtime", "dist", "edge-tts"),
      join(this.resourcesPath, "speech-runtime"),
      join(this.resourcesPath, "ollama"),
      join(this.appPath, "runtime", "ollama-darwin"),
      "/opt/homebrew/bin",
      "/usr/local/bin",
      ...String(process.env.PATH ?? "").split(
        process.platform === "win32" ? ";" : ":",
      ),
    ];
    if (name === "ollama")
      dirs.push("/Applications/Ollama.app/Contents/Resources");
    if (process.platform === "win32" && process.env.LOCALAPPDATA)
      dirs.push(join(process.env.LOCALAPPDATA, "Programs", "Ollama"));
    return dirs.map((d) => join(d, file)).find(existsSync);
  }
  path(name: "ollama" | "whisper-cli" | "espeak-ng" | "piper" | "edge-tts") {
    return this.find(name);
  }
  femaleVoiceModel() {
    const file = join(this.dataDir, "models", "ml_IN-meera-medium.onnx");
    return existsSync(file) && existsSync(file + ".json") ? file : undefined;
  }
  wakeModel() {
    const file = join(this.dataDir, "models", "ggml-tiny.en.bin");
    const bundled = join(this.resourcesPath, "speech-models", "ggml-tiny.en.bin");
    const development = join(this.appPath, "bundled-models", "ggml-tiny.en.bin");
    return [file, bundled, development].find(existsSync) || this.speechModel();
  }
  speechModel() {
    return [
      this.config.speechModel,
      join(this.resourcesPath, "speech-models", "ggml-small.bin"),
      join(this.appPath, "bundled-models", "ggml-small.bin"),
      join(this.dataDir, "models", "ggml-small.bin"),
      join(this.appPath, "local-models", "ggml-small.bin"),
    ].find((p) => p && existsSync(p));
  }
  select(
    key: "ollama" | "whisper-cli" | "espeak-ng" | "speechModel",
    path: string,
  ) {
    if (key !== "speechModel" && !basename(path).toLowerCase().startsWith(key))
      throw Error("Choose the correct runtime executable");
    this.config[key] = path;
    writeFileSync(
      join(this.dataDir, "runtime.json"),
      JSON.stringify(this.config),
      { mode: 0o600 },
    );
    this.detect();
  }
  detect() {
    Object.assign(this.status, {
      ollamaAvailable: !!this.path("ollama"),
      whisperAvailable: !!this.path("whisper-cli"),
      speechModelAvailable: !!this.speechModel(),
      malayalamVoiceAvailable:
        !!this.path("espeak-ng") ||
        !!(this.path("piper") && this.femaleVoiceModel()),
      meeraAvailable: !!(this.path("piper") && this.femaleVoiceModel()),
      onlineVoiceAvailable: !!this.path("edge-tts"),
    });
  }
  async refresh(model: string, force = false) {
    if (this.speechModel() && !this.status.speechDownloading)
      this.status.speechMessage = "Multilingual speech model is ready.";
    this.detect();
    if (!force && Date.now() - this.lastRefresh < 10000) return this.status;
    this.lastRefresh = Date.now();
    try {
      const r = await fetch("http://127.0.0.1:11434/api/tags", {
        redirect: "error",
        signal: AbortSignal.timeout(2000),
      });
      if (!r.ok) throw Error();
      const j = (await r.json()) as { models: { name: string }[] };
      this.status.models = j.models
        .map((x) => x.name)
        .filter((n) => !n.toLowerCase().includes("cloud"));
      this.status.online = true;
      this.status.selectedInstalled = this.status.models.includes(model);
      if (!this.status.downloading)
        this.status.message = this.status.selectedInstalled
          ? "Local model is ready."
          : "Ollama is connected. Download the selected model.";
    } catch {
      this.status.online = false;
      this.status.selectedInstalled = false;
      if (!this.status.downloading)
        this.status.message =
          "Ollama is not running. Start it below or install the runtime.";
    }
    return this.status;
  }
  async start() {
    await this.refresh(DEFAULT_MODEL, true);
    if (this.status.online) return this.status;
    const path = this.path("ollama");
    if (!path) throw Error("Install Ollama or choose its executable first");
    const models = join(this.dataDir, "models", "ollama");
    mkdirSync(models, { recursive: true });
    this.child = spawn(path, ["serve"], {
      env: {
        ...process.env,
        OLLAMA_HOST: "127.0.0.1:11434",
        OLLAMA_NO_CLOUD: "1",
        OLLAMA_MODELS: models,
        OLLAMA_CONTEXT_LENGTH: "4096",
      },
      stdio: "ignore",
      windowsHide: true,
    });
    this.child.on("error", () => {
      this.status.message =
        "Could not start Ollama. Check the runtime installation.";
    });
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 300));
      await this.refresh(DEFAULT_MODEL, true);
      if (this.status.online) return this.status;
    }
    throw Error(
      "Ollama did not become ready. Another process may be using its port.",
    );
  }
  async pull(model: string, onReady: () => void) {
    if (this.status.downloading)
      throw Error("A model download is already running");
    if (
      !/^(?:gemma4:(?:e2b|e4b|e2b-it-qat|e4b-it-qat|12b)|qwen3\.5:(?:4b|9b))$/.test(
        model,
      )
    )
      throw Error("Choose a supported local Qwen 3.5 or Gemma model");
    await this.start();
    this.status.downloading = true;
    this.status.progress = 0;
    this.status.message = "Starting model download…";
    void (async () => {
      try {
        const r = await fetch("http://127.0.0.1:11434/api/pull", {
          method: "POST",
          redirect: "error",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, stream: true }),
          signal: AbortSignal.timeout(3600000),
        });
        if (!r.ok || !r.body) throw Error();
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";
        let success = false;
        while (true) {
          const { done, value } = await reader.read();
          pending += decoder.decode(value, { stream: !done });
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";
          if (done && pending) lines.push(pending);
          for (const line of lines) {
            if (!line.trim()) continue;
            const result = JSON.parse(line);
            if (result.error) throw Error();
            this.status.message = String(result.status ?? "Downloading…");
            if (result.total)
              this.status.progress = Math.round(
                ((result.completed ?? 0) / result.total) * 100,
              );
            if (result.status === "success") success = true;
          }
          if (done) break;
        }
        if (!success) throw Error();
        this.status.progress = 100;
        onReady();
        this.status.message = "Gemma 4 is installed and connected.";
      } catch {
        this.status.message =
          "Model download failed. Check internet access and disk space, then retry.";
      } finally {
        this.status.downloading = false;
        await this.refresh(model, true);
      }
    })();
    return this.status;
  }
  async downloadSpeech() {
    if (this.status.speechDownloading)
      throw Error("Speech model download is already running");
    this.status.speechDownloading = true;
    this.status.speechProgress = 0;
    this.status.speechMessage = "Downloading multilingual Whisper model…";
    void (async () => {
      const dir = join(this.dataDir, "models"),
        file = join(dir, "ggml-small.bin"),
        partial = file + ".download";
      try {
        await mkdir(dir, { recursive: true });
        const response = await fetch(
          "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
          { signal: AbortSignal.timeout(1800000) },
        );
        if (!response.ok || !response.body) throw Error();
        const reader = response.body.getReader();
        const target = await open(partial, "w", 0o600);
        const hash = createHash("sha1");
        let completed = 0;
        const total =
          Number(response.headers.get("content-length")) || 487601967;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            hash.update(value);
            await target.write(value);
            completed += value.length;
            this.status.speechProgress = Math.min(
              99,
              Math.round((completed / total) * 100),
            );
          }
        } finally {
          await target.close();
        }
        if (hash.digest("hex") !== "55356645c2b361a969dfd0ef2c5a50d530afd8d5")
          throw Error();
        await rename(partial, file);
        this.status.speechProgress = 100;
        this.status.speechMessage =
          "Multilingual speech recognition model is ready.";
        this.detect();
      } catch {
        await rm(partial, { force: true }).catch(() => {});
        this.status.speechMessage =
          "Speech model download failed. Check network and disk space, then retry.";
      } finally {
        this.status.speechDownloading = false;
      }
    })();
    return this.status;
  }
  stop() {
    this.child?.kill();
    this.child = undefined;
  }
}
