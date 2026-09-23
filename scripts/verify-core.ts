/**
 * Verifies the core engine against real, live data. No fixtures, no made-up picks.
 *   npm run verify            (all three parts)
 *   npm run verify -- accuracy | goals | referees | xg | coverage
 *
 * A. accuracy: every club in all 22 divisions. Season record computed from football-data.co.uk
 *    vs ESPN's official table (played, W-D-L, goals for/against).
 * B. goals:    Bundesliga + 2. Bundesliga scores, football-data.co.uk vs OpenLigaDB, match by match.
 * D. referees: recent matches, football-data.co.uk referee vs ESPN's listed official.
 * E. xg:       EPL team xG, football-data.co.uk vs the sum of Fantasy Premier League player xG.
 * C. coverage: builds a dossier for every real upcoming fixture in the big leagues + UCL and
 *    reports which sections filled, which failed, and why.
 */
import { writeFileSync } from "node:fs";
import { DOMESTIC_LEAGUES, LEAGUE_INFO } from "../lib/leagues";
import { getSeason } from "../lib/sources/footballData";
import { getScoreboard, getStandings, getSummary, getUpcoming } from "../lib/sources/espn";
import { getSeasonMatches } from "../lib/sources/openLigaDb";
import { gamesFor, resolveName } from "../lib/stats/team";
import { sameReferee } from "../lib/stats/match";
import { bestTeamMatch } from "../lib/teams/match";
import { computeTable } from "../lib/stats/table";
import { buildDossier, deductionsFor } from "../lib/dossier/build";
import type { League } from "../lib/types";
import type { MatchDossier } from "../lib/dossier/types";

const part = process.argv[2];
const out: Record<string, unknown> = {};

/** Wikipedia season article per league, for settling disagreements between sources. */
const WIKI_PAGE: Partial<Record<League, string>> = {
  EPL: "Premier League", LA_LIGA: "La Liga", SERIE_A: "Serie A", BUNDESLIGA: "Bundesliga", LIGUE_1: "Ligue 1",
};

type Rec = { p: number; w: number; d: number; l: number; gf: number; ga: number };

/** Team records from the "Sports table" template on the Wikipedia season page. */
async function wikipediaTable(league: League): Promise<Map<string, Rec>> {
  const y = new Date().getUTCMonth() >= 6 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1;
  const title = `${y}–${String(y + 1).slice(2)} ${WIKI_PAGE[league]}`;
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2`;
  const res = await fetch(url, { headers: { "user-agent": "SlipCheck/0.2 (verification)" } });
  const w: string = (await res.json()).parse?.wikitext ?? "";
  const block = w.slice(w.indexOf("Sports table"));
  const names = new Map([...block.matchAll(/\|name_(\w+)\s*=\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)].map((m) => [m[1], m[3] ?? m[2]]));
  const out = new Map<string, Rec>();
  for (const m of block.matchAll(/\|win_(\w+)\s*=\s*(\d+)\s*\|\s*draw_\w+\s*=\s*(\d+)\s*\|\s*loss_\w+\s*=\s*(\d+)\s*\|\s*gf_\w+\s*=\s*(\d+)\s*\|\s*ga_\w+\s*=\s*(\d+)/g)) {
    const [w_, d, l, gf, ga] = m.slice(2).map(Number);
    const name = names.get(m[1]);
    if (name) out.set(name, { p: w_ + d + l, w: w_, d, l, gf, ga });
  }
  return out;
}

const same = (a: Rec, b: Rec) => (Object.keys(a) as (keyof Rec)[]).every((k) => a[k] === b[k]);

async function accuracy() {
  console.log("\n=== A. League tables: computed from football-data.co.uk vs ESPN (top 5 leagues) ===");
  let clubs = 0, exact = 0, lagging = 0, rankOnly = 0;
  const disputes: { league: League; team: string; fd: Rec; espn: Rec }[] = [];
  const espnOnly: string[] = [];
  for (const league of DOMESTIC_LEAGUES) {
    const info = LEAGUE_INFO[league];
    const [rows, espnTable] = await Promise.all([getSeason(info.fd!), getStandings(info.espn)]);
    const mine = computeTable(rows, league, await deductionsFor(info, rows));
    for (const t of espnTable) {
      clubs++;
      const fdName = resolveName(t.team, rows);
      const r = mine.find((x) => x.team === fdName);
      if (!r) {
        espnOnly.push(`${league}: ${t.team}`);
        continue;
      }
      const a: Rec = { p: r.played, w: r.won, d: r.drawn, l: r.lost, gf: r.goalsFor, ga: r.goalsAgainst };
      const b: Rec = { p: t.played, w: t.won, d: t.drawn, l: t.lost, gf: t.goalsFor, ga: t.goalsAgainst };
      if (same(a, b)) {
        exact++;
        if (r.rank !== t.rank) rankOnly++;
      } else if (a.p < b.p) lagging++;
      else disputes.push({ league, team: t.team, fd: a, espn: b });
    }
    process.stdout.write(".");
  }
  console.log(`\n${clubs} ESPN table rows: ${exact} identical records (${rankOnly} of those placed differently on tie-breaks), ${lagging} where the CSV is a round behind, ${disputes.length} disagreements, ${espnOnly.length} clubs ESPN lists that football-data.co.uk doesn't have in that division`);

  // Settle each disagreement with Wikipedia.
  const verdicts = { fd: 0, espn: 0, neither: 0 };
  const byLeague = [...new Set(disputes.map((d) => d.league))];
  for (const league of byLeague) {
    const wiki = await wikipediaTable(league).catch(() => new Map<string, Rec>());
    for (const d of disputes.filter((x) => x.league === league)) {
      const key = bestTeamMatch(d.team, [...wiki.keys()])?.name;
      const w = key ? wiki.get(key)! : null;
      const verdict = !w ? "no Wikipedia data" : same(w, d.fd) ? "football-data.co.uk correct" : same(w, d.espn) ? "ESPN correct" : "neither matches";
      if (w) verdicts[same(w, d.fd) ? "fd" : same(w, d.espn) ? "espn" : "neither"]++;
      console.log(`  ${league} ${d.team}: fd ${fmt(d.fd)} | ESPN ${fmt(d.espn)} | Wikipedia ${w ? fmt(w) : "—"} → ${verdict}`);
    }
  }
  if (disputes.length) console.log(`Wikipedia verdicts: football-data.co.uk right ${verdicts.fd}, ESPN right ${verdicts.espn}, neither ${verdicts.neither}`);
  espnOnly.forEach((u) => console.log("  ESPN-only", u));
  out.accuracy = { clubs, exact, rankOnly, lagging, disputes, verdicts, espnOnly };
}

