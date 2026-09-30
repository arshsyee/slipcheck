"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import clsx from "clsx";
import { useSettings } from "@/lib/useSettings";
import { providerOf } from "@/lib/keys";

const NAME = { anthropic: "Claude", openai: "ChatGPT" } as const;
const GET_KEY = { anthropic: "https://console.anthropic.com/settings/keys", openai: "https://platform.openai.com/api-keys" } as const;
const FIELD = { anthropic: "anthropicKey", openai: "openaiKey" } as const;

export default function SettingsPage() {
  const { settings, update, env, loaded } = useSettings();
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | "loading" | null>(null);
  if (!loaded) return null;

  // The selector picks whose key the box shows; each provider keeps its own key.
  const provider = settings.provider ?? (settings.openaiKey && !settings.anthropicKey ? "openai" : "anthropic");
  const key = settings[FIELD[provider]] ?? "";
  // Judge only a full-length key, so typing "sk-" on the way to "sk-ant-" doesn't flip anything.
  const judge = (v: string) => (v.length >= 20 ? providerOf(v) : undefined);
  const who = judge(key);
  const fromEnv = !key && env?.[provider];

  // A key that says whose it is (sk-ant- = Claude) switches the selector to match.
  function setKey(v: string) {
    const p = judge(v) ?? provider;
    update({ provider: p, [FIELD[p]]: v });
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
      <p className="text-sm text-muted">Reads your slip photo. It stays in this browser.</p>
      <div className="flex items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Provider" className="inline-flex rounded-lg border border-line p-0.5">
          {(["anthropic", "openai"] as const).map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={provider === p}
              onClick={() => {
                update({ provider: p });
                setStatus(null);
              }}
              className={clsx("rounded-md px-3 py-1 text-sm", provider === p ? "bg-accent/15 text-accent" : "text-muted hover:text-fg")}
            >
              {NAME[p]}
            </button>
          ))}
        </div>
        <a href={GET_KEY[provider]} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
          Get a {NAME[provider]} key
        </a>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            aria-label={`${NAME[provider]} key`}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 pr-10 font-mono text-sm outline-none focus:border-accent"
            placeholder={fromEnv ? "Set in .env.local" : provider === "anthropic" ? "sk-ant-…" : "sk-…"}
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
          who !== null ? null : `That doesn't look like a ${NAME[provider]} key.`
        ) : fromEnv ? (
          "Using the key in .env.local."
        ) : null}
      </p>
    </div>
  );
}
