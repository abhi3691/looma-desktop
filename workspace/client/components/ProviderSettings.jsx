"use client";
import { useEffect, useState } from "react";
import { desktopService } from "../lib/api";
export default function ProviderSettings() {
  const [providers, setProviders] = useState([]),
    [keys, setKeys] = useState({}),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState("");
  const load = () =>
    desktopService("providers")
      .then(setProviders)
      .catch((e) => setNotice(e.message));
  useEffect(() => {
    load();
  }, []);
  const connect = async (id, action) => {
    setBusy(id);
    setNotice("");
    const key = keys[id] || "";
    setKeys((v) => ({ ...v, [id]: "" }));
    try {
      setProviders(
        await desktopService("providers", {
          action,
          provider: id,
          ...(key ? { key } : {}),
        }),
      );
      setNotice(id === "local" ? "Local model connected." : "Credential accepted. Model list refreshed.");
      window.dispatchEvent(new Event("looma-models-changed"));
    } catch (e) {
      setNotice(e.message);
      await load();
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="bg-[#fffdf8] border border-[#eadbc7] rounded-2xl p-4 space-y-4">
      <h3 className="text-sm font-semibold">AI providers</h3>
      <p className="text-xs text-[#89735e]">
        Choose GPT, Grok, Gemini, DeepSeek, Claude or Muse Glimmer. Keys are encrypted on this
        device. Only your current question goes to the selected provider; task
        data and memory stay local.
      </p>
      {providers.map((p) => (
        <div key={p.id} className="border-t border-[#eadbc7] pt-3 space-y-2">
          <div className="flex justify-between gap-2 text-xs">
            <strong>{p.name}</strong>
            <span>
              {p.verified
                ? (p.local ? "Local server connected" : "Key verified")
                : p.configured
                  ? "Key saved"
                  : "Not connected"}
            </span>
          </div>
          {!p.local && <input
            aria-label={p.id === "huggingface" ? "Hugging Face token" : `${p.name} API key`}
            type="password"
            autoComplete="new-password"
            value={keys[p.id] || ""}
            onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })}
            placeholder={
              p.configured
                ? "Paste a replacement key (optional)"
                : (p.id === "huggingface" ? "Paste HF_TOKEN" : "Paste API key")
            }
            className="w-full border border-[#dfcdb5] rounded-lg p-2 text-xs"
          />}
          {p.local && <p className="text-xs text-[#89735e]">Connect a local llama.cpp server on port 8080. For Muse Glimmer, use a current build with its chat template enabled.</p>}
          <div className="flex gap-2">
            <button
              disabled={!!busy || (!p.local && !keys[p.id] && !p.configured)}
              onClick={() => connect(p.id, "save")}
              className="px-3 py-2 rounded-lg bg-[#eadbc7] text-xs disabled:opacity-50"
            >
              {busy === p.id ? "Checking…" : (p.local ? "Connect local model" : "Save & connect")}
            </button>
            {p.configured && (
              <button
                disabled={!!busy}
                onClick={() => connect(p.id, "refresh")}
                className="text-xs p-2"
              >
                Refresh models
              </button>
            )}
          </div>
        </div>
      ))}
      {notice && (
        <p role="status" className="text-xs text-[#79563c]">
          {notice}
        </p>
      )}
      <p className="text-xs text-[#89735e]">
        Provider API keys and billing are separate from ChatGPT or other chat
        subscriptions. Keys for other providers must be added before use.
      </p>
    </section>
  );
}
