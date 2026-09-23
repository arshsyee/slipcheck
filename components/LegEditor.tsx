"use client";

import { Plus, Trash2 } from "lucide-react";
import { MARKETS, SPORTS, type Leg, type Slip } from "@/lib/types";

const input =
  "w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm outline-none transition focus:border-accent";

const MARKET_LABEL: Record<Leg["market"], string> = {
  moneyline: "Moneyline",
  spread: "Spread",
  total: "Total",
  player_prop: "Player prop",
  other: "Other",
};

export const EMPTY_LEG: Leg = {
  sport: "NFL",
  awayTeam: "",
  homeTeam: "",
  market: "moneyline",
  selection: "",
  line: null,
  oddsAmerican: null,
};

/** Editable view of the parsed slip so users can fix anything the AI misread. */
export function LegEditor({ slip, onChange }: { slip: Slip; onChange: (s: Slip) => void }) {
  const setLeg = (i: number, patch: Partial<Leg>) =>
    onChange({ ...slip, legs: slip.legs.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const num = (v: string) => (v.trim() === "" || isNaN(Number(v)) ? null : Number(v));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Sportsbook">
          <input className={input} value={slip.sportsbook ?? ""} onChange={(e) => onChange({ ...slip, sportsbook: e.target.value || null })} />
        </Field>
        <Field label="Stake ($)">
          <input className={input + " tabular"} type="number" min={0} step="any" value={slip.stake ?? ""} onChange={(e) => onChange({ ...slip, stake: num(e.target.value) })} />
        </Field>
        <Field label="Slip odds">
          <input className={input + " tabular"} type="number" placeholder="e.g. 264" value={slip.totalOddsAmerican ?? ""} onChange={(e) => onChange({ ...slip, totalOddsAmerican: num(e.target.value) })} />
        </Field>
        <Field label="Bet type">
          <div className={input + " capitalize text-muted"}>{slip.legs.length > 1 ? "parlay" : "single"}</div>
        </Field>
      </div>

      <div className="space-y-2">
        {slip.legs.map((leg, i) => (
          <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-line bg-surface/60 p-3 md:grid-cols-4 xl:grid-cols-[90px_1fr_1fr_120px_1fr_80px_80px_32px]">
            <Field label="Sport">
              <select className={input} value={leg.sport} onChange={(e) => setLeg(i, { sport: e.target.value as Leg["sport"] })}>
                {SPORTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Away">
              <input className={input} value={leg.awayTeam ?? ""} onChange={(e) => setLeg(i, { awayTeam: e.target.value || null })} />
            </Field>
            <Field label="Home">
              <input className={input} value={leg.homeTeam ?? ""} onChange={(e) => setLeg(i, { homeTeam: e.target.value || null })} />
            </Field>
            <Field label="Market">
              <select className={input} value={leg.market} onChange={(e) => setLeg(i, { market: e.target.value as Leg["market"] })}>
                {MARKETS.map((m) => (
                  <option key={m} value={m}>
                    {MARKET_LABEL[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pick">
              <input className={input} value={leg.selection} placeholder={leg.market === "total" ? "Over / Under" : "Team"} onChange={(e) => setLeg(i, { selection: e.target.value })} />
            </Field>
            <Field label="Line">
              <input className={input + " tabular"} type="number" step="0.5" disabled={leg.market === "moneyline"} value={leg.line ?? ""} onChange={(e) => setLeg(i, { line: num(e.target.value) })} />
            </Field>
            <Field label="Odds">
              <input className={input + " tabular"} type="number" value={leg.oddsAmerican ?? ""} onChange={(e) => setLeg(i, { oddsAmerican: num(e.target.value) })} />
            </Field>
            <button
              onClick={() => onChange({ ...slip, legs: slip.legs.filter((_, j) => j !== i) })}
              className="grid h-8 w-8 place-items-center justify-self-end rounded-md text-muted transition hover:bg-danger/10 hover:text-danger"
              aria-label="Remove leg"
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
        <Plus size={15} /> Add leg
      </button>
    </div>
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
