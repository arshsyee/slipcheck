/**
 * Run the core from the terminal: research real matches, no UI.
 *
 *   npm run research -- "Arsenal v Leeds"
 *   npm run research -- "Real Madrid v Villarreal" --market total_goals --pick Over --line 2.5
 *   npm run research -- "Inter v Parma" --market btts --pick Yes "Augsburg v Bayern" --market asian_handicap --pick Bayern --line -1.5
 *   npm run research -- "Celtic v Hearts" --json          (full dossier as JSON)
 *
 * Options apply to the match before them. --league is optional (EPL, LA_LIGA, UCL, …); it's inferred when left out.
 * Markets: 1x2 (default, pick = home team), double_chance, draw_no_bet, total_goals, asian_handicap, btts.
 */
import { buildDossier } from "../lib/dossier/build";
import type { MatchDossier } from "../lib/dossier/types";
import { LEAGUES, MARKETS, type Leg } from "../lib/types";

function parseArgs(argv: string[]): { legs: Leg[]; json: boolean } {
  const legs: Leg[] = [];
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    const cur = legs.at(-1);
    if (a === "--json") json = true;
    else if (a === "--league" && cur) cur.league = next().toUpperCase() as Leg["league"];
    else if (a === "--market" && cur) cur.market = next() as Leg["market"];
    else if (a === "--pick" && cur) cur.selection = next();
    else if (a === "--line" && cur) cur.line = Number(next());
    else if (!a.startsWith("--")) {
      const [home, away] = a.split(/\s+(?:v|vs|-)\s+/i).map((s) => s.trim());
      legs.push({ league: "OTHER", homeTeam: home || null, awayTeam: away || null, market: "1x2", selection: "", line: null, oddsDecimal: null });
    }
  }
  for (const l of legs) {
    if (!LEAGUES.includes(l.league)) throw new Error(`Unknown league ${l.league}. Use one of: ${LEAGUES.join(", ")}`);
    if (!MARKETS.includes(l.market)) throw new Error(`Unknown market ${l.market}. Use one of: ${MARKETS.join(", ")}`);
    if (!l.selection) l.selection = l.market === "btts" ? "Yes" : l.market === "total_goals" ? "Over" : (l.homeTeam ?? "");
    if (l.line == null && l.market === "total_goals") l.line = 2.5;
  }
  return { legs, json };
}

