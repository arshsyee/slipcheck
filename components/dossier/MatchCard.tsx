"use client";

import { Fragment, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CalendarClock, CheckCircle2, CloudRain, Crosshair, MapPin, Sun, Cloud, Wind, XCircle } from "lucide-react";
import type { DossierTab, MatchDossier } from "@/lib/dossier/types";
import type { OddsFormat } from "@/lib/types";
import { SOURCES, type SourceId } from "@/lib/sources/types";
import { MARKET_LABEL } from "@/lib/leagues";
import { formatOdds } from "@/lib/odds/convert";
import { Crest, kickoffLabel, timeAgo } from "./bits";
import { AvailabilityTab, ClubTab, FormTab, H2HTab, MatchCentreTab, NewsTab, RefereeTab, SquadTab, StatsTab } from "./tabs";

const TABS: { id: DossierTab; label: string }[] = [
  { id: "form", label: "Form" },
  { id: "stats", label: "Stats" },
  { id: "h2h", label: "Head-to-head" },
  { id: "availability", label: "Availability" },
  { id: "squad", label: "Squad" },
  { id: "referee", label: "Referee" },
  { id: "matchCentre", label: "Match centre" },
  { id: "news", label: "News" },
  { id: "club", label: "Club" },
];

export function MatchCard({ d, oddsFormat }: { d: MatchDossier; oddsFormat: OddsFormat }) {
  const [tab, setTab] = useState<DossierTab>(d.pick.primaryTab);
  const TabBody = { form: FormTab, stats: StatsTab, h2h: H2HTab, availability: AvailabilityTab, squad: SquadTab, referee: RefereeTab, matchCentre: MatchCentreTab, news: NewsTab, club: ClubTab }[tab];
  const pick = d.pick.pickSide;

  return (
    <article id={`leg-${d.legIndex}`} className="rise glass scroll-mt-48 overflow-hidden rounded-2xl">
      {/* Header */}
      <div className="border-b border-line/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span className="flex items-center gap-2">
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-medium text-fg">Leg {d.legIndex + 1}</span>
            {d.league.label}
            {d.fixture.round && ` · ${d.fixture.round}`}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <CalendarClock size={13} /> {kickoffLabel(d.fixture.kickoff)}
            </span>
            {d.fixture.venue && (
              <span className="flex items-center gap-1">
                <MapPin size={13} /> {d.fixture.venue}
                {d.fixture.city && `, ${d.fixture.city}`}
              </span>
            )}
            <Weather d={d} />
          </span>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamSide d={d} side="home" highlighted={pick === "home" || pick === "both"} />
          <span className="text-sm font-medium text-muted">v</span>
          <TeamSide d={d} side="away" highlighted={pick === "away" || pick === "both"} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-accent">
            {MARKET_LABEL[d.leg.market]}: <b className="font-semibold">{d.leg.selection}</b>
            {d.leg.line != null && ` ${d.leg.market === "asian_handicap" && d.leg.line > 0 ? "+" : ""}${d.leg.line}`}
          </span>
          {d.leg.oddsDecimal && <span className="tabular rounded-full bg-surface-2 px-3 py-1 text-muted">@ {formatOdds(d.leg.oddsDecimal, oddsFormat)} on your slip · implies {Math.round((1 / d.leg.oddsDecimal) * 100)}%</span>}
          {d.fixture.referee && <span className="rounded-full bg-surface-2 px-3 py-1 text-muted">Referee: {d.fixture.referee}</span>}
          {!d.fixture.found && (
            <span className="flex items-center gap-1 rounded-full bg-warn/10 px-3 py-1 text-warn">
              <AlertTriangle size={13} /> Fixture not found in any schedule: check the teams
            </span>
          )}
        </div>
        {d.fixture.conflicts.map((c) => (
          <p key={c} className="mt-2 flex items-center gap-1.5 text-xs text-warn">
            <AlertTriangle size={12} /> {c}
          </p>
        ))}
      </div>

      {/* Pick focus */}
      <div className="border-b border-line/70 bg-accent/[0.04] px-5 py-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-accent">
          <Crosshair size={13} /> What matters for this pick
        </div>
        {d.pick.stats.length > 0 ? (
          <table className="tabular mb-3 w-full text-sm">
            <tbody>
              {d.pick.stats.map((r, i) => (
                <Fragment key={i}>
                  {r.group !== d.pick.stats[i - 1]?.group && (
                    <tr>
                      <th className="pt-2 pb-1 text-left text-xs font-normal text-muted">{r.group}</th>
                      <th className="pt-2 pb-1 text-right text-xs font-medium">{d.home.name}</th>
                      <th className="pt-2 pb-1 text-right text-xs font-medium">{d.away.name}</th>
                    </tr>
                  )}
                  <tr className="border-t border-line/40">
                    <td className="py-1 pr-2 text-muted">{r.label}</td>
                    <td className="whitespace-nowrap py-1 text-right">{r.home === "—" ? <NoSource /> : r.home}</td>
                    <td className="whitespace-nowrap py-1 pl-3 text-right">{r.away === "—" ? <NoSource /> : r.away}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mb-2 text-sm text-danger">Comparison N/A · no free source has these teams.</p>
        )}
        {d.pick.bullets.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {d.pick.bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-line/70 px-2">
        <div role="tablist" className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                "whitespace-nowrap border-b-2 px-3 py-3 text-sm transition",
                tab === t.id ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" className="p-5">
        <TabBody d={d} />
      </div>

      <SourcesFooter d={d} />
    </article>
  );
}

function TeamSide({ d, side, highlighted }: { d: MatchDossier; side: "home" | "away"; highlighted: boolean }) {
  const t = d[side];
  const st = t.standing?.ok ? t.standing.data : null;
  const form = t.stats.ok ? t.stats.data?.overall.form5.games : null;
  return (
    <div className={clsx("flex min-w-0 items-center gap-3", side === "away" && "flex-row-reverse text-right")}>
      <div className={clsx("rounded-full p-1", highlighted && "ring-2 ring-accent/60")}>
        <Crest src={t.badge} name={t.name} size={48} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-lg font-semibold leading-tight">{t.name}</div>
        <div className="text-xs text-muted">{st ? `${ordinal(st.rank)} · ${st.points} pts` : " "}</div>
        {form && form.length > 0 && (
          <div className={clsx("mt-1 flex gap-0.5", side === "away" && "justify-end")}>
            {[...form].reverse().map((g, i) => (
              <span
                key={i}
                title={`${g.result} ${g.gf}-${g.ga} vs ${g.opponent}`}
                className={clsx(
                  "grid h-4 w-4 place-items-center rounded-sm text-[9px] font-bold",
                  g.result === "W" ? "bg-win/80 text-bg" : g.result === "L" ? "bg-danger/80 text-bg" : "bg-muted/40 text-fg",
                )}
              >
                {g.result}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Weather({ d }: { d: MatchDossier }) {
  if (!d.weather?.ok || !d.weather.data) return null;
  const w = d.weather.data;
  const Icon = /rain|drizzle|shower|thunder/i.test(w.summary) ? CloudRain : /clear/i.test(w.summary) ? Sun : Cloud;
  return (
    <span className="flex items-center gap-1" title={`Forecast for kick-off (Open-Meteo)${w.precipProbability != null ? `, ${w.precipProbability}% chance of rain` : ""}`}>
      <Icon size={13} /> {w.summary}, {w.tempC}°C
      {w.windKmh >= 25 && (
        <span className="flex items-center gap-0.5 text-warn">
          <Wind size={12} /> {w.windKmh} km/h
        </span>
      )}
    </span>
  );
}

function SourcesFooter({ d }: { d: MatchDossier }) {
  // One row per source: ok if any call to it succeeded.
  const bySource = new Map<SourceId, { ok: boolean; at: string; errors: string[] }>();
  for (const s of d.sourceLog) {
    const cur = bySource.get(s.source) ?? { ok: false, at: s.fetchedAt, errors: [] };
    cur.ok ||= s.ok;
    if (!s.ok && s.error) cur.errors.push(s.error);
    bySource.set(s.source, cur);
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/70 bg-surface/40 px-5 py-3 text-[11px] text-muted">
      <span className="uppercase tracking-wider">Sources</span>
      {[...bySource].map(([id, s]) => (
        <a
          key={id}
          href={SOURCES[id].homepage}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 hover:text-fg"
          title={s.ok ? `Fetched ${new Date(s.at).toLocaleString()}` : s.errors.join("\n")}
        >
          {s.ok ? <CheckCircle2 size={11} className="text-win" /> : <XCircle size={11} className="text-danger" />}
          {SOURCES[id].name}
        </a>
      ))}
      <span className="ml-auto">Built {timeAgo(d.builtAt)}</span>
    </div>
  );
}

function ordinal(i: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = i % 100;
  return `${i}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function MatchCardSkeleton({ index, home, away }: { index: number; home: string | null; away: string | null }) {
  return (
    <div className="glass animate-pulse rounded-2xl p-5">
      <div className="text-xs text-muted">Leg {index + 1} · gathering data…</div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-surface-2" />
          <span className="text-lg font-semibold text-muted">{home ?? "?"}</span>
        </div>
        <span className="text-muted">v</span>
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-muted">{away ?? "?"}</span>
          <div className="h-12 w-12 rounded-full bg-surface-2" />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <div className="h-3 w-3/4 rounded bg-surface-2" />
        <div className="h-3 w-2/3 rounded bg-surface-2" />
        <div className="h-3 w-1/2 rounded bg-surface-2" />
      </div>
    </div>
  );
}

/** Shown wherever no free source has the value: honest, not blank. */
function NoSource() {
  return <span className="text-xs text-danger">N/A · no free source</span>;
}
