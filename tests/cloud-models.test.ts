import test from "node:test";
import assert from "node:assert/strict";
import { CloudModels } from "../src/cloud-models";
test("cloud adapters use fixed provider endpoints, only current question and no credential disclosure", async () => {
  const original = globalThis.fetch;
  const calls: { url: string; body: any }[] = [];
  globalThis.fetch = (async (url, options) => {
    const body = JSON.parse(String(options?.body || "{}"));
    calls.push({ url: String(url), body });
    return new Response(
      JSON.stringify(
        String(url).includes("generateContent")
          ? { candidates: [{ content: { parts: [{ text: "hello" }] } }] }
          : String(url).endsWith("/messages")
            ? { content: [{ type: "text", text: "hello" }] }
            : String(url).endsWith("/responses")
              ? {
                  output: [
                    {
                      type: "message",
                      content: [{ type: "output_text", text: "hello" }],
                    },
                  ],
                }
              : { choices: [{ message: { content: "hello" } }] },
      ),
      { status: 200 },
    );
  }) as typeof fetch;
  try {
    const hub = new CloudModels(
      {
        keys: {
          google: "test-google",
          openai: "test-openai",
          xai: "test-xai",
          deepseek: "test-deepseek",
          anthropic: "test-anthropic",
        },
      },
      () => {},
    );
    for (const model of [
      "google:gemini-text-test",
      "openai:gpt-test",
      "xai:grok-test",
      "deepseek:deepseek-test",
      "anthropic:claude-test",
    ])
      assert.equal(await hub.reply("My current question", model), "hello");
    assert.deepEqual(
      calls.map((c) => new URL(c.url).host),
      [
        "generativelanguage.googleapis.com",
        "api.openai.com",
        "api.x.ai",
        "api.deepseek.com",
        "api.anthropic.com",
      ],
    );
    assert.ok(
      calls.every((c) =>
        JSON.stringify(c.body).includes("My current question"),
      ),
    );
    assert.ok(
      calls.every((c) => !JSON.stringify(c.body).includes("test-google")),
    );
    assert.doesNotMatch(
      JSON.stringify(hub.status()),
      /test-openai|test-google/,
    );
    assert.equal(calls[1].body.store, false);
    assert.equal(calls[1].body.input, "My current question");
  } finally {
    globalThis.fetch = original;
  }
});
test("missing provider key and provider errors never silently fall back", async () => {
  const hub = new CloudModels({}, () => {});
  await assert.rejects(
    () => hub.reply("hello", "openai:gpt-5-mini"),
    /API key/,
  );
  assert.equal(
    hub.models().find((m) => m.provider.startsWith("OpenAI"))?.is_available,
    false,
  );
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("", { status: 429 })) as typeof fetch;
  try {
    const configured = new CloudModels(
      { keys: { deepseek: "test" } },
      () => {},
    );
    await assert.rejects(
      () => configured.reply("hello", "deepseek:deepseek-flash"),
      /quota/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("discover models saves a bounded provider catalog and selection", async () => {
  const original = globalThis.fetch;
  let stored: any;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        data: [
          { id: "gpt-5-mini" },
          { id: "text-embedding-test" },
          { id: "gpt-5-mini" },
        ],
      }),
    )) as typeof fetch;
  try {
    const hub = new CloudModels({}, (data) => {
      stored = data;
    });
    await hub.manage({
      action: "save",
      provider: "openai",
      key: "private-test",
    });
    assert.deepEqual(stored.models.openai, ["gpt-5-mini"]);
    await hub.manage({ action: "select", model: "openai:gpt-5-mini" });
    assert.equal(hub.active, "openai:gpt-5-mini");
    assert.doesNotMatch(JSON.stringify(hub.status()), /private-test/);
  } finally {
    globalThis.fetch = original;
  }
});