const n = (x: number | null | undefined, dp = 2) => (x == null ? "—" : x.toFixed(dp));
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
// padEnd that ignores colour codes.
const pad = (s: string, w: number) => s + " ".repeat(Math.max(1, w - s.replace(/\x1b\[\d+m/g, "").length));

const splitStr = (x: { won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; ppg: number | null } | null | undefined) =>
  x ? `won ${x.won}, drew ${x.drawn}, lost ${x.lost} · scored ${x.goalsFor}, conceded ${x.goalsAgainst}` : "—";
const ordinal = (i: number) => `${i}${["th", "st", "nd", "rd"][(i % 100 - 20) % 10] ?? ["th", "st", "nd", "rd"][i % 100] ?? "th"}`;
const section = (title: string) => console.log(`\n  ${bold(title.toUpperCase())}`);

/** Layout (agreed 2026-09-23): 1. pick  2. market stats  3. everything else (match, teams, coach, matchup, context)  4. sources. */
function print(d: MatchDossier, ms: number) {
  const f = d.fixture;
  const H = d.home.name.slice(0, 22);
  const A = d.away.name.slice(0, 22);
  const row = (label: string, h: string, a: string) => console.log(`  ${pad(label, 46)}${pad(h, 44)}${a}`);
  console.log(`\n${bold(`${d.home.name} v ${d.away.name}`)}  ${dim(`${d.league.label} · built in ${(ms / 1000).toFixed(1)}s`)}`);

  // 1. Pick
  section(`1. Your pick: ${d.pick.title}`);
  d.pick.bullets.forEach((b) => console.log(`   • ${b}`));

  // 2. Market stats
  section("2. Numbers for this bet");
  row("", H, A);
  d.pick.stats.forEach((s) => row(s.label, s.home, s.away));

  // 3. Everything else
  section("3a. Match");
  console.log(`   Kick-off  ${f.kickoff ? new Date(f.kickoff).toLocaleString() : "not found"}${f.venue ? ` · ${f.venue}${f.city ? `, ${f.city}` : ""}` : ""}`);
  console.log(`   Referee   ${f.referee ?? dim("not appointed yet")}`);
  const w = d.weather?.ok ? d.weather.data : null;
  console.log(`   Weather   ${w ? `${w.summary}, ${w.tempC}°C, wind ${w.windKmh} km/h${w.precipProbability != null ? `, ${w.precipProbability}% rain` : ""}` : dim("forecast available ~16 days before kick-off")}`);
  f.conflicts.forEach((c) => console.log(`   ${red("!")} ${c}`));

  section("3b. Season so far");
  row("", H, A);
  const ss = (t: typeof d.home) => (t.season.ok ? t.season.data : null);
  const hs = ss(d.home);
  const as = ss(d.away);
  const L = (s: typeof hs) => s?.league ?? null;
  row("League position", L(hs) ? `${ordinal(L(hs)!.table.rank)}, ${L(hs)!.table.points} points from ${L(hs)!.table.played} games` : "—", L(as) ? `${ordinal(L(as)!.table.rank)}, ${L(as)!.table.points} points from ${L(as)!.table.played} games` : "—");
  row("League record", L(hs) ? splitStr({ ...L(hs)!.table, ppg: null }) : "—", L(as) ? splitStr({ ...L(as)!.table, ppg: null }) : "—");
  row("Home games", splitStr(L(hs)?.home), splitStr(L(as)?.home));
  row("Away games", splitStr(L(hs)?.away), splitStr(L(as)?.away));
  row("Expected goals (xG) for / against, season", L(hs)?.xgFor != null ? `${L(hs)!.xgFor} / ${L(hs)!.xgAgainst}` : "—", L(as)?.xgFor != null ? `${L(as)!.xgFor} / ${L(as)!.xgAgainst}` : "—");
  const sign = (x: number | null | undefined) => (x == null ? "—" : `${x > 0 ? "+" : ""}${x.toFixed(1)}`);
  row("Goals scored minus xG (+ = finishing well)", sign(L(hs)?.goalsMinusXg), sign(L(as)?.goalsMinusXg));
  row("League position after each game", L(hs)?.positionByRound.map((p) => p.position).join(" → ") ?? "—", L(as)?.positionByRound.map((p) => p.position).join(" → ") ?? "—");
  const last = (s: typeof hs) => s?.lastSeasonSameStage;
  row("Last season at this point", last(hs) ? `${ordinal(last(hs)!.position)} with ${last(hs)!.points} points after ${last(hs)!.played} games` : dim("not in this league"), last(as) ? `${ordinal(last(as)!.position)} with ${last(as)!.points} points after ${last(as)!.played} games` : dim("not in this league"));
  for (const [t, s] of [[d.home, hs], [d.away, as]] as const) {
    for (const c of s?.otherCompetitions ?? []) console.log(`   ${t.name} · ${c.competition}: ${splitStr(c.record)}  ${dim(c.results.map((r) => `${r.result} ${r.score} ${r.venue === "home" ? "v" : "@"} ${r.opponent}`).join(" | "))}`);
  }

  section("3c. Form");
  const st = (t: typeof d.home) => (t.stats.ok ? t.stats.data : null);
  const formStr = (s: ReturnType<typeof st>, venue = false) =>
    s ? [...(venue ? s.venue : s.overall).form5.games].reverse().map((g) => (g.result === "W" ? green("W") : g.result === "L" ? red("L") : "D")).join(" ") : "—";
  row("", H, A);
  row("Last 5 league games (oldest → newest)", formStr(st(d.home)), formStr(st(d.away)));
  row("Last 5 home games / away games", formStr(st(d.home), true), formStr(st(d.away), true));
  row("Rest days before kick-off", String(d.home.restDays ?? "—"), String(d.away.restDays ?? "—"));
  const lm = (t: typeof d.home) => (t.lastMatch ? `${t.lastMatch.score} v ${t.lastMatch.opponent}, ${t.lastMatch.date.slice(0, 10)}` : "—");
  row("Last game", lm(d.home), lm(d.away));
  for (const t of [d.home, d.away]) if (t.lastMatch?.competition.includes("league games only")) console.log(`   ${dim(`${t.name}: counted from league games only (cup and European results unavailable)`)}`);

  section("3d. Coach");
  for (const t of [d.home, d.away]) {
    const c = t.coach.ok ? t.coach.data : null;
    if (!c) {
      console.log(`   ${t.name}: ${dim(t.coach.ok ? "not found" : `unavailable (${t.coach.error})`)}`);
      continue;
    }
    const k = c.coach;
    const flag = k.agreement === "confirmed" ? "" : ` ${red("!")} ${k.agreement}${k.agreement === "conflict" ? ` (Wikipedia: ${k.wikipediaName}, Wikidata: ${k.wikidataName})` : ""}`;
    console.log(`   ${bold(t.name)}: ${k.name}${k.age ? `, ${k.age}` : ""}${k.nationality ? `, ${k.nationality}` : ""} · in charge since ${k.since ? k.since.slice(0, 10) : dim("unknown date")}${flag}`);
    const r = c.record;
    if (r) {
      if (r.allCompsThisSeason.played) console.log(`     This season in all competitions since arriving: ${splitStr(r.allCompsThisSeason)}`);
      if (r.league) console.log(`     All league games in charge (from ${r.league.from.slice(0, 10)}): ${splitStr(r.league)} · xG ${r.league.xgForPg ?? "—"} for / ${r.league.xgAgainstPg ?? "—"} against per game`);
      if (r.leagueBeforeThisSeason) console.log(`     League this season before they arrived${k.predecessor ? ` (${k.predecessor.name})` : ""}: ${splitStr(r.leagueBeforeThisSeason)}`);
      if (r.allCompsThisSeason.results.length) console.log(`     ${dim(r.allCompsThisSeason.results.slice(0, 6).map((x) => `${x.result} ${x.score} ${x.opponent}`).join(" | "))}`);
    }
  }

  section("3e. Availability");
  for (const t of [d.home, d.away]) {
    const a = t.availability;
    if (!a.ok) {
      console.log(`   ${t.name}: ${dim(`unavailable (${a.error})`)}`);
    } else if (a.data.kind === "official") {
      console.log(`   ${bold(t.name)} (official, FPL)${a.data.players.length ? "" : ": nobody flagged"}`);
      a.data.players.forEach((p) => console.log(`     ${p.player} (${p.position}) ${p.status}${p.chance != null ? `, ${p.chance}% chance of playing` : ""}: ${p.news}`));
    } else {
      console.log(`   ${bold(t.name)} ${dim("(news headlines, not an official list)")}${a.data.headlines.length ? "" : ": none this week"}`);
      a.data.headlines.slice(0, 4).forEach((h) => console.log(`     ${h.title} ${dim(`— ${h.publisher}`)}`));
    }
  }

  section("3f. Matchup");
  if (d.h2h?.ok && d.h2h.data.meetings.length) {
    const h = d.h2h.data;
    console.log(`   Last ${h.meetings.length} league meetings: ${d.home.name} won ${h.aWins}, ${d.away.name} won ${h.bWins}, ${h.draws} drawn. ${n(h.avgGoals, 1)} goals per game on average.`);
    console.log(`     ${h.meetings.slice(0, 5).map((m) => `${m.kickoff.slice(0, 10)} ${m.home} ${m.homeGoals}-${m.awayGoals} ${m.away}`).join("\n     ")}`);
  } else console.log(`   Head-to-head: ${dim("no league meetings in the last 5 seasons")}`);
  if (d.referee?.ok && d.referee.data) {
    const r = d.referee.data;
    console.log(`   Referee ${r.name} has done ${r.games} league games this season: ${n(r.yellowsPerGame, 1)} yellow cards and ${n(r.redsPerGame, 2)} red cards per game; the home team won ${Math.round((r.homeWinRate ?? 0) * r.games)} of them.`);
  }
  if (d.lineups?.ok && d.lineups.data.length) d.lineups.data.forEach((l) => console.log(`   Lineup ${l.team} ${l.formation ?? ""}: ${l.starters.map((p) => p.name).join(", ")}`));
  else console.log(`   Lineups: ${dim("published ~1 hour before kick-off")}`);

  // 4. Sources
  const failed = d.sourceLog.filter((s) => !s.ok);
  section("4. Sources");
  console.log(`   ${dim(`${[...new Set(d.sourceLog.filter((s) => s.ok).map((s) => s.source))].join(", ")} · ${d.sourceLog.length - failed.length}/${d.sourceLog.length} calls ok`)}`);
  failed.forEach((s) => console.log(`   ${red("✗")} ${s.source}: ${s.error}`));
}

async function main() {
  const { legs, json } = parseArgs(process.argv.slice(2));
  if (!legs.length) {
    console.log('Usage: npm run research -- "Arsenal v Leeds" [--market btts --pick Yes] [--league EPL] [--json]');
    process.exit(1);
  }
  const results = await Promise.all(
    legs.map(async (leg, i) => {
      const t0 = Date.now();
      const d = await buildDossier(leg, i);
      return { d, ms: Date.now() - t0 };
    }),
  );
  if (json) console.log(JSON.stringify(results.map((r) => r.d), null, 2));
  else results.forEach((r) => print(r.d, r.ms));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
