"use client";
import { useEffect, useState } from "react";
import { desktopService } from "../lib/api";
export default function CompanionSettings() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    desktopService("companion", { action: "snapshot" }).then(setData);
  useEffect(() => {
    let live = true;
    const refresh = () =>
      desktopService("companion", { action: "snapshot" })
        .then((d) => {
          if (live) setData(d);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  const run = async (action, value) => {
    setBusy(true);
    setError("");
    try {
      await desktopService("companion", { action, value });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const change = async (patch) => {
    // "Hi Looma" listening is useless while the microphone itself is off.
    if (patch.wakeWord) patch = { ...patch, voiceInput: true };
    await run("settings", patch);
    if ("microphoneId" in patch || patch.voiceInput || patch.wakeWord)
      await run("restart");
  };
  if (!data)
    return (
      <section className="rounded-2xl border p-4 text-sm">
        {error || "Checking your voice companion…"}
      </section>
    );
  const s = data.settings,
    h = data.voiceHealth;
  const toggle = (key, label) => (
    <label
      key={key}
      className="flex items-center justify-between gap-3 text-sm"
    >
      <span>{label}</span>
      <input
        type="checkbox"
        checked={s[key]}
        disabled={busy}
        onChange={(e) => change({ [key]: e.target.checked })}
      />
    </label>
  );
  return (
    <section
      className="rounded-2xl border border-[#eadbc7] bg-[#fffdf8] p-4 space-y-4"
      aria-label="Voice companion settings"
    >
      <h3 className="font-semibold">Talk to Looma</h3>
      <p className="text-xs text-[#89735e]">
        Say “Hi Looma”, pause for her greeting, then ask your question. Speech
        recognition stays on this computer.
      </p>
      <button disabled={busy} onClick={() => change({voiceInput:true, voiceOutput:true, wakeWord:true})}>Enable voice assistant</button>
      {toggle("voiceInput", "Microphone")}
      {toggle("wakeWord", "Listen for “Hi Looma”")}
      {toggle("voiceOutput", "Speak replies")}
      {toggle("internet", "Internet answers")}
      <p className="text-xs text-[#89735e]">Allow online searches for news and current information. Only the search question is sent; microphone recordings stay local.</p>
      <label className="block text-sm">
        Microphone
        <select
          className="block w-full border rounded-lg p-2 mt-1"
          value={s.microphoneId || ""}
          disabled={busy}
          onChange={(e) => change({ microphoneId: e.target.value })}
        >
          <option value="">System default</option>
          {(h.devices || [])
            .filter((d) => d.id !== "default")
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
        </select>
      </label>
      <div
        className="rounded-xl bg-[#f3eadc] p-3 space-y-2 text-xs"
        role="status"
      >
        <p>
          {h.transcribing
            ? "Understanding your words…"
            : h.recording
              ? "Microphone is listening"
              : s.voiceInput
                ? "Microphone is not listening"
                : "Microphone is off"}
        </p>
        <meter
          className="w-full"
          aria-label="Microphone sound level"
          min="0"
          max="0.12"
          value={h.audioLevel || 0}
        />
        {h.lastHeard && <p>Last heard: {h.lastHeard}</p>}
        {h.error && <p className="text-red-700">{h.error}</p>}
        {h.permission === "denied" && (
          <p>
            Allow Looma under macOS System Settings → Privacy & Security →
            Microphone, then restart listening.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy || !s.voiceInput}
          onClick={() => run("restart")}
          className="rounded-lg bg-[#eadbc7] px-3 py-2 text-xs"
        >
          Restart listening
        </button>
        <button
          disabled={busy || !s.voiceOutput}
          onClick={() => run("test")}
          className="rounded-lg bg-[#eadbc7] px-3 py-2 text-xs"
        >
          Test voice
        </button>
      </div>
      <label className="block text-sm">
        Question language
        <select
          className="block w-full border rounded-lg p-2 mt-1"
          value={s.language}
          onChange={(e) => change({ language: e.target.value })}
        >
          <option value="auto">English & Malayalam · automatic</option>
          <option value="ml">Malayalam</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className="block text-sm">
        Spoken replies
        <select
          className="block w-full border rounded-lg p-2 mt-1"
          value={s.speechProvider}
          onChange={(e) => change({ speechProvider: e.target.value })}
        >
          <option value="offline">Meera · on this computer</option>
          <option value="edge">Sobhana · online</option>
        </select>
      </label>
      {toggle("cartoonVoice", "Playful voice")}
      {toggle("launchAtLogin", "Open Looma when I sign in")}
      {!data.runtime.speechModelAvailable && (
        <button
          disabled={busy || data.runtime.speechDownloading}
          onClick={() => run("model", "download-speech")}
        >
          Download speech model
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
