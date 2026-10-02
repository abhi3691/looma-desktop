import { z } from "zod";
import { liveReply } from "./google-live";
export const cloudProviders = {
  google: {
    name: "Google Gemini",
    base: "https://generativelanguage.googleapis.com/v1beta",
    seeds: ["gemini-3.1-flash-live-preview"],
    protocol: "google",
  },
  openai: {
    name: "OpenAI · GPT",
    base: "https://api.openai.com/v1",
    seeds: ["gpt-5-mini", "gpt-4.1"],
    protocol: "responses",
  },
  xai: {
    name: "xAI · Grok",
    base: "https://api.x.ai/v1",
    seeds: ["grok-4.7"],
    protocol: "responses",
  },
  deepseek: {
    name: "DeepSeek",
    base: "https://api.deepseek.com",
    seeds: ["deepseek-flash"],
    protocol: "chat",
  },
  anthropic: {
    name: "Anthropic · Claude",
    base: "https://api.anthropic.com/v1",
    seeds: ["claude-sonnet-4-6"],
    protocol: "anthropic",
  },
} as const;
export type CloudId = keyof typeof cloudProviders;
const providerId = z.enum(["google", "openai", "xai", "deepseek", "anthropic"]);
const storedSchema = z.object({
  keys: z.record(z.string(), z.string()).default({}),
  models: z.record(z.string(), z.array(z.string())).default({}),
  active: z.string().default(""),
});
export type CloudStore = z.infer<typeof storedSchema>;
const guidance =
  "You are Looma, a warm desktop assistant. Reply naturally in the user’s language, including Malayalam. No emoji or role-play sounds. You receive only this question, not previous conversation or private task data. Never invent tool results.";
