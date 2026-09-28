"use client";

import { useState } from "react";
import clsx from "clsx";
import { ExternalLink, Newspaper, ShieldAlert, Users } from "lucide-react";
import type { MatchDossier, StatBlock, TeamSection } from "@/lib/dossier/types";
import type { Headline } from "@/lib/sources/news";
import { CompareRow, Crest, ResultChip, SectionTitle, SourceTag, Unavailable, fix, kickoffLabel, pct, timeAgo } from "./bits";

type Props = { d: MatchDossier };

const statsOf = (t: TeamSection) => (t.stats.ok ? t.stats.data : null);

// ---------------- Form ----------------

export function FormTab({ d }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[d.home, d.away].map((t) => {
        const s = statsOf(t);
        return (
          <div key={t.side} className="space-y-3 rounded-xl border border-line bg-surface/50 p-4">
            <TeamHeading t={t} />
            {!s ? (
              <Unavailable result={t.stats}>No league results found for {t.name}.</Unavailable>
            ) : (
              <>
                <FormLine label="League · last 5" block={s.overall} n={5} />
                <FormLine label={t.side === "home" ? "League · last 5 at home" : "League · last 5 away"} block={s.venue} n={5} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Mini label="Last 10" value={`${s.overall.form10.won}-${s.overall.form10.drawn}-${s.overall.form10.lost}`} sub="W-D-L" />
                  <Mini label="Points (10)" value={String(s.overall.form10.points)} sub={`of ${s.overall.form10.games.length * 3}`} />
                  <Mini label="Goals (10)" value={`${s.overall.form10.goalsFor}:${s.overall.form10.goalsAgainst}`} sub="for:against" />
                </div>
              </>
            )}
            <SeasonRuns t={t} />
            {t.lastMatch && (
              <p className="text-xs text-muted">
                Last played {t.lastMatch.opponent} ({t.lastMatch.score}, {t.lastMatch.competition}) ·{" "}
                <span className={clsx(t.restDays != null && t.restDays <= 3 && "font-medium text-warn")}>
                  {t.restDays} days&apos; rest
                </span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormLine({ label, block, n }: { label: string; block: StatBlock; n: number }) {
  const games = n === 5 ? block.form5.games : block.form10.games;
  return (
    <div>
      <SectionTitle>{label}</SectionTitle>
      {games.length ? (
        <div className="flex flex-wrap gap-1.5">
          {games.map((g, i) => (
            <ResultChip key={i} game={g} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">No games yet this season.</p>
      )}
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-surface-2/60 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="tabular text-lg font-semibold">{value}</div>
      {sub && <div className="text-[10px] text-muted">{sub}</div>}
    </div>
  );
}

export function TeamHeading({ t }: { t: TeamSection }) {
  const st = t.standing?.ok ? t.standing.data : null;
  return (
    <div className="flex items-center gap-2.5">
      <Crest src={t.badge} name={t.name} size={28} />
      <div className="min-w-0">
        <div className="truncate font-medium">{t.name}</div>
        <div className="text-xs text-muted">
          {t.side === "home" ? "Home" : "Away"}
          {st && ` · ${ordinal(st.rank)} · ${st.points} pts · GD ${st.goalDiff > 0 ? "+" : ""}${st.goalDiff}`}
        </div>
      </div>
    </div>
  );
}

// ---------------- Stats ----------------

export function StatsTab({ d }: Props) {
  const [scope, setScope] = useState<"venue" | "overall">("venue");
  const hs = statsOf(d.home);
  const as = statsOf(d.away);
  if (!hs || !as) return <Unavailable result={!hs ? d.home.stats : d.away.stats}>Season stats aren&apos;t available for both clubs.</Unavailable>;
  const h = hs[scope];
  const a = as[scope];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legend d={d} />
        <div className="flex rounded-lg border border-line p-0.5 text-xs">
          {(["venue", "overall"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={clsx("rounded-md px-2.5 py-1 transition", scope === s ? "bg-surface-2 text-fg" : "text-muted hover:text-fg")}
            >
              {s === "venue" ? "Home / away only" : "All games"}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted">
        Per game, this season · {d.home.name} {h.averages.played} games, {d.away.name} {a.averages.played} games
      </p>
      <div className="grid gap-x-8 md:grid-cols-2">
        <div>
          <SectionTitle>Goals &amp; chances</SectionTitle>
          <CompareRow label="Goals for" home={h.averages.goalsFor} away={a.averages.goalsFor} />
          <CompareRow label="Goals against" home={h.averages.goalsAgainst} away={a.averages.goalsAgainst} better="lower" />
          <CompareRow label="xG for" home={h.averages.xgFor} away={a.averages.xgFor} />
          <CompareRow label="xG against" home={h.averages.xgAgainst} away={a.averages.xgAgainst} better="lower" />
          <CompareRow label="Shots" home={h.averages.shots} away={a.averages.shots} format={(v) => fix(v, 1)} />
          <CompareRow label="On target" home={h.averages.shotsOnTarget} away={a.averages.shotsOnTarget} format={(v) => fix(v, 1)} />
          <CompareRow label="Corners" home={h.averages.corners} away={a.averages.corners} format={(v) => fix(v, 1)} />
          <CompareRow label="Yellow cards" home={h.averages.yellows} away={a.averages.yellows} format={(v) => fix(v, 1)} better="none" />
        </div>
        <div>
          <SectionTitle>How their games go</SectionTitle>
          <CompareRow label="Both teams scored" home={h.rates.btts} away={a.rates.btts} format={pct} better="none" />
          <CompareRow label="Over 1.5 goals" home={h.rates.over15} away={a.rates.over15} format={pct} better="none" />
          <CompareRow label="Over 2.5 goals" home={h.rates.over25} away={a.rates.over25} format={pct} better="none" />
          <CompareRow label="Over 3.5 goals" home={h.rates.over35} away={a.rates.over35} format={pct} better="none" />
          <CompareRow label="Clean sheets" home={h.rates.cleanSheets} away={a.rates.cleanSheets} format={pct} />
          <CompareRow label="Failed to score" home={h.rates.failedToScore} away={a.rates.failedToScore} format={pct} better="lower" />
          <CompareRow label="Scored in 1st half" home={h.rates.scoredFirstHalf} away={a.rates.scoredFirstHalf} format={pct} />
          <Margins d={d} scope={scope} />
        </div>
      </div>
    </div>
  );
}

function Margins({ d, scope }: { d: MatchDossier; scope: "venue" | "overall" }) {
  const rows = [
    ["Won by 2+", "ge_p2"],
    ["Won by 1", "p1"],
    ["Drew", "zero"],
    ["Lost by 1", "m1"],
    ["Lost by 2+", "le_m2"],
  ] as const;
  return (
    <div className="mt-3">
      <SectionTitle>Result margins</SectionTitle>
      <div className="grid grid-cols-5 gap-1 text-center text-[11px]">
        {rows.map(([label, key]) => (
          <div key={key} className="rounded-md bg-surface-2/60 px-1 py-1.5">
            <div className="text-muted">{label}</div>
            <div className="tabular mt-0.5">
              <span className="text-home">{statsOf(d.home)?.[scope].rates.margins[key] ?? "—"}</span>
              <span className="text-muted"> · </span>
              <span className="text-away">{statsOf(d.away)?.[scope].rates.margins[key] ?? "—"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ d }: Props) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex items-center gap-1.5">
        <i className="h-2 w-2 rounded-full bg-home" /> {d.home.name}
      </span>
      <span className="flex items-center gap-1.5">
        <i className="h-2 w-2 rounded-full bg-away" /> {d.away.name}
      </span>
    </div>
  );
}

// ---------------- Head-to-head ----------------

/** Head-to-head in three groups: league, Europe, domestic cups. */
export function H2HTab({ d }: Props) {
  const intl = d.league.country === "International";
  if (intl) return <LeagueH2H d={d} />;
  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>League</SectionTitle>
        <LeagueH2H d={d} />
      </div>
      <div>
        <SectionTitle>Champions League / Europe · last 5 seasons</SectionTitle>
        <Meetings result={d.h2hEurope} empty="No meetings in UEFA competitions in the last 5 seasons." />
      </div>
      <div>
        <SectionTitle>Domestic cups · last 5 seasons</SectionTitle>
        {d.h2hCups ? <Meetings result={d.h2hCups} empty="No cup meetings in the last 5 seasons." /> : <p className="text-xs text-muted">Clubs from different countries don&apos;t meet in domestic cups.</p>}
      </div>
    </div>
  );
}

function Meetings({ result, empty }: { result: MatchDossier["h2hEurope"]; empty: string }) {
  if (!result) return <p className="text-xs text-muted">{empty}</p>;
  if (!result.ok) return <Unavailable result={result} />;
  if (!result.data.length) return <p className="text-xs text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line/60 rounded-xl border border-line">
      {result.data.map((m, i) => (
        <li key={i} className="grid grid-cols-[88px_1fr_auto_1fr] items-center gap-2 px-3 py-2 text-sm">
          <span className="text-xs text-muted">{new Date(m.kickoff).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" })}</span>
          <span className="truncate text-right">{m.home}</span>
          <span className="tabular rounded-md bg-surface-2 px-2 py-0.5 font-medium">
            {m.homeGoals}–{m.awayGoals}
          </span>
          <span className="truncate">{m.away}</span>
          <span className="col-span-4 -mt-1 text-right text-[11px] text-muted">{m.competition}</span>
        </li>
      ))}
    </ul>
  );
}

/** This season outside the league: Europe and domestic cups, each its own section. */
function SeasonRuns({ t }: { t: TeamSection }) {
  const runs = t.season.ok ? (t.season.data?.otherCompetitions ?? []) : [];
  const groups = [
    { title: "Champions League / Europe · this season", runs: runs.filter((r) => /uefa/i.test(r.competition)), empty: "No European games played this season." },
    { title: "Domestic cups · this season", runs: runs.filter((r) => !/uefa/i.test(r.competition)), empty: "No cup games played this season." },
  ];
  return (
    <>
      {groups.map((g) => (
        <div key={g.title}>
          <SectionTitle>{g.title}</SectionTitle>
          {g.runs.length ? (
            <ul className="space-y-1 text-xs">
              {g.runs.flatMap((r) =>
                r.results.map((x, i) => (
                  <li key={`${r.competition}${i}`} className="flex items-center gap-2">
                    <span className={clsx("w-5 shrink-0 rounded text-center font-semibold", x.result === "W" ? "bg-win/15 text-win" : x.result === "L" ? "bg-danger/15 text-danger" : "bg-surface-2")}>{x.result}</span>
                    <span className="tabular">{x.score}</span>
                    <span className="truncate">{x.venue === "home" ? "v" : "@"} {x.opponent}</span>
                    <span className="ml-auto shrink-0 text-muted">{r.competition} · {new Date(x.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                  </li>
                )),
              )}
            </ul>
          ) : (
            <p className="text-xs text-muted">{g.empty}</p>
          )}
        </div>
      ))}
    </>
  );
}

function LeagueH2H({ d }: Props) {
  if (!d.h2h) return <p className="text-xs text-muted">No league meetings: the clubs play in different leagues.</p>;
  if (!d.h2h.ok) return <Unavailable result={d.h2h} />;
  const h = d.h2h.data;
  const intl = d.league.country === "International";
  if (!h.meetings.length) return <Unavailable>{intl ? "These two teams have never met." : "No league meetings in the last five seasons."}</Unavailable>;
  const total = h.meetings.length;
  const friendlies = intl ? h.meetings.filter((m) => /friendly/i.test(m.competition)).length : 0;
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex justify-between text-xs">
          <span className="text-home">
            {d.home.name} {h.aWins}
          </span>
          <span className="text-muted">Draws {h.draws}</span>
          <span className="text-away">
            {h.bWins} {d.away.name}
          </span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="bg-home" style={{ width: `${(h.aWins / total) * 100}%` }} />
          <div className="bg-muted/50" style={{ width: `${(h.draws / total) * 100}%` }} />
          <div className="bg-away" style={{ width: `${(h.bWins / total) * 100}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">
          Last {total} {intl ? "meetings" : "league meetings"} · avg {fix(h.avgGoals, 1)} goals · both scored {h.btts}/{total} · over 2.5 {h.over25}/{total}
          {friendlies > 0 && ` · ${friendlies} of the ${total} were friendlies`}
        </p>
      </div>
      <ul className="divide-y divide-line/60 rounded-xl border border-line">
        {h.meetings.map((m, i) => (
          <li key={i} className="grid grid-cols-[88px_1fr_auto_1fr] items-center gap-2 px-3 py-2 text-sm">
            <span className="text-xs text-muted">{new Date(m.kickoff).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" })}</span>
            <span className="truncate text-right">{m.home}</span>
            <span className="tabular rounded-md bg-surface-2 px-2 py-0.5 font-medium">
              {m.homeGoals}–{m.awayGoals}
            </span>
            <span className="truncate">{m.away}</span>
            {intl && <span className="col-span-4 -mt-1 text-right text-[11px] text-muted">{m.competition}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------- Availability ----------------

export function AvailabilityTab({ d }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[d.home, d.away].map((t) => (
        <div key={t.side} className="space-y-3 rounded-xl border border-line bg-surface/50 p-4">
          <TeamHeading t={t} />
          {!t.availability.ok ? (
            <Unavailable result={t.availability} />
          ) : t.availability.data.kind === "official" ? (
            t.availability.data.players.length === 0 ? (
              <p className="text-sm text-muted">No injuries or suspensions flagged.</p>
            ) : (
              <ul className="space-y-2">
                {t.availability.data.players.map((p, i) => (
                  <li key={i} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {p.player} <span className="text-xs text-muted">{p.position}</span>
                      </span>
                      <span className={clsx("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize", statusColor(p.status, p.chance))}>
                        {p.chance != null && p.status !== "suspended" ? `${p.chance}%` : p.status}
                      </span>
                    </div>
                    {p.news && <div className="text-xs text-muted">{p.news}</div>}
                  </li>
                ))}
              </ul>
            )
          ) : (
            <NewsAvailability headlines={t.availability.data.headlines} />
          )}
          <div className="text-right">
            <SourceTag source={t.availability.source} at={t.availability.fetchedAt} />
          </div>
        </div>
      ))}
    </div>
  );
}

function NewsAvailability({ headlines }: { headlines: Headline[] }) {
  return (
    <div className="space-y-2">
      <p className="flex items-start gap-1.5 rounded-lg bg-warn/10 px-2.5 py-2 text-xs text-warn">
        <ShieldAlert size={13} className="mt-0.5 shrink-0" />
        No official injury list is published for this league. These are recent injury and team-news headlines.
      </p>
      {headlines.length ? <HeadlineList items={headlines} /> : <p className="text-sm text-muted">No injury news in the last week.</p>}
    </div>
  );
}

function statusColor(status: string, chance: number | null) {
  if (status === "suspended" || status === "injured" || chance === 0) return "bg-danger/15 text-danger";
  if (chance != null && chance >= 75) return "bg-win/15 text-win";
  return "bg-warn/15 text-warn";
}

// ---------------- Squad ----------------

const POS = ["GK", "DEF", "MID", "FWD"] as const;
const NoFree = () => <span className="text-xs text-danger">N/A · no free source</span>;

export function SquadTab({ d }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[d.home, d.away].map((t) => (
        <div key={t.side} className="space-y-3 rounded-xl border border-line bg-surface/50 p-4">
          <TeamHeading t={t} />
          <SquadBody t={t} />
        </div>
      ))}
    </div>
  );
}

function SquadBody({ t }: { t: TeamSection }) {
  if (!t.squad) return <p className="text-sm">Squad: <NoFree /></p>;
  if (!t.squad.ok) return <Unavailable result={t.squad} />;
  const s = t.squad.data;
  if (!s) return <p className="text-sm">Squad: <NoFree /></p>;
  const outs = s.players.filter((p) => ["injured", "suspended", "unavailable"].includes(p.status) || p.chance === 0);
  const inNews = s.players.filter((p) => p.inNews);
  const L = s.likely;
  return (
    <div className="space-y-3 text-sm">
      {L && L.xi.length ? (
        <>
          <p className="text-xs text-muted">
            Likely XI <b className="text-fg">{L.shape}</b>: most starts in the last {L.window} league games, injured left out. Not an official lineup. “3/{L.window}” = started 3 of the last {L.window}.
          </p>
          {/* Pitch: forwards at the top, goalkeeper at the bottom. */}
          <div className="space-y-2 rounded-xl border border-win/20 bg-win/[0.06] p-3">
            {[...POS].reverse().map((pos) => (
              <div key={pos} className="flex flex-wrap justify-around gap-1.5">
                {L.xi.filter((p) => p.pos === pos).map((p) => (
                  <span key={p.name} className={clsx("rounded-md px-2 py-1 text-xs", p.status === "doubtful" ? "bg-warn/15 text-warn" : "bg-surface-2")}>
                    {p.name} <span className="tabular text-muted">{p.starts}/{L.window}</span>
                    {p.status === "doubtful" && p.chance != null && <span> · {p.chance}%</span>}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wider text-muted">Next in line</div>
            {POS.filter((pos) => L.backups[pos].length).map((pos) => (
              <div key={pos} className="flex gap-2 text-xs">
                <span className="w-9 shrink-0 text-muted">{pos}</span>
                <span>{L.backups[pos].map((p) => `${p.name} ${p.starts}/${L.window}`).join(" · ")}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-xs">
            Likely XI: <NoFree /> <span className="text-muted">· squad from Wikipedia{s.asOf && s.asOf.length < 25 ? `, updated ${s.asOf}` : ""}</span>
          </p>
          {s.asOf && s.asOf.length >= 25 && <p className="text-xs text-muted">{s.asOf}</p>}
          {POS.map((pos) => (
            <div key={pos} className="flex gap-2 text-xs">
              <span className="w-9 shrink-0 text-muted">{pos}</span>
              <span>
                {s.players
                  .filter((p) => p.pos === pos)
                  .map((p) => `${p.number ? `${p.number} ` : ""}${p.name}${p.caps != null ? ` (${p.caps} cap${p.caps === 1 ? "" : "s"})` : ""}`)
                  .join(" · ")}
              </span>
            </div>
          ))}
        </>
      )}

      <div className="space-y-1">
        <div className="text-xs font-medium uppercase tracking-wider text-muted">Out</div>
        {s.source === "fpl" ? (
          outs.length ? (
            outs.map((p) => (
              <div key={p.name} className="text-xs">
                <span className="text-danger">{p.name}</span> <span className="text-muted">{p.pos}, {p.status}</span>
                {p.note && <div className="text-muted">{p.note}</div>}
              </div>
            ))
          ) : (
            <p className="text-xs text-muted">Nobody flagged.</p>
          )
        ) : (
          s.outs?.length ? (
            s.outs.map((p) => (
              <div key={p.name} className="text-xs">
                <span className="text-danger">{p.name}</span> <span className="text-muted">{p.pos}, {p.note}{p.club ? ` · ${p.club}` : ""}</span>
              </div>
            ))
          ) : s.withdrawals ? (
            <p className="text-xs text-danger">{s.withdrawals}</p>
          ) : (
            <p className="text-xs">Official list: <NoFree /></p>
          )
        )}
      </div>

      {inNews.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wider text-warn">Named in injury news</div>
          {inNews.map((p) => (
            <div key={p.name} className="text-xs">
              {p.name} <span className="text-muted">({p.pos}): “{p.inNews!.title}” — {p.inNews!.publisher}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <div className="text-xs font-medium uppercase tracking-wider text-muted">Players to watch</div>
        {s.watch.length ? s.watch.map((w) => <p key={w} className="text-xs">{w}</p>) : <NoFree />}
      </div>
      <div className="text-right">
        <SourceTag source={t.squad.source} at={t.squad.fetchedAt} />
      </div>
    </div>
  );
}

// ---------------- Referee ----------------

export function RefereeTab({ d }: Props) {
  if (!d.fixture.referee) return <Unavailable>The referee hasn&apos;t been announced yet (usually a few days before kick-off).</Unavailable>;
  const r = d.referee?.ok ? d.referee.data : null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-lg font-medium">{d.fixture.referee}</div>
      {!d.referee ? (
        <Unavailable>Referee stats are only available for domestic league matches.</Unavailable>
      ) : !r ? (
        <Unavailable result={d.referee}>No games found for this referee in the league this season or last.</Unavailable>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Mini label="Games" value={String(r.games)} sub="this + last season" />
            <Mini label="Yellows" value={fix(r.yellowsPerGame, 1)} sub="per game" />
            <Mini label="Reds" value={fix(r.redsPerGame, 2)} sub="per game" />
            <Mini label="Fouls" value={fix(r.foulsPerGame, 1)} sub="per game" />
            <Mini label="Home wins" value={pct(r.homeWinRate)} sub={`over 2.5: ${pct(r.over25Rate)}`} />
          </div>
          <SourceTag source={d.referee.source} at={d.referee.fetchedAt} />
        </>
      )}
    </div>
  );
}

// ---------------- Match centre ----------------

export function MatchCentreTab({ d }: Props) {
  const lineups = d.lineups?.ok ? d.lineups.data : [];
  return (
    <div className="space-y-5">
      <div>
        <SectionTitle right={d.lineups?.ok && lineups.length ? <SourceTag source={d.lineups.source} at={d.lineups.fetchedAt} /> : undefined}>
          <span className="flex items-center gap-1.5">
            <Users size={12} /> Lineups
          </span>
        </SectionTitle>
        {lineups.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {lineups.map((l, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface/50 p-3">
                <div className="mb-2 flex items-center justify-between text-sm font-medium">
                  {l.team} {l.formation && <span className="text-xs text-muted">{l.formation}</span>}
                </div>
                <ol className="space-y-0.5 text-sm">
                  {l.starters.map((p, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="tabular w-6 text-right text-muted">{p.jersey}</span> {p.name}
                      <span className="text-xs text-muted">{p.position}</span>
                    </li>
                  ))}
                </ol>
                {l.subs.length > 0 && <p className="mt-2 text-xs text-muted">Subs: {l.subs.map((p) => p.name).join(", ")}</p>}
              </div>
            ))}
          </div>
        ) : (
          <Unavailable result={d.lineups?.ok ? null : d.lineups}>Lineups are published about an hour before kick-off.</Unavailable>
        )}
      </div>

      {(d.home.keyPlayers || d.away.keyPlayers) && (
        <div>
          <SectionTitle>Key attackers this season (xG + xA)</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {[d.home, d.away].map((t) => (
              <div key={t.side}>
                <div className="mb-1 text-xs text-muted">{t.name}</div>
                {t.keyPlayers?.ok ? (
                  <table className="w-full text-sm">
                    <tbody>
                      {t.keyPlayers.data.map((p, i) => (
                        <tr key={i} className="border-b border-line/50 last:border-0">
                          <td className="py-1">{p.player}</td>
                          <td className="tabular py-1 text-right text-muted">
                            {p.goals}G {p.assists}A
                          </td>
                          <td className="tabular py-1 text-right">
                            {fix(p.xg, 1)} xG · {fix(p.xa, 1)} xA
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <Unavailable result={t.keyPlayers} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(d.home.goalProfile || d.away.goalProfile) && (
        <div>
          <SectionTitle>Top scorers &amp; when goals come</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {[d.home, d.away].map((t) => {
              const g = t.goalProfile?.ok ? t.goalProfile.data : null;
              return (
                <div key={t.side}>
                  <div className="mb-1 text-xs text-muted">{t.name}</div>
                  {!g ? (
                    <Unavailable result={t.goalProfile} />
                  ) : (
                    <>
                      <p className="text-sm">{g.topScorers.map((s) => `${s.player} ${s.goals}`).join(" · ") || "No goals yet"}</p>
                      <GoalTiming scored={g.timing.scored} conceded={g.timing.conceded} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function GoalTiming({ scored, conceded }: { scored: number[]; conceded: number[] }) {
  const max = Math.max(1, ...scored, ...conceded);
  const labels = ["0'", "15'", "30'", "45'", "60'", "75'"];
  return (
    <div className="mt-2 grid grid-cols-6 items-end gap-1" aria-label="Goals scored and conceded by 15-minute period">
      {scored.map((s, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <div className="flex h-12 w-full items-end justify-center gap-0.5">
            <div className="w-2 rounded-t bg-win" style={{ height: `${(s / max) * 100}%` }} title={`${s} scored`} />
            <div className="w-2 rounded-t bg-danger/70" style={{ height: `${(conceded[i] / max) * 100}%` }} title={`${conceded[i]} conceded`} />
          </div>
          <span className="text-[10px] text-muted">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------- News ----------------

export function NewsTab({ d }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[d.home, d.away].map((t) => (
        <div key={t.side}>
          <SectionTitle>
            <span className="flex items-center gap-1.5">
              <Newspaper size={12} /> {t.name}
            </span>
          </SectionTitle>
          {t.news.ok ? t.news.data.length ? <HeadlineList items={t.news.data.slice(0, 8)} /> : <p className="text-sm text-muted">No recent headlines.</p> : <Unavailable result={t.news} />}
        </div>
      ))}
      {d.matchNews?.ok && d.matchNews.data.length > 0 && (
        <div className="md:col-span-2">
          <SectionTitle>League news (ESPN)</SectionTitle>
          <HeadlineList items={d.matchNews.data} />
        </div>
      )}
    </div>
  );
}

function HeadlineList({ items }: { items: Headline[] }) {
  return (
    <ul className="space-y-2">
      {items.map((h, i) => (
        <li key={i}>
          <a href={h.url} target="_blank" rel="noreferrer" className="group block text-sm leading-snug hover:text-accent">
            {h.title}
            <ExternalLink size={11} className="ml-1 inline opacity-0 transition group-hover:opacity-100" />
          </a>
          <div className="text-[11px] text-muted">
            {h.publisher} {h.published && `· ${timeAgo(h.published)}`}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------- Club ----------------

export function ClubTab({ d }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[d.home, d.away].map((t) => {
        const p = t.profile.ok ? t.profile.data : null;
        const sdb = p?.sportsDb;
        const wd = p?.wikidata;
        return (
          <div key={t.side} className="space-y-3 rounded-xl border border-line bg-surface/50 p-4">
            <div className="flex items-center gap-3">
              <Crest src={t.badge} name={t.name} size={44} />
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted">{sdb?.location ?? ""}</div>
              </div>
            </div>
            {!p ? (
              <Unavailable result={t.profile} />
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <Fact label="Founded" value={wd?.founded ?? sdb?.founded} />
                  <Fact label="Ground" value={wd?.stadium ?? sdb?.stadium} />
                  <Fact label="Capacity" value={(wd?.capacity ?? sdb?.capacity)?.toLocaleString()} />
                  <Fact label="Website" value={sdb?.website ? <a className="text-accent hover:underline" href={sdb.website} target="_blank" rel="noreferrer">{new URL(sdb.website).hostname.replace(/^www\./, "")}</a> : null} />
                </dl>
                {sdb?.description && <p className="text-xs leading-relaxed text-muted">{sdb.description}</p>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted">{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );
}

function ordinal(i: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = i % 100;
  return `${i}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export { kickoffLabel };
