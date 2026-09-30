"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Database, FlaskConical, KeyRound, Loader2, RotateCcw, Sparkles } from "lucide-react";
import clsx from "clsx";
import { SlipDropzone } from "@/components/SlipDropzone";
import { LegEditor } from "@/components/LegEditor";
import { MatchCard, MatchCardSkeleton } from "@/components/dossier/MatchCard";
import { Crest } from "@/components/dossier/bits";
import { useSettings } from "@/lib/useSettings";
import type { MatchDossier } from "@/lib/dossier/types";
import type { SampleSlip } from "@/lib/samples";
import type { Slip } from "@/lib/types";

type Stage = "upload" | "parsing" | "review" | "results";
type LegState = { status: "loading" } | { status: "ready"; dossier: MatchDossier } | { status: "error"; error: string };


export default function Home() {
  const { settings, hasAiKey, loaded } = useSettings();
  const [stage, setStage] = useState<Stage>("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [slip, setSlip] = useState<Slip | null>(null);
  const [legs, setLegs] = useState<LegState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<SampleSlip[] | null>(null);

  useEffect(() => {
    fetch("/api/samples")
      .then((r) => r.json())
      .then((d) => setSamples(d.samples ?? []))
      .catch(() => setSamples([]));
  }, []);

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
      if (!parsed.legs.length) throw new Error("Couldn't find any football selections in that image. Try a clearer screenshot.");
      setSlip(parsed);
      setStage("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStage("upload");
    }
  }

  async function research(current = slip) {
    if (!current?.legs.length) return;
    const s = current;
    setSlip(s);
    setError(null);
    setLegs(s.legs.map(() => ({ status: "loading" })));
    setStage("results");
    window.scrollTo({ top: 0, behavior: "smooth" });

    try {
      const res = await fetch("/api/dossier", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slip: s }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't gather match data");
      // NDJSON: one match file per line, in the order they finish.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const msg = JSON.parse(line) as { legIndex: number; dossier?: MatchDossier; error?: string };
          setLegs((prev) =>
            prev.map((l, i) =>
              i !== msg.legIndex ? l : msg.dossier ? { status: "ready", dossier: msg.dossier } : { status: "error", error: msg.error ?? "Failed" },
            ),
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLegs((prev) => prev.map((l) => (l.status === "loading" ? { status: "error", error: "Request failed" } : l)));
    }
  }

  function reset() {
    setStage("upload");
    setSlip(null);
    setLegs([]);
    setPreview(null);
    setError(null);
  }

  return (
    <div className="space-y-10">
      {stage !== "results" && (
        <section className="mx-auto max-w-2xl text-center">
          <div className="rise inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs text-muted">
            <Database size={13} className="text-accent" /> Free public data · Premier League, La Liga, Serie A, Bundesliga, Ligue 1 + Champions League
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            Know every match <span className="bg-gradient-to-r from-accent to-emerald-300 bg-clip-text text-transparent">on your slip</span>
          </h1>
          <p className="mt-4 text-muted">
            Upload your football bet slip. We pull form, xG, head-to-heads, referees, team news, lineups and weather for every selection.
          </p>
        </section>
      )}

      {loaded && !hasAiKey && stage === "upload" && (
        <Link href="/settings" className="glass mx-auto flex max-w-2xl items-center gap-3 rounded-xl px-4 py-3 text-sm transition hover:border-warn">
          <KeyRound size={18} className="shrink-0 text-warn" />
          <span className="flex-1">Add an AI key (Claude, ChatGPT, Grok, Gemini or OpenRouter) to read slip screenshots. Until then, try a sample.</span>
          <ArrowRight size={16} className="text-muted" />
        </Link>
      )}

      {error && <div className="rise mx-auto max-w-2xl rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

      {stage !== "results" && (
        // One screen: the photo on the left, the picks on the right. The only motion is picks arriving.
        <section className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="self-start lg:sticky lg:top-24">
            <SlipDropzone onFile={handleFile} disabled={loaded && !hasAiKey} preview={preview} />
          </div>
          <div className="min-w-0 space-y-3">
            {slip && stage === "review" ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">Your picks</h2>
                  <div className="flex gap-2">
                    <button onClick={reset} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-fg">
                      <RotateCcw size={14} /> Start over
                    </button>
                    <button
                      onClick={() => research()}
                      disabled={!slip.legs.some((l) => l.homeTeam || l.awayTeam)}
                      className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg hover:brightness-110 disabled:opacity-50"
                    >
                      <Sparkles size={15} /> Research {slip.legs.length > 1 ? `${slip.legs.length} matches` : "match"}
                    </button>
                  </div>
                </div>
                <LegEditor slip={slip} onChange={(f) => setSlip((s) => s && f(s))} />
              </>
            ) : stage === "parsing" ? (
              <p className="py-6 text-sm text-muted">Reading your slip…</p>
            ) : (
              <>
                <p className="py-6 text-sm text-muted">Your picks show up here once your slip is read.</p>
                <SamplePicker
                  samples={samples}
                  onPick={(s) => {
                    setPreview(null);
                    setSlip(s.slip);
                    setStage("review");
                  }}
                />
              </>
            )}
          </div>
        </section>
      )}

      {slip && stage === "results" && (
        <div className="space-y-6">
          <SlipSummary slip={slip} legs={legs} onEdit={() => setStage("review")} onReset={reset} />
          {legs.map((l, i) =>
            l.status === "ready" ? (
              <MatchCard key={i} d={l.dossier} />
            ) : l.status === "loading" ? (
              <MatchCardSkeleton key={i} index={i} home={slip.legs[i].homeTeam} away={slip.legs[i].awayTeam} />
            ) : (
              <div key={i} className="rounded-2xl border border-danger/40 bg-danger/10 p-5 text-sm text-danger">
                Leg {i + 1} ({slip.legs[i].homeTeam} v {slip.legs[i].awayTeam}): {l.error}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function SlipSummary({
  slip,
  legs,
  onEdit,
  onReset,
}: {
  slip: Slip;
  legs: LegState[];
  onEdit: () => void;
  onReset: () => void;
}) {
  const done = legs.filter((l) => l.status !== "loading").length;
  return (
    <section className="glass z-10 rounded-2xl px-4 py-3 sm:sticky sm:top-16 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-semibold">{slip.legs.length === 1 ? "1 match" : `${slip.legs.length} matches`}</span>
          {slip.legs.length > 1 && (
            <span className="text-muted">
              {" · "}
              {slip.legs.every((l) => l.oddsDecimal)
                ? `all ${slip.legs.length} together: ${(slip.legs.reduce((p, l) => p / l.oddsDecimal!, 1) * 100).toFixed(1)}% implied chance`
                : "add every pick's odds to see the combined chance"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          {done < legs.length && (
            <span className="flex items-center gap-1.5 text-muted">
              <Loader2 size={14} className="animate-spin text-accent" /> {done}/{legs.length} ready
            </span>
          )}
          <button onClick={onEdit} className="rounded-lg border border-line px-3 py-1.5 text-muted transition hover:text-fg">
            Edit slip
          </button>
          <button onClick={onReset} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-muted transition hover:text-fg">
            <RotateCcw size={13} /> New slip
          </button>
        </div>
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {slip.legs.map((leg, i) => {
          const l = legs[i];
          const d = l?.status === "ready" ? l.dossier : null;
          return (
            <a
              key={i}
              href={`#leg-${i}`}
              className={clsx(
                "flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition hover:border-accent/60",
                l?.status === "error" ? "border-danger/40" : "border-line",
              )}
            >
              {d ? (
                <span className="flex -space-x-1.5">
                  <Crest src={d.home.badge} name={d.home.name} size={18} />
                  <Crest src={d.away.badge} name={d.away.name} size={18} />
                </span>
              ) : (
                <Loader2 size={14} className={clsx(l?.status === "loading" ? "animate-spin text-muted" : "text-danger")} />
              )}
              <span className="max-w-[180px] truncate">
                {leg.homeTeam} v {leg.awayTeam}
              </span>
              <span className="text-muted">{leg.selection}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function SamplePicker({ samples, onPick }: { samples: SampleSlip[] | null; onPick: (s: SampleSlip) => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
        <FlaskConical size={13} /> Or try a sample slip (real upcoming fixtures)
      </div>
      {samples === null ? (
        <p className="text-sm text-muted">Loading samples…</p>
      ) : samples.length === 0 ? (
        <p className="text-sm text-muted">No samples available right now.</p>
      ) : (
        <div className="grid gap-2">
          {samples.map((s) => (
            <button key={s.id} onClick={() => onPick(s)} className="glass rounded-xl px-4 py-3 text-left hover:border-accent/50">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{s.title}</span>
                <ArrowRight size={14} className="text-muted" />
              </div>
              <div className="mt-0.5 text-xs text-muted">{s.blurb}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

