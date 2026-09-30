"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import clsx from "clsx";
import { useSettings } from "@/lib/useSettings";
import { PROVIDERS, PROVIDER_IDS, providerOf, type AIProvider } from "@/lib/ai/providers";

export default function SettingsPage() {
  const { settings, update, env, loaded } = useSettings();
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | "loading" | null>(null);
  if (!loaded) return null;

  // The dropdown picks whose key the box shows; each provider keeps its own key.
  const provider: AIProvider = settings.provider ?? PROVIDER_IDS.find((p) => settings.keys?.[p]) ?? "anthropic";
  const info = PROVIDERS[provider];
  const key = settings.keys?.[provider] ?? "";
  const fromEnv = !key && env?.[provider];
  // Judge only a full-length key, so typing "sk-" on the way to "sk-ant-" doesn't flip anything.
  const judge = (v: string) => (v.length >= 20 ? providerOf(v) : undefined);
  const who = judge(key);

  // A key that says whose it is (sk-ant- = Claude, xai- = Grok, …) switches the dropdown to match.
  function setKey(v: string) {
    const p = judge(v) ?? provider;
    update({ provider: p, keys: { ...settings.keys, [p]: v } });
    setStatus(null);
  }

  async function test() {
    setStatus("loading");
    try {
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings: { ...settings, provider } }),
      });
      setStatus(await res.json());
    } catch {
      setStatus({ ok: false, message: "Request failed" });
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Your AI key</h1>
      <p className="text-sm text-muted">
        Reads your slip photo. It stays in this browser.{" "}
        <a href={info.keyUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
          Get a {info.name} key
        </a>
      </p>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 basis-60">
          <input
            type={show ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            aria-label={`${info.name} key`}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 pr-10 font-mono text-sm outline-none focus:border-accent"
            placeholder={fromEnv ? "Set in .env.local" : `${info.prefix}…`}
            value={key}
            onChange={(e) => setKey(e.target.value.trim())}
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-fg" aria-label={show ? "Hide key" : "Show key"}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <select
          aria-label="Provider"
          value={provider}
          onChange={(e) => {
            update({ provider: e.target.value as AIProvider });
            setStatus(null);
          }}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        >
          {PROVIDER_IDS.map((p) => (
            <option key={p} value={p}>
              {PROVIDERS[p].name}
            </option>
          ))}
        </select>
        <button onClick={test} disabled={!key && !fromEnv} className="rounded-lg border border-line px-4 text-sm hover:border-accent hover:text-accent disabled:opacity-40">
          Test
        </button>
      </div>
      <p className={clsx("flex items-center gap-1.5 text-xs", status && status !== "loading" ? (status.ok ? "text-accent" : "text-danger") : who === null ? "text-danger" : "text-muted")}>
        {status === "loading" ? (
          <>
            <Loader2 size={12} className="animate-spin" /> Checking…
          </>
        ) : status ? (
          <>
            {status.ok ? <Check size={12} /> : <X size={12} />} {status.message}
          </>
        ) : who === null ? (
          `That doesn't look like a ${info.name} key.`
        ) : fromEnv ? (
          "Using the key in .env.local."
        ) : null}
      </p>
    </div>
  );
}
