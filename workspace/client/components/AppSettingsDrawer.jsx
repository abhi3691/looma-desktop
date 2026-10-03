"use client";

import LocalModelSettings from "./LocalModelSettings";
import MediaStudio from "./MediaStudio";
import AssistantControls from "./AssistantControls";
import SmartRoomSettings from "./SmartRoomSettings";
import CompanionSettings from "./CompanionSettings";
import ProviderSettings from "./ProviderSettings";
import React, { useState, useEffect } from "react";
import { FiX, FiEye, FiEyeOff, FiPlus, FiTrash2, FiChevronDown } from "react-icons/fi";
import { fetchSettings, saveSettings } from "../lib/api";

const inputClass = "w-full bg-[#f3eadc] border border-[#dfcdb5] rounded-lg px-3 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-400";
const cardClass = "bg-[#fffdf8] border border-[#eadbc7] rounded-2xl p-4 space-y-4";
const buttonClass = "rounded-lg px-3 py-2 text-xs font-medium bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed";

export default function AppSettingsDrawer({ models, isOpen, onClose, currentModel, onUpdateDefaultModel, onProfileUpdate }) {
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [wireApi, setWireApi] = useState("responses");
  const [apiKey, setApiKey] = useState("");
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [modelIds, setModelIds] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [headersConfigured, setHeadersConfigured] = useState(false);
  const [headersMode, setHeadersMode] = useState("keep");
  const [headers, setHeaders] = useState([{ name: "", value: "" }]);
  const [composioConfigured, setComposioConfigured] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [connectorNotice, setConnectorNotice] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoaded(false);
    setNotice(null);
    setConnectorNotice(null);
    setApiKey("");
    setShowKey(false);
    setUserName(localStorage.getItem("open_dots_user_name") || "");
    setUserEmail(localStorage.getItem("open_dots_user_email") || "");
    fetchSettings().then((data) => {
      if (cancelled) return;
      if (!data) {
        setNotice({ error: true, text: "Could not load settings. Reopen this panel to retry." });
        return;
      }
      setBaseUrl(data.model_api_base_url || "");
      setWireApi(data.model_api_wire_api || "prediction");
      setKeyConfigured(Boolean(data.model_api_key_configured));
      setModelIds((data.model_ids || []).join("\n"));
      setDefaultModel(data.default_model || currentModel || "gpt-5-mini");
      setHeadersConfigured(Boolean(data.model_api_headers_configured));
      setHeadersMode("keep");
      setHeaders([{ name: "", value: "" }]);
      setLoaded(true);
    });
    return () => { cancelled = true; };
    // Reload when opening, without overwriting a draft when the active model changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const saveProvider = async (event) => {
    event.preventDefault();
    setNotice(null);
    setSaving(true);
    try {
      const url = new URL(baseUrl.trim());
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error("Enter an http(s) API base URL without credentials, query parameters, or fragments.");
      }
      const selectedModel = defaultModel.trim();
      if (!selectedModel) throw new Error("Enter a default model ID.");
      const ids = [...new Set([...modelIds.split(/[\n,]+/).map((id) => id.trim()).filter(Boolean), selectedModel])];
      const payload = {
        model_api_base_url: baseUrl.trim().replace(/\/+$/, ""),
        model_api_wire_api: wireApi,
        model_api_key: apiKey.trim(),
        model_ids: ids,
        default_model: selectedModel,
      };
      if (headersMode === "replace") {
        const entries = headers.map(({ name, value }) => [name.trim(), value]);
        if (!entries.length || entries.some(([name, value]) => !name || !value)) {
          throw new Error("Fill in a name and value for each header, or select Remove all.");
        }
        if (new Set(entries.map(([name]) => name.toLowerCase())).size !== entries.length) {
          throw new Error("Each custom header must have a unique name.");
        }
        payload.model_api_headers = Object.fromEntries(entries);
      } else if (headersMode === "remove") {
        payload.clear_model_api_headers = true;
      }
      const saved = await saveSettings(payload);
      setBaseUrl(saved.model_api_base_url);
      setApiKey("");
      setShowKey(false);
      setKeyConfigured(Boolean(saved.model_api_key_configured));
      setHeadersConfigured(Boolean(saved.model_api_headers_configured));
      setHeadersMode("keep");
      setHeaders([{ name: "", value: "" }]);
      setModelIds(saved.model_ids.join("\n"));
      setDefaultModel(saved.default_model);
      await onUpdateDefaultModel?.(saved.default_model);
      setNotice({ text: "Provider settings saved. Model menus updated." });
    } catch (error) {
      setNotice({ error: true, text: error.message || "Could not save provider settings." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside aria-label="App Settings" className="w-96 md:w-[420px] max-w-[100vw] h-screen bg-[#fffdf8] border-l border-[#eadbc7] flex flex-col z-30 shadow-2xl flex-shrink-0">
      <div className="p-5 border-b border-[#eadbc7] flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-100">App Settings</h2>
        <button onClick={onClose} title="Close App Settings" className="p-1 text-zinc-400 hover:text-white"><FiX /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <CompanionSettings />
        <ProviderSettings />
        <LocalModelSettings />
        <AssistantControls />
        <MediaStudio />
        <SmartRoomSettings />

        <div className={cardClass}>
          <h3 className="text-sm font-semibold">Profile</h3>
          <p className="text-xs text-zinc-400">Saved as you type.</p>
          <label htmlFor="profile-name" className="block text-xs font-medium">Your name</label>
          <input id="profile-name" value={userName} onChange={(e) => { setUserName(e.target.value); localStorage.setItem("open_dots_user_name", e.target.value); onProfileUpdate?.(e.target.value); }} className={inputClass} />
          <label htmlFor="profile-email" className="block text-xs font-medium">Email</label>
          <input id="profile-email" type="email" value={userEmail} onChange={(e) => { setUserEmail(e.target.value); localStorage.setItem("open_dots_user_email", e.target.value); }} className={inputClass} />
        </div>
      </div>
    </aside>
  );
}
