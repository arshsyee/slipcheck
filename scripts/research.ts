/**
 * Run the core from the terminal: research real matches, no UI.
 *
 *   npm run research -- "Arsenal v Leeds"
 *   npm run research -- "Real Madrid v Villarreal" --market total_goals --pick Over --line 2.5
 *   npm run research -- "Inter v Parma" --market btts --pick Yes "Augsburg v Bayern" --market asian_handicap --pick Bayern --line -1.5
 *   npm run research -- "England v Spain" --json          (national teams; full dossier as JSON)
 *   npm run research -- "England v Spain" --html report.html   (save a printable report; Print → Save as PDF)
 *
 * Options apply to the match before them. --league is optional (EPL, LA_LIGA, UCL, …); it's inferred when left out.
 * Markets: 1x2 (default, pick = home team), double_chance, draw_no_bet, total_goals, asian_handicap, btts.
 */
import { writeFileSync } from "node:fs";
import { buildDossier } from "../lib/dossier/build";
import { reportHtml } from "./report-html";
import type { MatchDossier } from "../lib/dossier/types";
import { LEAGUES, MARKETS, type Leg } from "../lib/types";

function parseArgs(argv: string[]): { legs: Leg[]; json: boolean; html: string | null } {
  const legs: Leg[] = [];
  let json = false;
  let html: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    const cur = legs.at(-1);
    if (a === "--json") json = true;
    else if (a === "--html") html = next();
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
  return { legs, json, html };
}

