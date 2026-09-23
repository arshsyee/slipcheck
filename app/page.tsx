"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, FlaskConical, KeyRound, Loader2, PencilLine, RotateCcw, Sparkles } from "lucide-react";
import { SlipDropzone } from "@/components/SlipDropzone";
import { EMPTY_LEG, LegEditor } from "@/components/LegEditor";
import { OddsTable } from "@/components/OddsTable";
import { InfoCard } from "@/components/InfoCard";
import { useSettings } from "@/lib/useSettings";
import { SAMPLE_SLIPS, type SampleSlip } from "@/lib/demo/slips";
import type { TeamInfo } from "@/lib/info/espn";
import type { CompareResult, Slip } from "@/lib/types";

type Stage = "upload" | "parsing" | "review" | "comparing" | "results";

export default function Home() {
  const { settings, hasAiKey, hasOddsKey, loaded } = useSettings();
  const [stage, setStage] = useState<Stage>("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [slip, setSlip] = useState<Slip | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [teams, setTeams] = useState<Record<string, TeamInfo | null> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setPreview(URL.createObjectURL(file));
    setStage("parsing");
    const form = new FormData();
    form.append("image", file);
    form.append("settings", JSON.stringify(settings));
    try {
      const res = await fetch("/api/parse", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const parsed = data.slip as Slip;
      if (!parsed.legs.length) throw new Error("Couldn't find any bets in that image. Try a clearer screenshot, or enter the bet manually.");
      setSlip(parsed);
      setStage("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStage("upload");
    }
  }

  function loadSample(sample: SampleSlip) {
    setDemo(true);
    setPreview(null);
    setSlip(sample.slip);
    compare(sample.slip, true);
  }

  async function compare(current = slip, demoMode = demo) {
    if (!current) return;
    const s: Slip = { ...current, betType: current.legs.length > 1 ? "parlay" : "single" };
    setError(null);
    setStage("comparing");
    setTeams(null);
    const body = JSON.stringify({ slip: s, settings, demo: demoMode });
    const headers = { "content-type": "application/json" };

    // Public info loads independently so a slow ESPN response doesn't block the odds.
    fetch("/api/info", { method: "POST", headers, body })
      .then((r) => r.json())
      .then((d) => setTeams(d.teams ?? {}))
      .catch(() => setTeams({}));

    try {
      const res = await fetch("/api/compare", { method: "POST", headers, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSlip(s);
      setResult(data);
      setStage("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStage("review");
    }
  }

  function reset() {
    setStage("upload");
    setSlip(null);
    setResult(null);
    setTeams(null);
    setPreview(null);
    setError(null);
    setDemo(false);
  }

  const missingKeys = loaded && (!hasAiKey || !hasOddsKey);

  return (
    <div className="space-y-10">
      <section className="mx-auto max-w-2xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs text-muted"
        >
          <Sparkles size={13} className="text-accent" /> AI reads your slip, then we price it at every US book
        </motion.div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
          Are you getting the <span className="bg-gradient-to-r from-accent to-emerald-300 bg-clip-text text-transparent">best payout</span>?
        </h1>
        <p className="mt-4 text-muted">Upload a bet slip screenshot to compare odds across DraftKings, FanDuel, BetMGM, Caesars and more.</p>
      </section>

      {missingKeys && (
        <Link
          href="/settings"
          className="glass mx-auto flex max-w-2xl items-center gap-3 rounded-xl border-warn/40 px-4 py-3 text-sm transition hover:border-warn"
        >
          <KeyRound size={18} className="shrink-0 text-warn" />
          <span className="flex-1">
            {!hasAiKey && !hasOddsKey
              ? "Add your AI key and Odds API key to get started."
              : !hasAiKey
                ? "Add a Claude or ChatGPT API key to read slips."
                : "Add an Odds API key to compare sportsbooks."}
          </span>
          <ArrowRight size={16} className="text-muted" />
        </Link>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-auto max-w-2xl rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {(stage === "upload" || stage === "parsing") && (
        <div className="mx-auto max-w-2xl">
          {stage === "parsing" ? (
            <ParsingState preview={preview} />
          ) : (
            <>
              <SlipDropzone onFile={handleFile} />
              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    setSlip({ sportsbook: null, stake: 10, betType: "single", totalOddsAmerican: null, potentialPayout: null, legs: [{ ...EMPTY_LEG }] });
                    setStage("review");
                  }}
                  className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-fg"
                >
                  <PencilLine size={14} /> or enter a bet manually
                </button>
              </div>
              <SamplePicker onPick={loadSample} />
            </>
          )}
        </div>
      )}

      {slip && (stage === "review" || stage === "comparing" || stage === "results") && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Your slip</h2>
              <p className="text-sm text-muted">Check that everything was read correctly and fix anything that&apos;s off.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={reset} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted transition hover:text-fg">
                <RotateCcw size={14} /> New slip
              </button>
              <button
                onClick={() => compare()}
                disabled={stage === "comparing" || !slip.legs.length}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg shadow-[0_0_24px_rgba(46,224,127,0.35)] transition hover:brightness-110 disabled:opacity-60"
              >
                {stage === "comparing" ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                {stage === "results" ? "Re-compare" : "Compare odds"}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-6 lg:flex-row">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Uploaded slip" className="max-h-72 w-full rounded-xl border border-line object-contain lg:w-48" />
            )}
            <div className="min-w-0 flex-1">
              <LegEditor slip={slip} onChange={setSlip} />
            </div>
          </div>
        </motion.section>
      )}

      {stage === "results" && result && slip && (
        <>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">Odds comparison</h2>
              {result.demo && (
                <span className="flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-2.5 py-0.5 text-xs text-warn">
                  <FlaskConical size={12} /> Demo odds (sample data, not live)
                </span>
              )}
            </div>
            <OddsTable slip={slip} result={result} />
          </section>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Matchup info</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {slip.legs.map((leg, i) => (
                <InfoCard
                  key={i}
                  leg={leg}
                  index={i}
                  match={result.matches[i]}
                  away={teams ? (teams[`${leg.sport}:${leg.awayTeam}`] ?? null) : undefined}
                  home={teams ? (teams[`${leg.sport}:${leg.homeTeam}`] ?? null) : undefined}
                />
              ))}
            </div>
            <p className="text-xs text-muted">Team records, results and injuries come from ESPN&apos;s public data.</p>
          </section>
        </>
      )}
    </div>
  );
}

function ParsingState({ preview }: { preview: string | null }) {
  return (
    <div className="glass flex flex-col items-center gap-5 rounded-3xl px-6 py-12">
      {preview && (
        <div className="relative overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="max-h-64 object-contain opacity-70" />
          <motion.div
            className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-accent/30 to-transparent"
            animate={{ top: ["-20%", "100%"] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 size={16} className="animate-spin text-accent" /> Reading your slip…
      </div>
    </div>
  );
}

function SamplePicker({ onPick }: { onPick: (s: SampleSlip) => void }) {
  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
        <FlaskConical size={13} /> No keys yet? Try a sample slip
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {SAMPLE_SLIPS.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s)}
            className="glass group rounded-xl px-4 py-3 text-left transition hover:border-accent/50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{s.title}</span>
              <ArrowRight size={14} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
            </div>
            <div className="mt-0.5 text-xs text-muted">{s.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
