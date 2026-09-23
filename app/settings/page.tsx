"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ExternalLink, Eye, EyeOff, Loader2, ShieldCheck, X } from "lucide-react";
import clsx from "clsx";
import { useSettings } from "@/lib/useSettings";
import type { ClientSettings } from "@/lib/types";

type Which = "anthropic" | "openai" | "odds";

const KEY_FIELDS: {
  which: Which;
  field: "anthropicKey" | "openaiKey" | "oddsKey";
  label: string;
  placeholder: string;
  help: string;
  href: string;
}[] = [
  {
    which: "anthropic",
    field: "anthropicKey",
    label: "Claude (Anthropic) API key",
    placeholder: "sk-ant-…",
    help: "Reads your bet slip screenshot.",
    href: "https://console.anthropic.com/settings/keys",
  },
  {
    which: "openai",
    field: "openaiKey",
    label: "ChatGPT (OpenAI) API key",
    placeholder: "sk-…",
    help: "Alternative slip reader. You only need one of the two AI keys.",
    href: "https://platform.openai.com/api-keys",
  },
  {
    which: "odds",
    field: "oddsKey",
    label: "The Odds API key",
    placeholder: "32-character key",
    help: "Live odds from 40+ US sportsbooks. The free tier gives 500 requests a month.",
    href: "https://the-odds-api.com/#get-access",
  },
];

export default function SettingsPage() {
  const { settings, update, env, loaded } = useSettings();

  if (!loaded) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted">
          Bring your own keys. They are saved only in this browser and sent only to this app running on your machine,
          which passes them straight to each provider.
        </p>
      </div>

      <section className="glass rounded-2xl p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">AI that reads your slip</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(["anthropic", "openai"] as const).map((p) => (
            <button
              key={p}
              onClick={() => update({ provider: p })}
              className={clsx(
                "rounded-xl border px-4 py-3 text-left transition",
                settings.provider === p
                  ? "border-accent bg-accent/10 shadow-[0_0_0_1px_var(--color-accent)]"
                  : "border-line hover:border-muted/50",
              )}
            >
              <div className="font-medium">{p === "anthropic" ? "Claude" : "ChatGPT"}</div>
              <div className="text-xs text-muted">{p === "anthropic" ? "Anthropic" : "OpenAI"}</div>
            </button>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="text-xs text-muted">Model (optional)</span>
          <input
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder={settings.provider === "anthropic" ? "claude-sonnet-5" : "gpt-5"}
            value={(settings.provider === "anthropic" ? settings.anthropicModel : settings.openaiModel) ?? ""}
            onChange={(e) =>
              update(
                settings.provider === "anthropic"
                  ? { anthropicModel: e.target.value }
                  : { openaiModel: e.target.value },
              )
            }
          />
        </label>
      </section>

      <section className="glass space-y-6 rounded-2xl p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">API keys</h2>
        {KEY_FIELDS.map((f) => (
          <KeyField
            key={f.which}
            {...f}
            value={settings[f.field] ?? ""}
            fromEnv={Boolean(env?.[f.which])}
            settings={settings}
            onChange={(v) => update({ [f.field]: v })}
          />
        ))}
      </section>

      <p className="flex items-center gap-2 text-xs text-muted">
        <ShieldCheck size={14} className="text-accent" />
        You can also put keys in <code className="rounded bg-surface-2 px-1">.env.local</code> (see{" "}
        <code className="rounded bg-surface-2 px-1">.env.example</code>) so they never touch the browser.
      </p>
    </motion.div>
  );
}

function KeyField(props: {
  which: Which;
  label: string;
  placeholder: string;
  help: string;
  href: string;
  value: string;
  fromEnv: boolean;
  settings: ClientSettings;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | "loading" | null>(null);

  async function test() {
    setStatus("loading");
    try {
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ which: props.which, settings: props.settings }),
      });
      setStatus(await res.json());
    } catch {
      setStatus({ ok: false, message: "Request failed" });
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label className="font-medium">{props.label}</label>
        <a href={props.href} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-accent hover:underline">
          Get a key <ExternalLink size={12} />
        </a>
      </div>
      <p className="mt-0.5 text-xs text-muted">{props.help}</p>
      <div className="mt-2 flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 pr-10 font-mono text-sm outline-none focus:border-accent"
            placeholder={props.fromEnv && !props.value ? "Set in .env.local" : props.placeholder}
            value={props.value}
            onChange={(e) => {
              props.onChange(e.target.value.trim());
              setStatus(null);
            }}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-fg"
            aria-label={show ? "Hide key" : "Show key"}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          onClick={test}
          disabled={!props.value && !props.fromEnv}
          className="rounded-lg border border-line px-4 text-sm transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-line disabled:hover:text-fg"
        >
          Test
        </button>
      </div>
      {status && (
        <div
          className={clsx(
            "mt-2 flex items-center gap-1.5 text-xs",
            status === "loading" ? "text-muted" : status.ok ? "text-accent" : "text-danger",
          )}
        >
          {status === "loading" ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Checking…
            </>
          ) : (
            <>
              {status.ok ? <Check size={12} /> : <X size={12} />} {status.message}
            </>
          )}
        </div>
      )}
    </div>
  );
}
