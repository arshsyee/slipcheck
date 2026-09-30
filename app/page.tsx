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
  const oddsFormat = settings.oddsFormat ?? "fractional";
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
          <span className="flex-1">Add a Claude or ChatGPT API key to read slip screenshots. Until then, try a sample.</span>
          <ArrowRight size={16} className="text-muted" />
        </Link>
      )}

      {error && <div className="rise mx-auto max-w-2xl rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

      {(stage === "upload" || stage === "parsing") && (
        <div className="mx-auto max-w-2xl">
          {stage === "parsing" ? (
            <ParsingState preview={preview} />
          ) : (
            <>
              <SlipDropzone onFile={handleFile} disabled={loaded && !hasAiKey} />
              <SamplePicker
                samples={samples}
                onPick={(s) => {
                  setPreview(null);
                  research(s.slip);
                }}
              />
            </>
          )}
        </div>
      )}

      {slip && stage === "review" && (
        <section className="rise glass rounded-2xl p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Check your slip</h2>
              <p className="text-sm text-muted">Fix anything that was read wrong, then gather the match data.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={reset} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted transition hover:text-fg">
                <RotateCcw size={14} /> Start over
              </button>
              <button
                onClick={() => research()}
                disabled={!slip.legs.some((l) => l.homeTeam || l.awayTeam)}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg shadow-[0_0_24px_rgba(46,224,127,0.35)] transition hover:brightness-110 disabled:opacity-50"
              >
                <Sparkles size={15} /> Research {slip.legs.length > 1 ? `${slip.legs.length} matches` : "match"}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-6 lg:flex-row">
            {preview && <SlipPhoto src={preview} />}
            <div className="min-w-0 flex-1">
              <LegEditor slip={slip} onChange={(f) => setSlip((s) => s && f(s))} oddsFormat={oddsFormat} />
            </div>
          </div>
        </section>
      )}

      {slip && stage === "results" && (
        <div className="space-y-6">
          <SlipSummary slip={slip} legs={legs} onEdit={() => setStage("review")} onReset={reset} />
          {legs.map((l, i) =>
            l.status === "ready" ? (
              <MatchCard key={i} d={l.dossier} oddsFormat={oddsFormat} />
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
    <div className="mt-10">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
        <FlaskConical size={13} /> Or try a sample slip (real upcoming fixtures)
      </div>
      {samples === null ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass h-[74px] animate-pulse rounded-xl" />
          ))}
        </div>
      ) : samples.length === 0 ? (
        <p className="text-sm text-muted">No samples available right now.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          {samples.map((s) => (
            <button key={s.id} onClick={() => onPick(s)} className="glass group rounded-xl px-4 py-3 text-left transition hover:border-accent/50">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{s.title}</span>
                <ArrowRight size={14} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
              </div>
              <div className="mt-0.5 text-xs text-muted">{s.blurb}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The slip beside the legs so every read can be checked. Phones: a strip, tap to see it whole. */
function SlipPhoto({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen(!open)} aria-label={open ? "Shrink slip photo" : "Show whole slip photo"} className="shrink-0 self-start lg:sticky lg:top-24 lg:w-72 lg:cursor-default">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Your slip"
        className={clsx("w-full rounded-xl border border-line object-cover object-top lg:max-h-[70vh] lg:object-contain", open ? "max-h-none" : "max-h-24")}
      />
      <span className="mt-1 block text-xs text-muted lg:hidden">{open ? "Tap to shrink" : "Tap to see the whole slip"}</span>
    </button>
  );
}

function ParsingState({ preview }: { preview: string | null }) {
  return (
    <div className="glass flex flex-col items-center gap-5 rounded-3xl px-6 py-12">
      {preview && (
        <div className="relative overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="max-h-64 object-contain opacity-70" />
          <div className="scan absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-accent/30 to-transparent" />
        </div>
      )}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 size={16} className="animate-spin text-accent" /> Reading your slip…
      </div>
    </div>
  );
}