const fmt = (x: Rec) => `P${x.p} ${x.w}-${x.d}-${x.l} ${x.gf}:${x.ga}`;

async function goals() {
  console.log("\n=== B. Scores: football-data.co.uk vs OpenLigaDB (Bundesliga) ===");
  const res: Record<string, unknown> = {};
  for (const [league, oldb] of [["BUNDESLIGA", "bl1"]] as const) {
    const [rows, matches] = await Promise.all([getSeason(LEAGUE_INFO[league].fd!), getSeasonMatches(oldb)]);
    let compared = 0, agree = 0;
    const diffs: string[] = [];
    let missing = 0;
    const fdNames = [...new Set(rows.flatMap((x) => [x.home, x.away]))];
    const toFd = (n: string) => bestTeamMatch(n, fdNames)?.name;
    for (const m of matches.filter((x) => x.finished && x.score)) {
      const [h, a] = [toFd(m.home), toFd(m.away)];
      const r = rows.find((x) => x.home === h && x.away === a && Math.abs(new Date(x.kickoff).getTime() - new Date(m.kickoff).getTime()) < 36 * 3600e3);
      if (!r) {
        missing++;
        continue;
      }
      compared++;
      if (r.fthg === m.score![0] && r.ftag === m.score![1]) agree++;
      else diffs.push(`${m.home} v ${m.away} ${m.kickoff.slice(0, 10)}: fd ${r.fthg}-${r.ftag}, OpenLigaDB ${m.score![0]}-${m.score![1]}`);
    }
    console.log(`${league}: ${compared} matches compared, ${agree} agree, ${diffs.length} differ, ${missing} in OpenLigaDB but not (yet) in the CSV`);
    diffs.forEach((d) => console.log("  DIFF", d));
    res[league] = { compared, agree, diffs, missing };
  }
  out.goals = res;
}