export class CloudModels {
  private data: CloudStore;
  private checked = new Set<string>();
  constructor(
    stored: unknown,
    private save: (data: CloudStore) => void,
    private googleKey: () => string = () => "",
  ) {
    this.data = storedSchema.parse(stored || {});
  }
  get active() {
    return this.data.active;
  }
  private key(id: CloudId) {
    return this.data.keys[id] || (id === "google" ? this.googleKey() : "");
  }
  status() {
    return Object.entries(cloudProviders).map(([id, p]) => ({
      id,
      name: p.name,
      configured: !!this.key(id as CloudId),
      verified: this.checked.has(id),
      models: this.data.models[id] || [...p.seeds],
    }));
  }
  models() {
    return this.status().flatMap((p) =>
      p.models.map((model) => ({
        id: `${p.id}:${model}`,
        name: model,
        provider: p.name,
        description: p.configured
          ? "Key saved · choose to use"
          : "API key needed in Settings",
        is_available: p.configured,
        recommended: `${p.id}:${model}` === this.data.active,
      })),
    );
  }
  private headers(id: CloudId): Record<string, string> {
    const key = this.key(id);
    if (!key)
      throw Error(
        `Add your ${cloudProviders[id].name} API key in Settings → AI providers.`,
      );
    return id === "google"
      ? { "x-goog-api-key": key }
      : id === "anthropic"
        ? { "x-api-key": key, "anthropic-version": "2023-06-01" }
        : { Authorization: `Bearer ${key}` };
  }
  private async request(id: CloudId, path: string, body?: unknown) {
    let response: Response;
    try {
      response = await fetch(cloudProviders[id].base + path, {
        method: body ? "POST" : "GET",
        redirect: "error",
        headers: { ...this.headers(id), "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(body ? 90000 : 20000),
      });
    } catch (e) {
      if (!this.key(id)) throw e;
      throw Error(
        `${cloudProviders[id].name} could not be reached. Check your internet connection.`,
      );
    }
    if (!response.ok)
      throw Error(
        response.status === 429
          ? `${cloudProviders[id].name} quota or rate limit reached. Check your API plan.`
          : [401, 403].includes(response.status)
            ? `${cloudProviders[id].name} rejected this key or its permissions.`
            : response.status === 404
              ? "That model is not available to this API key. Refresh the model list and choose another."
              : `${cloudProviders[id].name} returned an error (${response.status}). Please retry.`,
      );
    return response.json() as Promise<any>;
  }
  async manage(raw: unknown) {
    const value = z
      .object({
        action: z.enum(["save", "refresh", "select"]),
        provider: providerId.optional(),
        key: z.string().trim().max(4096).optional(),
        model: z.string().max(200).optional(),
      })
      .strict()
      .parse(raw);
    if (value.action === "select") {
      if (!value.model) throw Error("Choose a model");
      const { id } = this.resolve(value.model);
      this.headers(id);
      this.data.active = value.model;
      this.save(this.data);
      return this.status();
    }
    if (!value.provider) throw Error("Choose a provider");
    if (value.action === "save" && value.key) {
      this.data.keys[value.provider] = value.key;
      this.checked.delete(value.provider);
      this.save(this.data);
    }
    const result = await this.request(value.provider, "/models");
    let ids: string[];
    if (value.provider === "google")
      ids = (result.models || [])
        .filter((m: any) =>
          m.supportedGenerationMethods?.some((x: string) =>
            ["generateContent", "bidiGenerateContent"].includes(x),
          ),
        )
        .map((m: any) => m.name.replace(/^models\//, ""));
    else
      ids = (result.data || [])
        .map((m: any) => m.id)
        .filter((id: unknown) => typeof id === "string");
    ids = ids.filter(
      (id) =>
        /^[a-zA-Z0-9._:/-]{1,180}$/.test(id) &&
        !/embedding|image|audio|realtime|tts|whisper|moderation|transcri|video/i.test(
          id,
        ),
    );
    if (value.provider === "openai")
      ids = ids.filter((id) => /^(gpt-|o[134])/.test(id));
    if (
      value.provider === "google" &&
      !ids.includes("gemini-3.1-flash-live-preview")
    )
      ids.unshift("gemini-3.1-flash-live-preview");
    if (!ids.length)
      throw Error(
        "The key was accepted, but no compatible text models were returned.",
      );
    this.data.models[value.provider] = [...new Set(ids)].slice(0, 150);
    this.checked.add(value.provider);
    this.save(this.data);
    return this.status();
  }
  resolve(value: string) {
    const match = value.match(/^(google|openai|xai|deepseek|anthropic):(.+)$/);
    const id = providerId.parse(
      match?.[1] || (value.startsWith("gemini-") ? "google" : undefined),
    );
    const model = match?.[2] || value;
    if (!/^[a-zA-Z0-9._:/-]{1,180}$/.test(model)) throw Error("Invalid model");
    return { id, model };
  }
  async reply(question: string, selection = this.data.active) {
    const { id, model } = this.resolve(selection);
    this.headers(id);
    if (id === "google" && model.includes("live"))
      return liveReply(this.key(id), [{ role: "user", content: question }]);
    const protocol = cloudProviders[id].protocol;
    let result: any,
      answer = "";
    if (protocol === "google") {
      result = await this.request(
        id,
        `/models/${encodeURIComponent(model)}:generateContent`,
        {
          systemInstruction: { parts: [{ text: guidance }] },
          contents: [{ role: "user", parts: [{ text: question }] }],
          generationConfig: { maxOutputTokens: 4096 },
        },
      );
      answer = (result.candidates?.[0]?.content?.parts || [])
        .filter((p: any) => !p.thought)
        .map((p: any) => p.text || "")
        .join("");
    } else if (protocol === "responses") {
      result = await this.request(id, "/responses", {
        model,
        instructions: guidance,
        input: question,
        max_output_tokens: 4096,
        store: false,
      });
      answer = (result.output || [])
        .flatMap((o: any) => o.content || [])
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text)
        .join("");
    } else if (protocol === "anthropic") {
      result = await this.request(id, "/messages", {
        model,
        system: guidance,
        messages: [{ role: "user", content: question }],
        max_tokens: 4096,
      });
      answer = (result.content || [])
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("");
    } else {
      result = await this.request(id, "/chat/completions", {
        model,
        messages: [
          { role: "system", content: guidance },
          { role: "user", content: question },
        ],
        max_tokens: 4096,
        stream: false,
      });
      answer = result.choices?.[0]?.message?.content || "";
    }
    if (!answer.trim())
      throw Error(
        "The model returned no spoken text. Choose another model or retry.",
      );
    return answer.slice(0, 20000);
  }
}
