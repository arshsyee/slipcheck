"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import clsx from "clsx";
import { useSettings } from "@/lib/useSettings";
import { providerOf } from "@/lib/keys";

const NAME = { anthropic: "Claude", openai: "ChatGPT" } as const;

export default function SettingsPage() {
  const { settings, update, env, loaded } = useSettings();
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | "loading" | null>(null);
  if (!loaded) return null;

  const key = settings.anthropicKey || settings.openaiKey || "";
  const who = providerOf(key);
  const fromEnv = !key && (env?.anthropic || env?.openai);

  // One box: the key's prefix picks the provider, and the other provider's key is cleared.
  function setKey(v: string) {
    const p = providerOf(v) ?? "anthropic";
    update({ anthropicKey: p === "anthropic" ? v : "", openaiKey: p === "openai" ? v : "" });
    setStatus(null);
  }

  async function test() {
    setStatus("loading");
    try {
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings }),
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
        Reads your slip photo. A Claude or ChatGPT key works. It stays in this browser. Get one from{" "}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-accent hover:underline">Claude</a> or{" "}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-accent hover:underline">ChatGPT</a>.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            aria-label="AI key"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 pr-10 font-mono text-sm outline-none focus:border-accent"
            placeholder={fromEnv ? "Set in .env.local" : "sk-…"}
            value={key}
            onChange={(e) => setKey(e.target.value.trim())}
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-fg" aria-label={show ? "Hide key" : "Show key"}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button onClick={test} disabled={!key && !fromEnv} className="rounded-lg border border-line px-4 text-sm hover:border-accent hover:text-accent disabled:opacity-40">
          Test
        </button>
      </div>
      <p className={clsx("flex items-center gap-1.5 text-xs", status && status !== "loading" ? (status.ok ? "text-accent" : "text-danger") : key && !who ? "text-danger" : "text-muted")}>
        {status === "loading" ? (
          <>
            <Loader2 size={12} className="animate-spin" /> Checking…
          </>
        ) : status ? (
          <>
            {status.ok ? <Check size={12} /> : <X size={12} />} {status.message}
          </>
        ) : key ? (
          who ? `${NAME[who]} key` : "That doesn't look like a Claude or ChatGPT key."
        ) : fromEnv ? (
          "Using the key in .env.local."
        ) : null}
      </p>
    </div>
  );
}