async function coverage() {
  console.log("\n=== C. Dossiers for every real upcoming fixture (next matchday) ===");
  const leagues: League[] = ["EPL", "LA_LIGA", "SERIE_A", "BUNDESLIGA", "LIGUE_1", "UCL"];
  const all: { league: League; match: string; d: MatchDossier; ms: number }[] = [];
  for (const league of leagues) {
    const upcoming = (await getUpcoming(LEAGUE_INFO[league as keyof typeof LEAGUE_INFO].espn)).sort((a, b) => a.date.localeCompare(b.date));
    // Next matchday = fixtures within 4 days of the first one.
    const first = upcoming[0] ? new Date(upcoming[0].date).getTime() : 0;
    const round = upcoming.filter((e) => new Date(e.date).getTime() - first < 4 * 86400e3);
    for (const e of round) {
      const t0 = Date.now();
      const d = await buildDossier(
        { league, homeTeam: e.home.name, awayTeam: e.away.name, market: "1x2", selection: e.home.name, line: null, oddsDecimal: null },
        0,
      );
      all.push({ league, match: `${e.home.name} v ${e.away.name}`, d, ms: Date.now() - t0 });
    }
    console.log(`${league}: ${round.length} fixtures built`);
  }

  // Section fill rates.
  const has = {
    "fixture found": (d: MatchDossier) => d.fixture.found,
    "kick-off": (d: MatchDossier) => Boolean(d.fixture.kickoff),
    venue: (d: MatchDossier) => Boolean(d.fixture.venue),
    "both crests (ESPN)": (d: MatchDossier) => Boolean(d.home.espn && d.away.espn),
    "both season stats": (d: MatchDossier) => Boolean(d.home.stats.ok && d.home.stats.data && d.away.stats.ok && d.away.stats.data),
    "xG present": (d: MatchDossier) => Boolean(d.home.stats.ok && d.home.stats.data?.overall.averages.xgFor != null),
    "both table positions": (d: MatchDossier) => Boolean(d.home.standing?.ok && d.home.standing.data && d.away.standing?.ok && d.away.standing.data),
    "rest days": (d: MatchDossier) => d.home.restDays != null && d.away.restDays != null,
    "head-to-head": (d: MatchDossier) => Boolean(d.h2h?.ok),
    "referee named": (d: MatchDossier) => Boolean(d.fixture.referee),
    "referee stats": (d: MatchDossier) => Boolean(d.referee?.ok && d.referee.data),
    "weather": (d: MatchDossier) => Boolean(d.weather?.ok && d.weather.data),
    "availability (official)": (d: MatchDossier) => d.home.availability.ok && d.home.availability.data.kind === "official",
    "availability (news)": (d: MatchDossier) => d.home.availability.ok && d.home.availability.data.kind === "news",
    "club profile": (d: MatchDossier) => d.home.profile.ok && d.away.profile.ok,
    "stadium coords (Wikidata)": (d: MatchDossier) => Boolean(d.home.profile.ok && d.home.profile.data.wikidata?.lat != null),
    "news both clubs": (d: MatchDossier) => d.home.news.ok && d.home.news.data.length > 0 && d.away.news.ok && d.away.news.data.length > 0,
    "pick focus bullets": (d: MatchDossier) => d.pick.bullets.length >= 3,
  };
  const n = all.length;
  console.log(`\n${n} dossiers · avg ${Math.round(all.reduce((s, x) => s + x.ms, 0) / n)}ms each (warm cache after the first)`);
  console.log(`${"section".padEnd(28)} ${leagues.map((l) => l.padEnd(10)).join(" ")} total`);
  for (const [name, f] of Object.entries(has)) {
    const cells = leagues.map((l) => {
      const ds = all.filter((x) => x.league === l);
      return ds.length ? `${ds.filter((x) => f(x.d)).length}/${ds.length}`.padEnd(10) : "-".padEnd(10);
    });
    console.log(`${name.padEnd(28)} ${cells.join(" ")} ${all.filter((x) => f(x.d)).length}/${n}`);
  }

  // Every failed source call, grouped.
  const failures = new Map<string, string[]>();
  for (const x of all) for (const s of x.d.sourceLog.filter((s) => !s.ok)) {
    const key = `${s.source}: ${s.error}`;
    failures.set(key, [...(failures.get(key) ?? []), x.match]);
  }
  const calls = all.reduce((s, x) => s + x.d.sourceLog.length, 0);
  const failed = all.reduce((s, x) => s + x.d.sourceLog.filter((s) => !s.ok).length, 0);
  console.log(`\nSource calls: ${calls}, failed: ${failed}`);
  for (const [k, v] of [...failures].sort((a, b) => b[1].length - a[1].length)) console.log(`  ${v.length}× ${k}  (e.g. ${v.slice(0, 2).join("; ")})`);

  // Clubs whose stats didn't resolve.
  const noStats = all.flatMap((x) => [x.d.home, x.d.away].filter((t) => !(t.stats.ok && t.stats.data)).map((t) => `${x.league}: ${t.name}`));
  if (noStats.length) console.log(`\nNo season stats for: ${[...new Set(noStats)].join(", ")}`);
  out.coverage = all.map((x) => ({ league: x.league, match: x.match, ms: x.ms, dossier: x.d }));
}

