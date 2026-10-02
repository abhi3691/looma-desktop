"use client";
import React, { useState, useEffect, useRef } from "react";
import { FiChevronDown, FiCheck } from "react-icons/fi";
export default function ModelPicker({
  currentModel,
  onSelectModel,
  models = [],
}) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("");
  const ref = useRef(null);
  const groups = [...new Set(models.map((m) => m.provider))];
  const selected = models.find(
    (m) => m.id === currentModel || m.id === `google:${currentModel}`,
  );
  const active = groups.includes(provider)
    ? provider
    : selected?.provider || groups[0];
  useEffect(() => {
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const key = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, []);
  return (
    <div className="relative z-50" ref={ref}>
      <button
        aria-expanded={open}
        aria-label="Choose AI model"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 border border-[#dfcdb5] rounded-xl px-4 py-2 bg-[#fffdf8] text-sm text-[#49382d]"
      >
        <span className="max-w-[220px] truncate">
          {selected?.name || currentModel || "Choose model"}
        </span>
        <FiChevronDown />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="AI models"
          className="absolute right-0 mt-2 w-[480px] max-w-[80vw] rounded-2xl shadow-xl border border-[#dfcdb5] bg-[#fffdf8] overflow-hidden"
        >
          <div className="p-4 border-b border-[#dfcdb5]">
            <strong className="text-sm">Choose your AI</strong>
            <p className="text-xs text-[#89735e] mt-1">
              Connect providers in Settings → AI providers. API usage may
              require credits.
            </p>
          </div>
          <div className="flex min-h-[220px]">
            <div className="w-40 shrink-0 p-2 bg-[#f3eadc]">
              {groups.map((name) => (
                <button
                  key={name}
                  onClick={() => setProvider(name)}
                  className={`block w-full text-left text-xs rounded-lg p-3 mb-1 ${active === name ? "bg-[#dfcdb5] font-semibold" : "hover:bg-[#eadbc7]"}`}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="p-2 flex-1 min-w-0 max-h-80 overflow-y-auto">
              {models
                .filter((m) => m.provider === active)
                .map((m) => (
                  <button
                    key={m.id}
                    disabled={!m.is_available}
                    onClick={() => {
                      onSelectModel(m.id);
                      setOpen(false);
                    }}
                    className="w-full text-left p-3 rounded-lg hover:bg-[#f3eadc] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="flex justify-between gap-2 text-xs break-all">
                      {m.name}
                      {selected?.id === m.id && (
                        <FiCheck className="shrink-0" />
                      )}
                    </span>
                    <span className="block text-[11px] mt-1 text-[#89735e]">
                      {m.is_available
                        ? "Key configured"
                        : "Add API key in Settings"}
                    </span>
                  </button>
                ))}
              {!models.length && (
                <p className="p-3 text-xs">
                  Open Settings to connect an AI provider.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
