import test from "node:test";
import assert from "node:assert/strict";
import { configureGoogleKey, reply } from "../src/llm";
import { defaults } from "../src/shared";
test("Google uses its fixed endpoint, distinguishes quota errors and never silently falls back", async () => {
  const original = globalThis.fetch;
  const settings = {
    ...defaults,
    provider: "google" as const,
    model: "gemini-2.5-flash",
  };
  try {
    configureGoogleKey(() => "");
    assert.match(await reply(settings, []), /API key/);
    configureGoogleKey(() => "test-key");
    globalThis.fetch = async (url, init) => {
      assert.equal(
        url,
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      );
      assert.equal((init?.headers as any).Authorization, "Bearer test-key");
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "നമസ്കാരം" } }] }),
      );
    };
    assert.equal(
      await reply(settings, [{ role: "user", content: "hi" }]),
      "നമസ്കാരം",
    );
    globalThis.fetch = async () => new Response("", { status: 429 });
    assert.match(await reply(settings, []), /usage limit/);
    globalThis.fetch = async () => {
      throw Error("offline");
    };
    assert.match(await reply(settings, []), /Google Gemini is unavailable/);
  } finally {
    globalThis.fetch = original;
    configureGoogleKey(() => "");
  }
});

import { liveQuestion } from "../src/google-live";
test("Live sends only the latest question without history or private system context", () => {
  assert.equal(
    liveQuestion([
      { role: "system", content: "private task results" },
      { role: "user", content: "old question" },
      { role: "assistant", content: "private results" },
      { role: "user", content: "hello" },
    ]),
    "hello",
  );
});