const n = (x: number | null | undefined, dp = 2) => (x == null ? "—" : x.toFixed(dp));
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const pts = (n: number) => `${n} point${n === 1 ? "" : "s"}`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
// padEnd that ignores colour codes.
const pad = (s: string, w: number) => s + " ".repeat(Math.max(1, w - s.replace(/\x1b\[\d+m/g, "").length));

const splitStr = (x: { won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; ppg: number | null } | null | undefined) =>
  x ? `W${x.won} D${x.drawn} L${x.lost} · goals ${x.goalsFor}–${x.goalsAgainst}` : "—";
const ordinal = (i: number) => `${i}${["th", "st", "nd", "rd"][(i % 100 - 20) % 10] ?? ["th", "st", "nd", "rd"][i % 100] ?? "th"}`;
const section = (title: string) => console.log(`\n  ${bold(title.toUpperCase())}`);

/** Layout (agreed 2026-09-23): 1. pick (table + notes)  3. everything else (match, teams, coach, matchup, context)  4. sources. */
function print(d: MatchDossier, ms: number) {
  const f = d.fixture;
  const H = d.home.name.slice(0, 22);
  const A = d.away.name.slice(0, 22);
  const row = (label: string, h: string, a: string) => console.log(`  ${pad(label, 30)}${pad(h, 30)}${a}`);
  console.log(`\n${bold(`${d.home.name} v ${d.away.name}`)}  ${dim(d.league.label)}`);
  // Timing goes to stderr so stdout is identical when nothing changed upstream.
  console.error(dim(`  built in ${(ms / 1000).toFixed(1)}s`));

  const NA = red("N/A · no free source");
  const intl = d.league.country === "International";
  // Missing values: say so plainly, in red, instead of a dash.
  const cell = (v: string | null | undefined) => (v == null || v === "—" ? NA : v);
  const r2 = (label: string, h: string | null | undefined, a: string | null | undefined) => row(label, cell(h), cell(a));

  // 1. Pick: the comparison table, then the facts that don't fit a table.
  section(`1. Your pick: ${d.pick.title}`);
  let group = "";
  for (const s of d.pick.stats) {
    if (s.group !== group) {
      group = s.group;
      console.log(`  ${dim(group)}`);
      console.log(`  ${pad("", 30)}${bold(pad(H, 30))}${bold(A)}`);
    }
    r2(`  ${s.label}`, s.home, s.away);
  }
  if (!d.pick.stats.length) console.log(`   ${red("Comparison N/A · no free source has these teams")}`);
  d.pick.bullets.forEach((b) => console.log(`   • ${b}`));

  // 3. Everything else
  section("3a. Match");
  console.log(`   Kick-off  ${f.kickoff ? new Date(f.kickoff).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "long" }) : NA}${f.venue ? ` · ${f.venue}${f.city ? `, ${f.city}` : ""}` : ""}`);
  console.log(`   Referee   ${f.referee ?? (f.found ? dim("not appointed yet") : NA)}`);
  const w = d.weather?.ok ? d.weather.data : null;
  const soon = f.kickoff && new Date(f.kickoff).getTime() - Date.now() < 15 * 86_400_000;
  console.log(`   Weather   ${w ? `${w.summary}, ${w.tempC}°C, wind ${w.windKmh} km/h${w.precipProbability != null ? `, ${w.precipProbability}% rain` : ""}` : soon || !f.kickoff ? NA : dim("forecast available ~16 days before kick-off")}`);
  f.conflicts.forEach((c) => console.log(`   ${red("!")} ${c}`));

  const ss = (t: typeof d.home) => (t.season.ok ? t.season.data : null);
  const hs = ss(d.home);
  const as = ss(d.away);
  const L = (s: typeof hs) => s?.league ?? null;
  if (intl) {
    section("3b. Standing");
    row("", H, A);
    const rk = (t: typeof d.home) => (t.ranking?.ok ? t.ranking.data : null);
    r2("FIFA ranking", rk(d.home)?.fifa != null ? `${ordinal(rk(d.home)!.fifa!)}` : null, rk(d.away)?.fifa != null ? `${ordinal(rk(d.away)!.fifa!)}` : null);
    r2("Elo ranking", rk(d.home)?.elo != null ? `${ordinal(rk(d.home)!.elo!)}` : null, rk(d.away)?.elo != null ? `${ordinal(rk(d.away)!.elo!)}` : null);
    const asOf = rk(d.home)?.asOf ?? rk(d.away)?.asOf;
    if (asOf) console.log(`   ${dim(`FIFA ranking as of ${asOf} (Wikipedia)`)}`);
    const st2 = (t: typeof d.home) => (t.stats.ok ? t.stats.data?.overall.allGames ?? null : null);
    const rec = (g: ReturnType<typeof st2>) => (g?.length ? splitStr({ won: g.filter((x) => x.gf > x.ga).length, drawn: g.filter((x) => x.gf === x.ga).length, lost: g.filter((x) => x.gf < x.ga).length, goalsFor: g.reduce((a2, x) => a2 + x.gf, 0), goalsAgainst: g.reduce((a2, x) => a2 + x.ga, 0), ppg: null }) : null);
    r2("Record, last 2 years", rec(st2(d.home)), rec(st2(d.away)));
    r2("xG, shots, cards", null, null);
  } else {
    section("3b. Season so far");
    row("", H, A);
    r2("League position", L(hs) ? `${ordinal(L(hs)!.table.rank)} · ${pts(L(hs)!.table.points)} · ${L(hs)!.table.played} played` : null, L(as) ? `${ordinal(L(as)!.table.rank)} · ${pts(L(as)!.table.points)} · ${L(as)!.table.played} played` : null);
    r2("Record", L(hs) ? splitStr({ ...L(hs)!.table, ppg: null }) : null, L(as) ? splitStr({ ...L(as)!.table, ppg: null }) : null);
    r2("  at home", L(hs) ? splitStr(L(hs)!.home) : null, L(as) ? splitStr(L(as)!.home) : null);
    r2("  away", L(hs) ? splitStr(L(hs)!.away) : null, L(as) ? splitStr(L(as)!.away) : null);
    r2("xG for – against", L(hs)?.xgFor != null ? `${L(hs)!.xgFor} – ${L(hs)!.xgAgainst}` : null, L(as)?.xgFor != null ? `${L(as)!.xgFor} – ${L(as)!.xgAgainst}` : null);
    const sign = (x: number | null | undefined) => (x == null ? null : `${x > 0 ? "+" : ""}${x.toFixed(1)}`);
    r2("Goals minus xG (+ = clinical)", sign(L(hs)?.goalsMinusXg), sign(L(as)?.goalsMinusXg));
    r2("Position, game by game", L(hs)?.positionByRound.map((p) => p.position).join(" → "), L(as)?.positionByRound.map((p) => p.position).join(" → "));
    const last = (s: typeof hs) => s?.lastSeasonSameStage;
    r2("Same point last season", last(hs) ? `${ordinal(last(hs)!.position)} · ${pts(last(hs)!.points)}` : null, last(as) ? `${ordinal(last(as)!.position)} · ${pts(last(as)!.points)}` : null);
    for (const [t, s2] of [[d.home, hs], [d.away, as]] as const) {
      for (const c of s2?.otherCompetitions ?? []) console.log(`   ${t.name} · ${c.competition}: ${splitStr(c.record)}  ${dim(c.results.map((r) => `${r.result} ${r.score} ${r.venue === "home" ? "v" : "@"} ${r.opponent}`).join(" | "))}`);
    }
  }

  section("3c. Form");
  const st = (t: typeof d.home) => (t.stats.ok ? t.stats.data : null);
  const formStr = (s2: ReturnType<typeof st>, venue = false) => {
    const g = s2 ? [...(venue ? s2.venue : s2.overall).form5.games].reverse() : [];
    return g.length ? g.map((x) => (x.result === "W" ? green("W") : x.result === "L" ? red("L") : "D")).join(" ") : null;
  };
  row("", H, A);
  r2(intl ? "Last 5 (old → new)" : "Last 5 league (old → new)", formStr(st(d.home)), formStr(st(d.away)));
  // Each column is a different venue, so say whose home and whose away.
  r2(`Last 5 at home (${H})`, formStr(st(d.home), true), "");
  r2(`Last 5 away (${A})`, "", formStr(st(d.away), true));
  r2("Rest days", d.home.restDays?.toString(), d.away.restDays?.toString());
  const lm = (t: typeof d.home) => (t.lastMatch ? `${t.lastMatch.score.replace(" at home", " (H)").replace(" away", " (A)").replace(" neutral", " (N)")} v ${t.lastMatch.opponent}, ${t.lastMatch.date.slice(0, 10)}` : null);
  r2("Last game", lm(d.home), lm(d.away));

  section("3d. Coach");
  for (const t of [d.home, d.away]) {
    const c = t.coach.ok ? t.coach.data : null;
    if (!c) {
      console.log(`   ${t.name}: ${t.coach.ok ? NA : red(`source down (${t.coach.error})`)}`);
      continue;
    }
    const k = c.coach;
    const flag = k.agreement === "conflict" ? ` ${red("!")} sources disagree (Wikipedia: ${k.wikipediaName}, Wikidata: ${k.wikidataName})` : "";
    console.log(`   ${bold(t.name)}: ${k.name}${k.age ? `, ${k.age}` : ""}${k.nationality ? `, ${k.nationality}` : ""}${k.since ? ` · in charge since ${k.since.slice(0, 10)}` : intl ? "" : ` · start date ${NA}`}${flag}`);
    const r = c.record;
    if (r) {
      if (r.allCompsThisSeason.played) console.log(`     This season, all competitions: ${splitStr(r.allCompsThisSeason)}`);
      if (r.league) console.log(`     League since ${r.league.from.slice(0, 10)}: ${splitStr(r.league)}${r.league.xgGames ? ` · xG ${r.league.xgForPg} – ${r.league.xgAgainstPg} per game (${r.league.xgGames === r.league.played ? "all games" : `only the ${r.league.xgGames} games with xG data`})` : ""}`);
      if (r.leagueBeforeThisSeason) console.log(`     League this season before they arrived${k.predecessor ? ` (${k.predecessor.name})` : ""}: ${splitStr(r.leagueBeforeThisSeason)}`);
      if (r.allCompsThisSeason.results.length) console.log(`     ${dim(r.allCompsThisSeason.results.slice(0, 6).map((x) => `${x.result} ${x.score} ${x.opponent}`).join(" | "))}`);
    }
  }

  section("3e. Availability");
  for (const t of [d.home, d.away]) {
    const a = t.availability;
    if (!a.ok) {
      console.log(`   ${t.name}: ${red(`source down (${a.error})`)}`);
    } else if (a.data.kind === "official") {
      console.log(`   ${bold(t.name)} (official, FPL)${a.data.players.length ? "" : ": nobody flagged"}`);
      a.data.players.forEach((p) => console.log(`     ${p.player} (${p.position}) ${p.status}${p.chance != null ? `, ${p.chance}% chance of playing` : ""}: ${p.news}`));
    } else {
      console.log(`   ${bold(t.name)}: official injury list ${NA}. ${dim("News headlines:")}${a.data.headlines.length ? "" : dim(" none this week")}`);
      a.data.headlines.slice(0, 4).forEach((h) => console.log(`     ${h.title} ${dim(`— ${h.publisher}`)}`));
    }
  }

  section("3f. Matchup");
  const kind = intl ? "meetings" : "league meetings";
  if (d.h2h?.ok && d.h2h.data.meetings.length) {
    const h = d.h2h.data;
    const friendlies = intl ? h.meetings.filter((m) => /friendly/i.test(m.competition)).length : 0;
    console.log(`   Last ${h.meetings.length} ${kind}: ${d.home.name} won ${h.aWins}, ${d.away.name} won ${h.bWins}, ${h.draws} drawn. ${n(h.avgGoals, 1)} goals per game.${friendlies ? ` ${friendlies} of the ${h.meetings.length} were friendlies.` : ""}`);
    // Every meeting counted in the summary, each with the winner spelled out.
    const winner = (m: (typeof h.meetings)[number]) => (m.homeGoals === m.awayGoals ? "draw" : `${m.homeGoals > m.awayGoals ? m.home : m.away} won`);
    h.meetings.forEach((m) => console.log(`     ${m.kickoff.slice(0, 10)}  ${pad(`${m.home} ${m.homeGoals}-${m.awayGoals} ${m.away}`, 44)}${pad(dim(winner(m)), 18)}${intl ? dim(m.competition) : ""}`));
  } else console.log(`   Head-to-head: ${d.h2h?.ok ? dim(intl ? "they have never met" : "no league meetings in the last 5 seasons") : NA}`);
  if (d.referee?.ok && d.referee.data) {
    const r = d.referee.data;
    console.log(`   Referee ${r.name}: ${r.games} league games this season, ${n(r.yellowsPerGame, 1)} yellows and ${n(r.redsPerGame, 2)} reds per game; home team won ${Math.round((r.homeWinRate ?? 0) * r.games)}.`);
  } else if (f.referee) console.log(`   Referee ${f.referee}, past stats: ${NA}`);
  if (d.lineups?.ok && d.lineups.data.length) d.lineups.data.forEach((l) => console.log(`   Lineup ${l.team} ${l.formation ?? ""}: ${l.starters.map((p) => p.name).join(", ")}`));
  else console.log(`   Lineups: ${d.lineups ? dim("published ~1 hour before kick-off") : NA}`);

  section("3g. Lineup & squad");
  for (const t of [d.home, d.away]) printSquad(t, NA);

  // 4. Sources
  const failed = d.sourceLog.filter((s) => !s.ok);
  section("4. Sources");
  // Sorted: parallel calls finish in any order, and the report must not change when the data didn't.
  console.log(`   ${dim(`${[...new Set(d.sourceLog.filter((s) => s.ok).map((s) => s.source))].sort().join(", ")} · ${d.sourceLog.length - failed.length}/${d.sourceLog.length} calls ok`)}`);
  [...failed].sort((a, b) => `${a.source}${a.error}`.localeCompare(`${b.source}${b.error}`)).forEach((s) => console.log(`   ${red("✗")} ${s.source}: ${s.error}`));
  const ago = (iso: string) => {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    return m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.round(m / 60)} hours` : `${Math.round(m / 1440)} days`;
  };
  const staleBy = new Map(d.stale.map((x) => [x.source, x]));
  staleBy.forEach((x) => console.log(`   ${yellow("!")} ${x.source} is down (${x.error}): showing the copy saved ${ago(x.savedAt)} ago`));
}

async function main() {
  const { legs, json, html } = parseArgs(process.argv.slice(2));
  if (!legs.length) {
    console.log('Usage: npm run research -- "Arsenal v Leeds" [--market btts --pick Yes] [--league EPL] [--json] [--html report.html]');
    process.exit(1);
  }
  const results = await Promise.all(
    legs.map(async (leg, i) => {
      const t0 = Date.now();
      const d = await buildDossier(leg, i);
      return { d, ms: Date.now() - t0 };
    }),
  );
  if (json) return console.log(JSON.stringify(results.map((r) => r.d), null, 2));
  // --html: record what each match prints (still shown in the terminal) and save it as a page.
  const blocks: string[] = [];
  const log = console.log;
  for (const r of results) {
    const lines: string[] = [];
    console.log = (...args: unknown[]) => {
      lines.push(args.join(" "));
      log(...args);
    };
    print(r.d, r.ms);
    console.log = log;
    blocks.push(lines.join("\n"));
  }
  if (html) {
    writeFileSync(html, reportHtml(blocks, new Date()));
    console.error(dim(`  saved ${html}: open it and choose Print → Save as PDF`));
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

const POS_ORDER = ["GK", "DEF", "MID", "FWD"] as const;

/** Wrap "label  a · b · c" onto several lines at ~120 characters, keeping the label column. */
function wrapRow(label: string, items: string[], indent = 5) {
  const lines: string[] = [];
  let cur = "";
  for (const it of items) {
    if (cur && (cur + " · " + it).replace(/\x1b\[[0-9;]*m/g, "").length > 110) {
      lines.push(cur);
      cur = it;
    } else cur = cur ? `${cur} · ${it}` : it;
  }
  if (cur) lines.push(cur);
  lines.forEach((l, i) => console.log(`${" ".repeat(indent)}${pad(i ? "" : label, 6)}${l}`));
}

function printSquad(t: MatchDossier["home"], NA: string) {
  const r = t.squad;
  if (!r) return console.log(`   ${bold(t.name)}: squad ${NA}`);
  if (!r.ok) return console.log(`   ${bold(t.name)}: ${red(`source down (${r.error})`)}`);
  const s = r.data;
  if (!s) return console.log(`   ${bold(t.name)}: squad ${NA}`);
  const flag = (p: (typeof s.players)[number]) =>
    p.status === "doubtful" ? yellow(` (doubtful${p.chance != null ? `, ${p.chance}%` : ""})`) : "";

  if (s.likely && s.likely.xi.length) {
    const L = s.likely;
    console.log(`   ${bold(t.name)} · likely XI ${bold(L.shape)} ${dim(`= most starts in the last ${L.window} league games, injured left out. Not an official lineup. (3/${L.window} = started 3 of the last ${L.window})`)}`);
    for (const pos of POS_ORDER) wrapRow(pos, L.xi.filter((p) => p.pos === pos).map((p) => `${p.name} ${p.starts}/${L.window}${flag(p)}`));
    const next = POS_ORDER.filter((pos) => L.backups[pos].length).map((pos) => `${pos} ${L.backups[pos].map((p) => `${p.name} ${p.starts}/${L.window}${flag(p)}`).join(", ")}`);
    wrapRow("Next in line:", next, 5);
  } else {
    const src = s.source === "wikipedia" ? `Wikipedia squad list${s.asOf && s.asOf.length < 25 ? `, updated ${s.asOf}` : ""}` : "FPL";
    console.log(`   ${bold(t.name)} · squad by position ${dim(`(${src})`)} · likely XI ${NA}`);
    if (s.asOf && s.asOf.length >= 25) console.log(`     ${dim(s.asOf)}`);
    for (const pos of POS_ORDER) {
      const ps = s.players.filter((p) => p.pos === pos);
      wrapRow(pos, ps.map((p) => `${p.number ? `${p.number} ` : ""}${p.name}${p.caps != null ? dim(` ${p.caps} cap${p.caps === 1 ? "" : "s"}`) : ""}${p.note === "captain" ? dim(" (captain)") : ""}`));
    }
  }

  const outs = s.players.filter((p) => ["injured", "suspended", "unavailable"].includes(p.status) || p.chance === 0);
  if (s.source === "fpl") {
    if (outs.length) outs.forEach((p) => console.log(`     ${red("Out")}   ${p.name} (${p.pos}, ${p.status})${p.note ? `: ${p.note}` : ""}`));
    else console.log(`     ${dim("Out   nobody flagged")}`);
  } else {
    if (s.outs?.length) s.outs.forEach((p, i) => console.log(`     ${pad(i ? "" : red("Out"), 6)}${p.name} (${p.pos}, ${p.note})${p.club ? dim(` · ${p.club}`) : ""}`));
    else if (s.withdrawals) console.log(`     ${red("Withdrew")} ${s.withdrawals}`);
    else console.log(`     Out   official list ${NA}${dim(" · see injury news above")}`);
    if (s.players.some((p) => p.caps != null)) console.log(`     ${dim("Wikipedia's squad list can lag behind late withdrawals: check the injury news above.")}`);
  }
  // Squad players named in this team's injury/team-news headlines: the headline, not a diagnosis.
  s.players.filter((p) => p.inNews).forEach((p, i) => console.log(`     ${pad(i ? "" : yellow("News"), 6)}${p.name} (${p.pos}): "${p.inNews!.title}" ${dim(`— ${p.inNews!.publisher}`)}`));
  if (s.watch.length) s.watch.forEach((w, i) => console.log(`     ${pad(i ? "" : "Watch", 6)}${w}`));
  else console.log(`     Watch ${NA}`);
}
