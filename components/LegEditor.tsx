"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { MARKETS, type Leg, type OddsFormat, type Slip } from "@/lib/types";
import { LEAGUE_INFO, MARKET_LABEL } from "@/lib/leagues";
import { formatOdds, parseOdds } from "@/lib/odds/convert";

const input =
  "w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm outline-none transition focus:border-accent disabled:opacity-40";

export const EMPTY_LEG: Leg = {
  league: "EPL",
  homeTeam: "",
  awayTeam: "",
  market: "1x2",
  selection: "",
  line: null,
  oddsDecimal: null,
};

const HAS_LINE = new Set<Leg["market"]>(["total_goals", "asian_handicap"]);

const PICK_HINT: Record<Leg["market"], string> = {
  "1x2": "Team or Draw",
  double_chance: "Arsenal or Draw",
  draw_no_bet: "Team",
  total_goals: "Over / Under",
  asian_handicap: "Team",
  btts: "Yes / No",
  other: "As on the slip",
};

// League options grouped by country for the <select>.
const GROUPS = Object.entries(LEAGUE_INFO).reduce<Record<string, [string, string][]>>((acc, [id, l]) => {
  (acc[l.country] ??= []).push([id, l.label]);
  return acc;
}, {});

/** Editable view of the parsed slip so users can fix anything the AI misread. */
export function LegEditor({ slip, onChange, oddsFormat }: { slip: Slip; onChange: (s: Slip) => void; oddsFormat: OddsFormat }) {
  const setLeg = (i: number, patch: Partial<Leg>) =>
    onChange({ ...slip, legs: slip.legs.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const num = (v: string) => (v.trim() === "" || isNaN(Number(v)) ? null : Number(v));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {slip.legs.map((leg, i) => (
          <div
            key={i}
            className="grid grid-cols-2 items-end gap-2 rounded-xl border border-line bg-surface/60 p-3 md:grid-cols-4 xl:grid-cols-[150px_1fr_1fr_150px_1fr_72px_80px_32px]"
          >
            <Field label="Competition">
              <select className={input} value={leg.league} onChange={(e) => setLeg(i, { league: e.target.value as Leg["league"] })}>
                {Object.entries(GROUPS).map(([country, leagues]) => (
                  <optgroup key={country} label={country}>
                    {leagues.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Home">
              <input className={input} value={leg.homeTeam ?? ""} onChange={(e) => setLeg(i, { homeTeam: e.target.value || null })} />
            </Field>
            <Field label="Away">
              <input className={input} value={leg.awayTeam ?? ""} onChange={(e) => setLeg(i, { awayTeam: e.target.value || null })} />
            </Field>
            <Field label="Market">
              <select
                className={input}
                value={leg.market}
                onChange={(e) => {
                  const market = e.target.value as Leg["market"];
                  setLeg(i, { market, line: HAS_LINE.has(market) ? (leg.line ?? (market === "total_goals" ? 2.5 : 0)) : null });
                }}
              >
                {MARKETS.map((m) => (
                  <option key={m} value={m}>
                    {MARKET_LABEL[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pick">
              <input className={input} value={leg.selection} placeholder={PICK_HINT[leg.market]} onChange={(e) => setLeg(i, { selection: e.target.value })} />
            </Field>
            <Field label="Line">
              <input
                className={input + " tabular"}
                type="number"
                step="0.25"
                disabled={!HAS_LINE.has(leg.market)}
                value={leg.line ?? ""}
                onChange={(e) => setLeg(i, { line: num(e.target.value) })}
              />
            </Field>
            <Field label="Odds">
              <OddsInput key={`leg-${i}-${leg.oddsDecimal}`} value={leg.oddsDecimal} format={oddsFormat} onChange={(v) => setLeg(i, { oddsDecimal: v })} />
            </Field>
            <button
              onClick={() => onChange({ ...slip, legs: slip.legs.filter((_, j) => j !== i) })}
              className="grid h-8 w-8 place-items-center justify-self-end rounded-md text-muted transition hover:bg-danger/10 hover:text-danger"
              aria-label={`Remove leg ${i + 1}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => onChange({ ...slip, legs: [...slip.legs, { ...EMPTY_LEG }] })}
        className="flex items-center gap-1.5 text-sm text-muted transition hover:text-accent"
      >
        <Plus size={15} /> Add selection
      </button>
    </div>
  );
}

/** Text box that accepts 6/4, 2.5 or +150 and stores decimal odds; commits on blur. Remounted (via key) when the value changes elsewhere. */
function OddsInput({ value, format, onChange }: { value: number | null; format: OddsFormat; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value != null ? formatOdds(value, format) : "");
  const invalid = text.trim() !== "" && parseOdds(text) == null;
  return (
    <input
      className={clsx(input, "tabular", invalid && "border-danger")}
      value={text}
      placeholder={format === "fractional" ? "6/4" : "2.50"}
      title="Fractional (6/4), decimal (2.5) or American (+150)"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(parseOdds(text))}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}
