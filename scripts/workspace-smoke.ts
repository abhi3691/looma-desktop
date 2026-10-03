import { app, BrowserWindow } from "electron";
import {defaults} from "../src/shared";
import { CloudModels } from "../src/cloud-models";
import { DotsRuntime } from "../src/dots-runtime";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const root = process.cwd();
app.setAppPath(root);
if (process.env.LOOMA_TEST_PACKAGED) {
  Object.defineProperty(app, "isPackaged", { value: true });
  Object.defineProperty(process, "resourcesPath", {
    value: join(root, "release/mac-arm64/Looma.app/Contents/Resources"),
  });
}
app.setPath("userData", mkdtempSync(join(tmpdir(), "looma-workspace-test-")));
const runtime = new DotsRuntime();
const deadline = setTimeout(() => {
  runtime.stop();
  app.exit(1);
}, 40000);
app.whenReady().then(async () => {
  try {
    const hub = new CloudModels({ keys: { google: "test-key" } }, () => {});
    let question = "",
      selectedModel = "";
    await runtime.start(
      async (value) => {
        question = value.text;
        selectedModel = value.model || "";
        return "Your local workspace is connected.";
      },
      false,
      async (path, value) => {
        if (path === "/models") return hub.models();
        if (path === "/providers") return hub.status();
        if (path === "/local-server") return {phase:"Stopped",progress:0,error:"",enabled:false};
        if (path === "/media" || path === "/assistant") return [];
        if (path === "/home") return {configured:false,bindings:[],url:"",enabled:false};
        if (path === "/companion") return {settings:defaults,voiceHealth:{devices:[],audioLevel:0},runtime:{speechModelAvailable:true}};
        if (path === "/mcp")
          return {
            persistent: true,
            connections: [
              {
                id: "test-loom",
                name: "Loom",
                url: "https://example.test/mcp",
                connected: true,
                tools: [
                  {
                    name: "list_tasks",
                    description: "Read your tasks",
                    inputSchema: { type: "object" },
                  },
                ],
                tool: "list_tasks",
                args: "{}",
              },
            ],
          };
        throw Error("Unknown route");
      },
    );
    const win = BrowserWindow.getAllWindows()[0];
    await new Promise((r) => setTimeout(r, 2000));
    assert.equal(
      await win.webContents.executeJavaScript("typeof require"),
      "undefined",
    );
    const result = await win.webContents.executeJavaScript(
      `(async()=>{const bots=await (await fetch('/api/v1/bots')).json();return {bots,body:document.body.innerText}})()`,
    );
    assert.match(result.body, /Looma/);
    assert.doesNotMatch(result.body, /Enter the owner token/);
    const origin = new URL(win.webContents.getURL()).origin;
    const unauth = await fetch(origin + "/api/v1/bots");
    assert.equal(unauth.status, 401);
    const answer = await win.webContents.executeJavaScript(
      `(async()=>{await fetch('/api/v1/chat/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({thread_id:'bot-looma',bot_id:'bot-looma',user_text:'Hello workspace'})});return (await fetch('/api/v1/chat/stream/bot-looma')).text()})()`,
    );
    assert.equal(selectedModel, "gemini-3.1-flash-live-preview");
    assert.equal(question, "Hello workspace");
    assert.match(answer, /Your local workspace is connected/);
    await win.webContents.executeJavaScript(
      `document.querySelector('[aria-label="Choose AI model"]').click()`,
    );
    await new Promise((r) => setTimeout(r, 200));
    const picker = await win.webContents.executeJavaScript(
      `document.querySelector('[aria-label="AI models"]').innerText`,
    );
    for (const provider of ["OpenAI", "Grok", "Gemini", "DeepSeek", "Claude"])
      assert.ok(picker.includes(provider));
    writeFileSync(
      join(root, "models-preview.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await win.webContents.executeJavaScript(
      `document.querySelector('[aria-label="Choose AI model"]').click(); [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Plugins')).click()`,
    );
    await new Promise((r) => setTimeout(r, 700));
    const plugins = await win.webContents.executeJavaScript(
      "document.body.innerText",
    );
    assert.match(plugins, /Your MCP connections/);
    assert.match(plugins, /Loom/);
    assert.match(plugins, /Connected/);
    assert.ok(
      !(await win.webContents.executeJavaScript(
        `Boolean(document.querySelector('[title="Create New Bot"]'))`,
      )),
    );
    writeFileSync(
      join(root, "plugins-preview.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    writeFileSync(
      join(root, "workspace-preview.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    console.log(
      "PASS: authenticated workspace, sandbox, no anonymous API access, chat stream through desktop bridge.",
    );
    // Signing out must remain signed out until an explicit desktop reconnect.
    await win.webContents.executeJavaScript(`document.querySelector('[title="Settings"]').click()`);
    await new Promise(r=>setTimeout(r,500));
    const settingsBody=await win.webContents.executeJavaScript("document.body.innerText");
    for(const label of ["Local AI inside Looma","Create images & videos","Apps, alarms & event announcements","Internet answers"])assert.ok(settingsBody.includes(label),"Missing settings control: "+label);
    assert.equal(await fetch(origin+'/api/v1/creations/00000000-0000-0000-0000-000000000000.png').then(r=>r.status),401);
    const newEndpoints=await win.webContents.executeJavaScript(`Promise.all(['local-server','media','assistant'].map(route=>fetch('/api/v1/desktop/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:route==='local-server'?'status':'list'})}).then(r=>r.status)))`);
    assert.deepEqual(newEndpoints,[200,200,200]);
    await win.webContents.executeJavaScript(`document.querySelector('[title="Close App Settings"]').click()`);
    console.log("PASS: local AI, media and alarm settings; authenticated bridge and media previews.");
    await win.webContents.executeJavaScript(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Sign out')).click()`,
    );
    await new Promise((r) => setTimeout(r, 400));
    assert.match(
      await win.webContents.executeJavaScript("document.body.innerText"),
      /Open my workspace/,
    );
    assert.equal(
      await win.webContents.executeJavaScript(
        `fetch('/api/v1/bots').then(r=>r.status)`,
      ),
      401,
    );
    await win.webContents.executeJavaScript(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Open my workspace')).click()`,
    );
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(
      await win.webContents.executeJavaScript(
        `fetch('/api/v1/bots').then(r=>r.status)`,
      ),
      200,
    );
    assert.doesNotMatch(
      await win.webContents.executeJavaScript("document.cookie"),
      /open_dots_session/,
    );
    // Another window with the same preload cannot mint a desktop session.
    const other = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        preload: join(root, "dist/workspace-preload.cjs"),
      },
    });
    await other.loadURL("data:text/html,Untrusted");
    assert.equal(
      await other.webContents.executeJavaScript(
        `window.loomaDesktop.restoreSession().then(()=>false,()=>true)`,
      ),
      true,
    );
    other.destroy();
    console.log(
      "PASS: explicit desktop sign-in recovery; HttpOnly credentials and caller validation preserved.",
    );
    runtime.stop();
    clearTimeout(deadline);
    app.exit(0);
  } catch (e) {
    console.error(e);
    runtime.stop();
    clearTimeout(deadline);
    app.exit(1);
  }
});
