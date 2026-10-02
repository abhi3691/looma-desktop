import { app, BrowserWindow, ipcMain } from "electron";
import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

/** Local owner-authenticated workspace; credentials never enter the renderer. */
export class DotsRuntime {
  private restoring?: Promise<void>;
  private bridge?: Server;
  private origin = "";
  private token = "";
  private child?: ChildProcess;
  private window?: BrowserWindow;
  async start(
    chat: (value: { text: string; model?: string }) => Promise<string>,
    background = false,
    service: (path: string, value: any) => Promise<unknown> = async () => [],
  ) {
    const token = randomBytes(32).toString("hex");
    this.bridge = createServer(async (req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (
        req.method !== "POST" ||
        ![
          "/chat",
          "/models",
          "/providers",
          "/mcp",
          "/home",
          "/open-auth",
          "/companion",
        ].includes(req.url || "") ||
        req.headers.origin ||
        req.headers.authorization !== `Bearer ${token}`
      ) {
        res.writeHead(403).end('{"error":"Forbidden"}');
        return;
      }
      let body = "";
      try {
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 20000) throw Error("Too large");
        }
        const value = JSON.parse(body);
        if (req.url !== "/chat") {
          res.end(JSON.stringify(await service(req.url!, value)));
          return;
        }
        if (
          value.model !== undefined &&
          (typeof value.model !== "string" || value.model.length > 200)
        )
          throw Error("Invalid model");
        if (
          typeof value.text !== "string" ||
          !value.text.trim() ||
          value.text.length > 4000
        )
          throw Error("Invalid question");
        const answer = await chat({
          text: value.text,
          ...(value.model ? { model: value.model } : {}),
        });
        res.end(JSON.stringify({ answer }));
      } catch (error) {
        const message =
          error instanceof Error && error.name !== "ZodError"
            ? error.message
            : "Check the supplied settings and try again.";
        res.writeHead(400).end(JSON.stringify({ error: message }));
      }
    });
    await new Promise<void>((resolve, reject) => {
      this.bridge!.once("error", reject);
      this.bridge!.listen(0, "127.0.0.1", resolve);
    });
    const address = this.bridge.address();
    if (!address || typeof address === "string")
      throw Error("Bridge unavailable");
    const data = join(app.getPath("userData"), "open-dots");
    mkdirSync(join(data, "workspace"), { recursive: true });
    const serverRoot = app.isPackaged
      ? join(process.resourcesPath, "looma-server")
      : join(app.getAppPath(), "workspace/server");
    const executable = app.isPackaged
      ? join(
          serverRoot,
          process.platform === "win32" ? "looma-server.exe" : "looma-server",
        )
      : join(
          serverRoot,
          process.platform === "win32"
            ? ".venv/Scripts/python.exe"
            : ".venv/bin/python",
        );
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATA_DIR: data,
      WORKSPACE_ROOT: join(data, "workspace"),
      APP_AUTH_TOKEN: token,
      LOOMA_GATEWAY_URL: `http://127.0.0.1:${address.port}`,
      LOOMA_GATEWAY_TOKEN: token,
      LOOMA_STATIC_DIR: app.isPackaged
        ? join(process.resourcesPath, "looma-client")
        : join(app.getAppPath(), "workspace/client/out"),
      COMPUTER_PROVIDER: "fake",
      PYTHONUNBUFFERED: "1",
    };
    delete env.GOOGLE_API_KEY;
    delete env.OPENAI_API_KEY;
    this.child = spawn(
      executable,
      app.isPackaged ? [] : [join(serverRoot, "desktop.py")],
      { env, cwd: serverRoot, stdio: ["ignore", "pipe", "pipe"] },
    );
    // Discard server logs: upstream diagnostics can contain private request details.
    this.child.stderr?.resume();
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Workspace startup timed out")),
        30000,
      );
      let pending = "";
      this.child!.once("error", () => {
        clearTimeout(timer);
        reject(Error("Workspace runtime missing"));
      });
      this.child!.once("exit", () => {
        clearTimeout(timer);
        reject(Error("Workspace server stopped"));
      });
      this.child!.stdout!.on("data", (chunk) => {
        pending += String(chunk);
        const lines = pending.split("\n");
        pending = lines.pop() || "";
        for (const line of lines) {
          try {
            const value = JSON.parse(line);
            if (
              Number.isInteger(value.loomaPort) &&
              value.loomaPort > 0 &&
              value.loomaPort < 65536
            ) {
              clearTimeout(timer);
              resolve(value.loomaPort);
            }
          } catch {}
        }
      });
    });
    const origin = `http://127.0.0.1:${port}`;
    this.origin = origin;
    this.token = token;
    let response: Response | undefined;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        response = await fetch(`${origin}/api/v1/auth/session`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(1500),
        });
        if (response.ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    const cookie = response?.headers
      .get("set-cookie")
      ?.match(/open_dots_session=([^;]+)/)?.[1];
    if (!response?.ok || !cookie)
      throw Error("Workspace authentication failed");
    this.window = new BrowserWindow({
      show: false,
      title: "Looma",
      width: 1260,
      height: 840,
      minWidth: 900,
      minHeight: 650,
      backgroundColor: "#faf6ee",
      icon: join(app.getAppPath(), "public/icon.png"),
      webPreferences: {
        partition: "looma-workspace",
        preload: join(app.getAppPath(), "dist/workspace-preload.cjs"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const web = this.window.webContents;
    web.session.setPermissionRequestHandler((_w, _p, cb) => cb(false));
    web.setWindowOpenHandler(() => ({ action: "deny" }));
    web.on("will-navigate", (event, url) => {
      if (new URL(url).origin !== origin) event.preventDefault();
    });
    await web.session.cookies.set({
      url: origin,
      name: "open_dots_session",
      value: cookie,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    ipcMain.handle("looma:restore-workspace-session", async (event) => {
      if (
        event.sender !== this.window?.webContents ||
        event.senderFrame !== web.mainFrame ||
        !event.senderFrame?.url.startsWith(`${origin}/app/`)
      )
        throw Error("Untrusted workspace");
      if (!this.restoring)
        this.restoring = this.restoreSession().finally(() => {
          this.restoring = undefined;
        });
      await this.restoring;
      return true;
    });
    await this.window.loadURL(`${origin}/app/`);
    this.window.on("close", (event) => {
      event.preventDefault();
      this.window?.hide();
    });
    if (!background) this.show();
  }
  private async restoreSession() {
    const response = await fetch(`${this.origin}/api/v1/auth/session`, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(5000),
    });
    const cookie = response.headers
      .get("set-cookie")
      ?.match(/open_dots_session=([^;]+)/)?.[1];
    if (!response.ok || !cookie || !this.window || this.window.isDestroyed())
      throw Error(
        "Cannot reconnect to your local workspace. Please reopen Looma.",
      );
    await this.window.webContents.session.cookies.set({
      url: this.origin,
      name: "open_dots_session",
      value: cookie,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }
  async record(question: string, answer: string) {
    if (!this.origin) return;
    try {
      const response = await fetch(this.origin + "/api/v1/desktop/exchange", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question, answer }),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw Error("Could not save voice history");
      this.window?.webContents.send("looma:history-changed");
    } catch (error) { console.error("Voice history sync failed", error instanceof Error ? error.message : "Unknown error"); }
  }
  showSettings() {
    if (this.show()) this.window?.webContents.send("looma:open-settings");
  }
  show() {
    if (!this.window || this.window.isDestroyed()) return false;
    this.window.show();
    this.window.focus();
    return true;
  }
  stop() {
    ipcMain.removeHandler("looma:restore-workspace-session");
    this.window?.destroy();
    this.child?.kill();
    this.bridge?.close();
  }
}
