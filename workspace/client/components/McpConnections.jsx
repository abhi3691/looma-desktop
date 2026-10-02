"use client";
import { useEffect, useState } from "react";
import { desktopService } from "../lib/api";
export default function McpConnections() {
  const [items, setItems] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [name, setName] = useState(""),
    [url, setUrl] = useState(""),
    [token, setToken] = useState(""),
    [editing, setEditing] = useState(null),
    [tool, setTool] = useState(""),
    [args, setArgs] = useState({});
  const load = async () => {
    const data = await desktopService("mcp", { action: "list" });
    setItems(data.connections || []);
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  const run = async (value) => {
    setBusy(true);
    setError("");
    try {
      const data = await desktopService("mcp", value);
      setItems(data.connections || []);
      return true;
    } catch (e) {
      setError(e.message);
      await load().catch(() => {});
      return false;
    } finally {
      setBusy(false);
    }
  };
  const save = async (e) => {
    e.preventDefault();
    const key = token;
    setToken("");
    if (
      await run({
        action: "save",
        connection: { id: crypto.randomUUID(), name, url, token: key },
      })
    ) {
      setName("");
      setUrl("");
    }
  };
  const selected = editing?.tools?.find((t) => t.name === tool);
  const fields = Object.entries(selected?.inputSchema?.properties || {});
  const required = selected?.inputSchema?.required || [];
  const configure = async (e) => {
    e.preventDefault();
    const values = {};
    for (const [key, schema] of fields) {
      const v = args[key];
      if (v === undefined || v === "") continue;
      values[key] =
        schema.type === "number" || schema.type === "integer"
          ? Number(v)
          : schema.type === "boolean"
            ? v === "true"
            : schema.type === "array"
              ? v.split(",").map((x) => x.trim())
              : v;
    }
    if (
      await run({
        action: "configure",
        id: editing.id,
        tool,
        args: JSON.stringify(values),
      })
    )
      setEditing(null);
  };
  return (
    <section className="rounded-2xl border border-[#dfcdb5] bg-[#fffdf8] p-5 mb-6 space-y-4">
      <div className="flex justify-between">
        <div>
          <h2 className="font-semibold text-base">Your MCP connections</h2>
          <p className="text-xs text-[#89735e] mt-1">
            Connect Loom or another Streamable HTTP MCP server. These are shared
            with your desktop puppy.
          </p>
        </div>
        <button
          disabled={busy}
          onClick={() => load().catch((e) => setError(e.message))}
          className="text-xs p-2"
        >
          Refresh
        </button>
      </div>
      {items.map((c) => (
        <article
          key={c.id}
          className="border border-[#eadbc7] rounded-xl p-4 space-y-2"
        >
          <div className="flex justify-between text-sm">
            <strong>{c.name}</strong>
            <span>{c.connected ? "Connected" : "Disconnected"}</span>
          </div>
          <p className="text-xs text-[#89735e] break-all">{c.url}</p>
          <p className="text-xs">
            {c.connected
              ? `${c.tools.length} read tools available${c.tool ? " · Task queries ready" : ""}`
              : c.error || "Connect to discover available tools."}
          </p>
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() =>
                run({
                  action: c.connected ? "disconnect" : "connect",
                  id: c.id,
                })
              }
              className="rounded-lg bg-[#eadbc7] text-xs px-3 py-2"
            >
              {c.connected ? "Disconnect" : "Connect"}
            </button>
            {c.connected && (
              <button
                disabled={busy}
                onClick={() => {
                  setEditing(c);
                  setTool(c.tool || c.tools[0]?.name || "");
                  setArgs({});
                }}
                className="text-xs p-2"
              >
                Choose task tool
              </button>
            )}
          </div>
          {c.connected && (
            <details className="text-xs">
              <summary className="cursor-pointer">Available tools</summary>
              <ul className="mt-2 space-y-2">
                {c.tools.map((t) => (
                  <li key={t.name}>
                    <strong>{t.name.replaceAll("_", " ")}</strong>
                    <p className="text-[#89735e]">{t.description}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </article>
      ))}
      {!items.length && (
        <p className="text-sm">
          No MCP servers connected yet. Add Loom below to answer task questions.
        </p>
      )}
      {editing && (
        <form
          onSubmit={configure}
          className="rounded-xl bg-[#f3eadc] p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold">
            Task tool for {editing.name}
          </h3>
          <select
            aria-label="Task tool"
            value={tool}
            onChange={(e) => {
              setTool(e.target.value);
              setArgs({});
            }}
            className="w-full rounded-lg p-2 text-sm"
          >
            {editing.tools.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          {fields.map(([key, schema]) => (
            <label key={key} className="block text-xs">
              {schema.title || key.replaceAll("_", " ")}
              {required.includes(key) ? " *" : ""}
              <input
                required={required.includes(key)}
                value={args[key] || ""}
                placeholder={
                  schema.type === "array"
                    ? "Separate values with commas"
                    : key === "query"
                      ? "{{query}}"
                      : schema.description || ""
                }
                onChange={(e) => setArgs({ ...args, [key]: e.target.value })}
                className="block w-full mt-1 border rounded-lg p-2"
              />
            </label>
          ))}
          <button
            disabled={busy}
            className="text-xs bg-[#dfcdb5] rounded-lg p-2"
          >
            Use this tool
          </button>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="text-xs p-2"
          >
            Cancel
          </button>
        </form>
      )}
      <details className="text-sm" open={!items.length}>
        <summary className="cursor-pointer font-semibold">
          Add a connection
        </summary>
        <form onSubmit={save} className="grid gap-3 mt-4">
          <input
            aria-label="Connection name"
            required
            maxLength={40}
            placeholder="Name, e.g. Loom"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-[#dfcdb5] p-3 text-sm"
          />
          <input
            aria-label="MCP server URL"
            type="url"
            required
            placeholder="https://your-server.example/mcp"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="rounded-lg border border-[#dfcdb5] p-3 text-sm"
          />
          <input
            aria-label="MCP access token"
            type="password"
            autoComplete="new-password"
            placeholder="Access token (if required)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="rounded-lg border border-[#dfcdb5] p-3 text-sm"
          />
          <button
            disabled={busy}
            className="justify-self-start bg-[#eadbc7] rounded-lg px-4 py-2 text-sm"
          >
            {busy ? "Connecting…" : "Save & connect"}
          </button>
          <p className="text-xs text-[#89735e]">
            Tokens are encrypted locally. Task answers stay local and are not
            sent to your AI provider.
          </p>
        </form>
      </details>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
