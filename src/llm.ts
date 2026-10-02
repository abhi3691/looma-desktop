import { liveReply } from "./google-live";
import type { Settings } from "./shared";
export type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};
export interface LLMProvider {
  reply(messages: Message[]): Promise<string>;
}
export class MockProvider implements LLMProvider {
  async reply(messages: Message[]) {
    const text = messages.at(-1)?.content.toLowerCase() ?? "";
    return (
      "[Offline demo · no model connected] " +
      (text.includes("plan")
        ? "Try a three-step checklist: name the outcome, finish one small step, then verify the result before switching tasks."
        : text.includes("privacy")
          ? "Activity remains on this device. Clipboard content is never saved. Screen snapshots are manual and discarded immediately. You can pause monitoring or erase history in Privacy."
          : "I’m here to help you slow down and double-check. What is the next task you want to finish? Connect a local model in Settings for real AI responses.")
    );
  }
}
export class LocalProvider implements LLMProvider {
  constructor(private s: Settings) {}
  async reply(messages: Message[]) {
    const ollama = this.s.provider === "ollama";
    const response = await fetch(
      ollama
        ? "http://127.0.0.1:11434/api/chat"
        : "http://127.0.0.1:8080/v1/chat/completions",
      {
        method: "POST",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.s.model,
          messages,
          stream: false,
          ...(!ollama
            ? { max_tokens: 512 }
            : { think: false, options: { num_predict: 512, num_ctx: 4096 } }),
        }),
        signal: AbortSignal.timeout(120000),
      },
    );
    if (!response.ok) throw Error("Local runtime returned " + response.status);
    const data = (await response.json()) as any;
    const value = ollama
      ? data.message?.content
      : data.choices?.[0]?.message?.content;
    if (typeof value !== "string" || !value.trim())
      throw Error("Empty local model response");
    return value.slice(0, 20000);
  }
}
let googleKey = () => "";
export function configureGoogleKey(reader: () => string) {
  googleKey = reader;
}
export class GoogleProvider implements LLMProvider {
  constructor(private model: string) {}
  async reply(messages: Message[]) {
    const key = googleKey();
    if (!key)
      return "Connect Google Gemini in Settings by adding your Google AI Studio API key.";
    if (this.model.includes("live")) return liveReply(key, messages);
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: 2048,
          reasoning_effort: this.model.startsWith("gemini-2.5")
            ? "none"
            : "low",
        }),
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!response.ok) {
      if (response.status === 429)
        return "Google Gemini’s usage limit was reached. Please try again later or check your Google API quota.";
      if ([401, 403].includes(response.status))
        return "Google rejected the API key. Check the key and its Gemini API permissions in Settings.";
      throw Error("Google Gemini returned " + response.status);
    }
    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim())
      throw Error("Empty Gemini response");
    return content.slice(0, 20000);
  }
}
export async function reply(s: Settings, messages: Message[]) {
  if (s.provider === "mock") return new MockProvider().reply(messages);
  if (s.provider === "google") {
    try {
      return await new GoogleProvider(s.model).reply(messages);
    } catch {
      return "Google Gemini is unavailable. Check your internet connection and model settings, then try again.";
    }
  }
  try {
    return await new LocalProvider(s).reply(messages);
  } catch {
    return (
      "Local model unavailable. Check that your runtime is running and the configured model is installed. " +
      (await new MockProvider().reply(messages))
    );
  }
}