async function referees() {
  console.log("\n=== D. Referees: football-data.co.uk vs ESPN match officials (last 14 days) ===");
  const res: Record<string, unknown> = {};
  for (const league of ["EPL", "LA_LIGA", "SERIE_A", "BUNDESLIGA", "LIGUE_1"] as League[]) {
    const info = LEAGUE_INFO[league as keyof typeof LEAGUE_INFO];
    const rows = await getSeason(info.fd!);
    const withRef = rows.filter((r) => r.referee);
    if (!withRef.length) {
      console.log(`${league}: football-data.co.uk has no referee column for this division`);
      res[league] = { note: "no referee data" };
      continue;
    }
    const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (i + 1) * 86400e3).toISOString().slice(0, 10).replace(/-/g, ""));
    const events = (await Promise.all(days.map((d) => getScoreboard(info.espn, d).catch(() => [])))).flat().filter((e) => e.completed);
    const fdNames = [...new Set(rows.flatMap((x) => [x.home, x.away]))];
    let compared = 0, agree = 0;
    const diffs: string[] = [];
    for (const e of events) {
      const h = bestTeamMatch(e.home.name, fdNames)?.name;
      const a = bestTeamMatch(e.away.name, fdNames)?.name;
      const r = rows.find((x) => x.home === h && x.away === a && Math.abs(new Date(x.kickoff).getTime() - new Date(e.date).getTime()) < 36 * 3600e3);
      if (!r?.referee) continue;
      const espnRef = (await getSummary(info.espn, e.id).catch(() => null))?.referee;
      if (!espnRef) continue;
      compared++;
      if (sameReferee(r.referee, espnRef)) agree++;
      else diffs.push(`${e.home.name} v ${e.away.name}: fd "${r.referee}", ESPN "${espnRef}"`);
    }
    console.log(`${league}: ${compared} matches compared, ${agree} agree`);
    diffs.forEach((d) => console.log("  DIFF", d));
    res[league] = { compared, agree, diffs };
  }
  out.referees = res;
}

async function xg() {
  console.log("\n=== E. xG: football-data.co.uk team xG vs Fantasy Premier League (sum of player xG), EPL ===");
  const rows = await getSeason("E0");
  const fpl = await (await fetch("https://fantasy.premierleague.com/api/bootstrap-static/")).json() as {
    teams: { id: number; name: string }[];
    elements: { team: number; expected_goals: string; goals_scored: number }[];
  };
  const fdNames = [...new Set(rows.flatMap((x) => [x.home, x.away]))];
  const lines: { team: string; fd: number; fpl: number; goalsFd: number; goalsFpl: number }[] = [];
  for (const t of fpl.teams) {
    const n = bestTeamMatch(t.name, fdNames)?.name;
    if (!n) continue;
    const g = gamesFor(rows, n);
    const players = fpl.elements.filter((e) => e.team === t.id);
    lines.push({
      team: t.name,
      fd: +g.reduce((s, x) => s + (x.xgf ?? 0), 0).toFixed(2),
      fpl: +players.reduce((s, e) => s + Number(e.expected_goals), 0).toFixed(2),
      goalsFd: g.reduce((s, x) => s + x.gf, 0),
      goalsFpl: players.reduce((s, e) => s + e.goals_scored, 0),
    });
  }
  const diffs = lines.map((l) => Math.abs(l.fd - l.fpl));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const fdM = mean(lines.map((l) => l.fd)), fpM = mean(lines.map((l) => l.fpl));
  const corr = lines.reduce((s, l) => s + (l.fd - fdM) * (l.fpl - fpM), 0) /
    Math.sqrt(lines.reduce((s, l) => s + (l.fd - fdM) ** 2, 0) * lines.reduce((s, l) => s + (l.fpl - fpM) ** 2, 0));
  console.log(`${lines.length} clubs · mean |difference| ${mean(diffs).toFixed(2)} xG per club-season · correlation ${corr.toFixed(3)}`);
  console.log("(FPL player xG excludes own goals and can lag a gameweek; goals scored are shown as a sanity check.)");
  for (const l of lines.sort((a, b) => Math.abs(b.fd - b.fpl) - Math.abs(a.fd - a.fpl)).slice(0, 5))
    console.log(`  ${l.team.padEnd(16)} fd xG ${l.fd.toFixed(2)} vs FPL ${l.fpl.toFixed(2)} · goals fd ${l.goalsFd} vs FPL ${l.goalsFpl}`);
  out.xg = { lines, meanAbsDiff: mean(diffs), corr };
}

async function main() {
  if (!part || part === "accuracy") await accuracy();
  if (!part || part === "goals") await goals();
  if (!part || part === "referees") await referees();
  if (!part || part === "xg") await xg();
  if (!part || part === "coverage") await coverage();
  writeFileSync(".cache/verify-report.json", JSON.stringify(out, null, 1));
  console.log("\nFull report: .cache/verify-report.json");
}

main();
