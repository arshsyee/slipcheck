"use client";

import { useState } from "react";
import { AlertTriangle, Minus, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { MARKETS, type Leg, type OddsFormat, type Slip } from "@/lib/types";
import { DEFAULT_LINE, HAS_LINE, LEAGUE_INFO, MARKET_LABEL, legProblems, pickOptions } from "@/lib/leagues";
import { formatOdds, parseOdds } from "@/lib/odds/convert";

const input =
  "rounded-md border border-line bg-surface px-2 py-1.5 text-sm outline-none transition focus:border-accent";

// League options grouped by country for the <select>.
const GROUPS = Object.entries(LEAGUE_INFO).reduce<Record<string, [string, string][]>>((acc, [id, l]) => {
  (acc[l.country] ??= []).push([id, l.label]);
  return acc;
}, {});

/** Review of the parsed slip: one card per leg, picks as buttons, anything missing outlined in amber. */
// onChange takes an updater: an odds box saving on blur and a button click land in the same tick, and must not overwrite each other.
export function LegEditor({ slip, onChange, oddsFormat }: { slip: Slip; onChange: (update: (s: Slip) => Slip) => void; oddsFormat: OddsFormat }) {
  const setLeg = (i: number, patch: Partial<Leg>) =>
    onChange((s) => ({ ...s, legs: s.legs.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  return (
    <div className="space-y-2">
      {slip.legs.map((leg, i) => {
        const home = leg.homeTeam ?? "";
        const away = leg.awayTeam ?? "";
        const opts = pickOptions(leg.market, home || "Home", away || "Away");
        const problems = legProblems(leg);
        const step = leg.market === "asian_handicap" ? 0.25 : 1;
        return (
          <div key={i} className={clsx("space-y-3 rounded-xl border bg-surface/60 p-3", problems.length ? "border-warn/60" : "border-line")}>
            <div className="flex items-center gap-2">
              <input className={clsx(input, "w-full min-w-0 font-medium")} value={home} placeholder="Home team" aria-label="Home team" onChange={(e) => setLeg(i, { homeTeam: e.target.value || null })} />
              <span className="text-sm text-muted">v</span>
              <input className={clsx(input, "w-full min-w-0 font-medium")} value={away} placeholder="Away team" aria-label="Away team" onChange={(e) => setLeg(i, { awayTeam: e.target.value || null })} />
              <button
                onClick={() => onChange((s) => ({ ...s, legs: s.legs.filter((_, j) => j !== i) }))}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition hover:bg-danger/10 hover:text-danger"
                aria-label={`Remove leg ${i + 1}`}
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <select className={clsx(input, "w-auto")} aria-label="Competition" value={leg.league} onChange={(e) => setLeg(i, { league: e.target.value as Leg["league"] })}>
                {Object.entries(GROUPS).map(([country, leagues]) => (
                  <optgroup key={country} label={country}>
                    {leagues.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="OTHER">Other or national teams</option>
              </select>
              <select
                className={clsx(input, "w-auto")}
                aria-label="Market"
                value={leg.market}
                onChange={(e) => {
                  const market = e.target.value as Leg["market"];
                  setLeg(i, { market, selection: "", line: HAS_LINE.has(market) ? (DEFAULT_LINE[market] ?? 0) : null });
                }}
              >
                {MARKETS.map((m) => (
                  <option key={m} value={m}>
                    {MARKET_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {opts ? (
                opts.map((o) => {
                  const on = o.toLowerCase() === leg.selection.trim().toLowerCase();
                  return (
                    <button
                      key={o}
                      aria-pressed={on}
                      onClick={() => setLeg(i, { selection: o })}
                      className={clsx(
                        "rounded-md border px-3 py-1.5 text-sm transition",
                        on ? "border-accent/60 bg-accent/15 text-accent" : "border-line text-muted hover:text-fg",
                      )}
                    >
                      {o}
                    </button>
                  );
                })
              ) : (
                <input className={clsx(input, "w-full max-w-64")} value={leg.selection} placeholder="The pick, as on the slip" aria-label="Pick" onChange={(e) => setLeg(i, { selection: e.target.value })} />
              )}
              {HAS_LINE.has(leg.market) && (
                <span className="tabular flex items-center rounded-md border border-line">
                  <button className="grid h-8 w-7 place-items-center text-muted hover:text-fg" aria-label="Lower line" onClick={() => setLeg(i, { line: (leg.line ?? 0) - step })}>
                    <Minus size={13} />
                  </button>
                  <span className="min-w-10 text-center text-sm">{leg.line != null && leg.market === "asian_handicap" && leg.line > 0 ? "+" : ""}{leg.line ?? "—"}</span>
                  <button className="grid h-8 w-7 place-items-center text-muted hover:text-fg" aria-label="Raise line" onClick={() => setLeg(i, { line: (leg.line ?? 0) + step })}>
                    <Plus size={13} />
                  </button>
                </span>
              )}
              <span className="ml-auto flex items-center gap-1.5 text-sm text-muted">
                @ <OddsInput key={`leg-${i}-${leg.oddsDecimal}`} value={leg.oddsDecimal} format={oddsFormat} onChange={(v) => setLeg(i, { oddsDecimal: v })} />
              </span>
            </div>

            {problems.length > 0 && (
              <ul className="space-y-0.5 text-xs text-warn">
                {problems.map((p) => (
                  <li key={p} className="flex items-center gap-1.5">
                    <AlertTriangle size={12} /> {p}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Text box that accepts 6/4 or 2.5 and stores decimal odds; commits on blur. Remounted (via key) when the value changes elsewhere. */
function OddsInput({ value, format, onChange }: { value: number | null; format: OddsFormat; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value != null ? formatOdds(value, format) : "");
  const invalid = text.trim() !== "" && parseOdds(text) == null;
  return (
    <input
      className={clsx(input, "tabular w-20", invalid && "border-danger", value == null && !invalid && "border-warn/60")}
      value={text}
      placeholder="odds?"
      aria-label="Odds"
      title="Fractional (6/4) or decimal (2.5)"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(parseOdds(text))}
    />
  );
}
