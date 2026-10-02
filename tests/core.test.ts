import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { defaults, settingsSchema } from "../src/shared";
import { hasSecret, excluded, Rules } from "../src/rules";
import { Memory } from "../src/storage";
import { MockProvider, reply } from "../src/llm";
import { safeURL, argumentsFor, isReadTool, Connections } from "../src/mcp";
import { createServer } from "node:http";

test("private defaults and strict settings boundary", () => {
  assert.equal(defaults.activity, false);
  assert.equal(defaults.clipboard, false);
  assert.equal(defaults.screen, false);
  assert.throws(() => settingsSchema.parse({ ...defaults, retention: 0 }));
  assert.throws(() => settingsSchema.parse({ ...defaults, unknown: true }));
});
test("credentials detected without treating ordinary clipboard text as a secret", () => {
  assert.equal(hasSecret("hello team, review the release"), false);
  assert.equal(hasSecret("sk-abcdefghijklmnopqrstuvwxyz123456"), true);
  assert.equal(hasSecret("password=longSecretValue123"), true);
  assert.equal(hasSecret("-----BEGIN PRIVATE KEY-----"), true);
  assert.equal(excluded("1Password 8", ["1password"]), true);
  assert.equal(excluded("Finder", ["1password"]), false);
});
test("rules pause, deduplicate warnings, and reset on a privacy change", () => {
  const r = new Rules();
  const input = { now: 1000, idle: 0, switched: false, secret: true };
  assert.deepEqual(r.check(input, { ...defaults, paused: true }), []);
  assert.equal(r.check(input, defaults).length, 1);
  assert.equal(r.check({ ...input, now: 2000 }, defaults).length, 0);
  r.reset();
  assert.equal(r.check(input, defaults).length, 1);
  assert.equal(
    new Rules().check(input, { ...defaults, secrets: false }).length,
    0,
  );
});
test("context switching threshold and inactivity break reset", () => {
  const r = new Rules();
  let warnings: string[] = [];
  for (let i = 0; i < 12; i++)
    warnings.push(
      ...r.check(
        { now: i * 5000, idle: 0, switched: true, secret: false },
        defaults,
      ),
    );
  assert.equal(warnings.length, 1);
  const b = new Rules();
  for (let i = 0; i < 599; i++)
    assert.equal(
      b.check(
        { now: i * 5000, idle: 0, switched: false, secret: false },
        defaults,
      ).length,
      0,
    );
  assert.equal(
    b.check({ now: 3000000, idle: 0, switched: false, secret: false }, defaults)
      .length,
    1,
  );
  b.reset();
  for (let i = 0; i < 599; i++)
    b.check(
      { now: i * 5000, idle: 0, switched: false, secret: false },
      defaults,
    );
  assert.equal(
    b.check(
      { now: 3000000, idle: 150, switched: false, secret: false },
      defaults,
    ).length,
    0,
  );
});
test("SQLite persists settings, work notes, activity time, and erases history", async () => {
  const dir = mkdtempSync(join(tmpdir(), "careless-test-"));
  try {
    const path = join(dir, "test.sqlite");
    const wasm = resolve("node_modules/sql.js/dist/sql-wasm.wasm");
    const m = await Memory.open(path, wasm);
    m.set({ ...defaults, provider: "ollama" });
    m.add("work", "Finish review");
    m.add("activity", "Editor");
    m.add("user", "Hello");
    m.usage("Editor");
    const restored = await Memory.open(path, wasm);
    assert.equal(restored.settings().provider, "ollama");
    assert.equal(restored.dailyWork()[0].text, "Finish review");
    assert.equal(restored.entries(true).length, 1);
    assert.equal(restored.counts().activities, 1);
    assert.equal(restored.todayUsage()[0].seconds, 5);
    restored.clear();
    assert.deepEqual(restored.entries(), []);
    assert.deepEqual(restored.entries(true), []);
    assert.deepEqual(restored.todayUsage(), []);
    assert.equal(restored.settings().provider, "ollama");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("mock response is explicitly labelled and unavailable runtime falls back", async () => {
  assert.match(
    await new MockProvider().reply([{ role: "user", content: "help me plan" }]),
    /Offline demo/,
  );
  const previous = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error("offline");
  };
  try {
    assert.match(
      await reply({ ...defaults, provider: "ollama" }, [
        { role: "user", content: "hello" },
      ]),
      /Local model unavailable/,
    );
  } finally {
    globalThis.fetch = previous;
  }
});
test("MCP URLs and tool argument templates preserve untrusted strings", () => {
  assert.throws(() => safeURL("http://example.com/mcp"));
  assert.throws(() => safeURL("https://user:pass@example.com/mcp"));
  assert.equal(safeURL("http://127.0.0.1:3000/mcp").hostname, "127.0.0.1");
  const query = 'Show Santhosh’s tasks with "quotes"';
  assert.deepEqual(
    argumentsFor(
      '{"q":"{{query}}","owner":"{{assignee}}","date":"{{date}}"}',
      query,
      "2026-09-30",
    ),
    { q: query, owner: "Santhosh", date: "2026-09-30" },
  );
  assert.throws(() => argumentsFor("[]", "q", "date"));
  assert.equal(isReadTool({ name: "delete_task", inputSchema: {} }), false);
  assert.equal(isReadTool({ name: "list_tasks", inputSchema: {} }), true);
  assert.equal(isReadTool({ name: "list_and_delete", inputSchema: {} }), false);
});
test("multiple MCP servers discover only read tools and return attributed real results", async () => {
  const calls: string[] = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }
    const request = JSON.parse(body);
    calls.push(request.method);
    if (request.id === undefined) {
      res.writeHead(202).end();
      return;
    }
    let result: any;
    if (request.method === "initialize")
      result = {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "test-tasks", version: "1" },
      };
    else if (request.method === "tools/list")
      result = {
        tools: [
          {
            name: "list_tasks",
            inputSchema: {
              type: "object",
              properties: { query: { type: "string" } },
              required: ["query"],
            },
            annotations: { readOnlyHint: true },
          },
          { name: "delete_task", inputSchema: { type: "object" } },
        ],
      };
    else if (request.method === "tools/call")
      result = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              title: "Review onboarding",
              assignee: "Santhosh",
              query: request.params.arguments.query,
            }),
          },
        ],
      };
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as { port: number };
  const manager = new Connections([], () => {});
  const a = crypto.randomUUID(),
    b = crypto.randomUUID();
  try {
    for (const [id, name] of [
      [a, "Team"],
      [b, "Personal"],
    ]) {
      await manager.save({
        id,
        name,
        url: `http://127.0.0.1:${address.port}/mcp`,
        token: "test-token",
      });
      manager.configure(id, "list_tasks", '{"query":"{{query}}"}');
    }
    assert.equal(manager.list().length, 2);
    assert.equal(manager.list()[0].tools.length, 1);
    assert.equal("token" in manager.list()[0], false);
    assert.match(await manager.query("today"), /Choose a connection/);
    const answer = await manager.query("Santhosh’s tasks", a);
    assert.match(answer, /Source: Team/);
    assert.match(answer, /Review onboarding/);
    assert.match(answer, /Santhosh/);
    assert.equal(calls.filter((x) => x === "tools/call").length, 1);
    assert.throws(() => manager.configure(a, "delete_task", "{}"));
    await manager.remove(b);
    assert.equal(manager.list().length, 1);
  } finally {
    await manager.disconnect(a);
    await manager.disconnect(b);
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("voice recording encodes bounded mono PCM and rejects unsupported formats", async () => {
  const { encodeWav, validateWav } = await import("../src/audio");
  const wav = encodeWav([new Float32Array([0, 0.5, -0.5, 2, -2])]);
  validateWav(wav);
  assert.equal(wav.length, 54);
  const v = new DataView(wav.buffer);
  assert.equal(v.getInt16(50, true), 32767);
  assert.equal(v.getInt16(52, true), -32768);
  const stereo = new Uint8Array(wav);
  new DataView(stereo.buffer).setUint16(22, 2, true);
  assert.throws(() => validateWav(stereo));
  assert.throws(() => validateWav(new Uint8Array(10)));
  assert.throws(() => encodeWav([new Float32Array(16000 * 61)]));
  assert.throws(() =>
    settingsSchema.parse({ ...defaults, model: "gemma4:cloud" }),
  );
  assert.equal(defaults.voiceInput, false);
  assert.equal(defaults.announcements, false);
});
