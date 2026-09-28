/**
 * Live health + freshness check for every data source, then what that means for each piece of data.
 *   npm run check-sources
 * Always asks the sources live (SLIPCHECK_LIVE); a source that is down but has a saved copy shows as SAVED.
 * Exits non-zero if any core data item has no live or saved source.
 */
process.env.SLIPCHECK_LIVE = "1";
import { staleLog } from "../lib/sources/cache";
import { getInfoboxCoach } from "../lib/sources/coach";
import { getInternationalResults, getNationalTeamInfo } from "../lib/sources/international";
import { getFplSquad, getWikiSquad } from "../lib/sources/squad";
import { getCupResults } from "../lib/sources/cups";
import type { SourceId } from "../lib/sources/types";
import { getFixtures, getSeason } from "../lib/sources/footballData";
import { findTeam, getRecentResults, getStandings } from "../lib/sources/espn";
import { getSeasonMatches } from "../lib/sources/openLigaDb";
import { getKickoffWeather } from "../lib/sources/weather";
import { getClubFacts } from "../lib/sources/wikidata";
import { getBbcClubNews, getGoogleClubNews } from "../lib/sources/news";
import { getClubProfile } from "../lib/sources/sportsDb";
import { getFplTeam } from "../lib/sources/fpl";
import { findPlFixture } from "../lib/sources/premierLeague";
import { getCompetitionMatches } from "../lib/sources/uefa";

const DAY = 86_400_000;

interface Check {
  id: SourceId | "football-data-fixtures" | "wikipedia-national" | "wikipedia-squad" | "fpl-starts" | "cups";
  name: string;
  /** Returns a one-line summary and the timestamp of the newest item (null = timeless data). */
  run: () => Promise<{ summary: string; newest: string | null }>;
  /** Max age of the newest item. International breaks can pause leagues for ~2 weeks. */
  maxAgeDays?: number;
}

const latest = (dates: (string | null | undefined)[]) => dates.filter(Boolean).sort().at(-1) ?? null;

const checks: Check[] = [
  {
    id: "football-data",
    name: "football-data.co.uk results (EPL)",
    maxAgeDays: 21,
    run: async () => {
      const rows = await getSeason("E0");
      const xg = rows.filter((r) => r.hxg != null).length;
      return { summary: `${rows.length} matches, ${xg} with xG`, newest: latest(rows.map((r) => r.kickoff)) };
    },
  },
  {
    id: "football-data-fixtures",
    name: "football-data.co.uk fixtures",
    run: async () => {
      const all = await getFixtures();
      const f = all.filter((x) => new Date(x.kickoff).getTime() > Date.now());
      const divs = new Set(f.map((x) => x.div)).size;
      // The file is published a few days before each round, so it's often empty during breaks; PL/UEFA/ESPN cover that.
      if (!f.length) throw new Error(`reachable, but no upcoming matches listed (normal between rounds); ${all.length} past rows`);
      return { summary: `${f.length} of ${all.length} listed are upcoming (${divs} divisions)`, newest: null };
    },
  },
  {
    id: "espn",
    name: "ESPN standings + results",
    maxAgeDays: 21,
    run: async () => {
      const table = await getStandings("eng.1");
      const team = await findTeam("Arsenal", ["eng.1"]);
      const results = team ? await getRecentResults(["eng.1"], team.id) : [];
      return { summary: `table ${table.length} rows, Arsenal ${results.length} results`, newest: results[0]?.date ?? null };
    },
  },
  {
    id: "openligadb",
    name: "OpenLigaDB (Bundesliga)",
    maxAgeDays: 21,
    run: async () => {
      const m = (await getSeasonMatches("bl1")).filter((x) => x.finished);
      return { summary: `${m.length} finished, ${m.reduce((n, x) => n + x.goals.length, 0)} goals logged`, newest: latest(m.map((x) => x.kickoff)) };
    },
  },
  {
    id: "open-meteo",
    name: "Open-Meteo forecast",
    run: async () => {
      const w = await getKickoffWeather(51.555, -0.108, new Date(Date.now() + 2 * DAY).toISOString());
      if (!w) throw new Error("no forecast returned");
      return { summary: `${w.summary}, ${w.tempC}°C, wind ${w.windKmh} km/h`, newest: null };
    },
  },
  {
    id: "wikidata",
    name: "Wikidata (stadium)",
    run: async () => {
      const f = await getClubFacts("Arsenal", "England");
      if (!f?.lat) throw new Error("no stadium coordinates");
      return { summary: `${f.stadium}, cap ${f.capacity}, founded ${f.founded}`, newest: null };
    },
  },
  {
    id: "bbc",
    name: "BBC Sport RSS",
    maxAgeDays: 7,
    run: async () => {
      const h = await getBbcClubNews("Arsenal");
      return { summary: `${h.length} headlines`, newest: latest(h.map((x) => x.published)) };
    },
  },
  {
    id: "google-news",
    name: "Google News RSS",
    maxAgeDays: 7,
    run: async () => {
      const h = await getGoogleClubNews("Real Madrid");
      return { summary: `${h.length} headlines`, newest: latest(h.map((x) => x.published)) };
    },
  },
  {
    id: "thesportsdb",
    name: "TheSportsDB",
    run: async () => {
      const p = await getClubProfile("Bayern Munich");
      if (!p) throw new Error("club not found");
      return { summary: `${p.name}, ${p.stadium}`, newest: null };
    },
  },
  {
    id: "fpl",
    name: "Fantasy Premier League",
    run: async () => {
      const t = await getFplTeam("Arsenal");
      if (!t) throw new Error("team not found");
      return { summary: `${t.availability.length} flagged, top xG+xA ${t.keyPlayers[0]?.player}`, newest: latest(t.availability.map((a) => a.since)) };
    },
  },
  {
    id: "premier-league",
    name: "Premier League (pulselive)",
    run: async () => {
      const f = await findPlFixture("Arsenal", null);
      if (!f) throw new Error("no upcoming fixture");
      return { summary: `next: ${f.home} v ${f.away} at ${f.ground}`, newest: null };
    },
  },
  {
    id: "uefa",
    name: "UEFA match API",
    run: async () => {
      const m = await getCompetitionMatches(1);
      const next = m.find((x) => x.status !== "FINISHED");
      return { summary: `${m.length} UCL matches, next ${next?.home} v ${next?.away}`, newest: latest(m.filter((x) => x.status === "FINISHED").map((x) => x.kickoff)) };
    },
  },
  {
    id: "cups",
    name: "Cup results (Wikipedia, OpenLigaDB)",
    run: async () => {
      const [efl, dfb] = await Promise.all([getCupResults("England", "Tottenham Hotspur", "x"), getCupResults("Germany", "Bayern Munich", "x")]);
      if (!efl.length || !dfb.length) throw new Error(`EFL Cup ${efl.length} / DFB-Pokal ${dfb.length} Spurs/Bayern games found`);
      return { summary: `Spurs ${efl.length} EFL Cup games, Bayern ${dfb.length} DFB-Pokal games`, newest: null };
    },
  },
  {
    id: "international-results",
    name: "International results (CC0)",
    // International windows are ~2 months apart.
    maxAgeDays: 75,
    run: async () => {
      const rows = await getInternationalResults();
      return { summary: `${rows.length} matches since 1872`, newest: rows.at(-1)?.kickoff ?? null };
    },
  },
  {
    id: "wikipedia-national",
    name: "Wikipedia (national team, squad)",
    run: async () => {
      const info = await getNationalTeamInfo("England");
      const squad = info ? await getWikiSquad(info.wikipediaTitle) : null;
      if (!info?.coach || !info.fifaRank || !squad?.players.length) throw new Error("coach, ranking or squad missing");
      return { summary: `coach ${info.coach}, FIFA ${info.fifaRank}, squad of ${squad.players.length}`, newest: null };
    },
  },
  {
    id: "wikipedia-squad",
    name: "Wikipedia (club squad list)",
    run: async () => {
      const s = await getWikiSquad("Real Madrid CF");
      if (!s?.players.length) throw new Error("squad list not found");
      return { summary: `Real Madrid: ${s.players.length} players, updated ${s.asOf}`, newest: null };
    },
  },
  {
    id: "fpl-starts",
    name: "FPL recent starts (likely XI)",
    run: async () => {
      const s = await getFplSquad("Arsenal");
      if (!s?.likely?.xi.length) throw new Error("no recent lineups");
      return { summary: `Arsenal likely XI ${s.likely.shape} from the last ${s.likely.window} gameweeks`, newest: null };
    },
  },
  {
    id: "wikipedia",
    name: "Wikipedia (current coach)",
    run: async () => {
      const c = await getInfoboxCoach("Arsenal F.C.");
      if (!c) throw new Error("no manager in infobox");
      return { summary: `Arsenal manager: ${c}`, newest: null };
    },
  },
];

/** Each piece of data in a dossier and the sources that can supply it, in order of preference. */
const ITEMS: { item: string; sources: Check["id"][]; core: boolean }[] = [
  { item: "League table, form, goals, xG, head-to-head", sources: ["football-data"], core: true },
  { item: "Referee stats (England)", sources: ["football-data"], core: false },
  { item: "European results", sources: ["uefa"], core: true },
  { item: "Fixture, kick-off, venue", sources: ["football-data-fixtures", "premier-league", "uefa", "espn"], core: true },
  { item: "Coach", sources: ["wikipedia", "wikidata"], core: true },
  { item: "Squad by position", sources: ["fpl", "wikipedia-squad"], core: true },
  { item: "Likely XI (Premier League)", sources: ["fpl-starts"], core: false },
  { item: "National teams: results, form, head-to-head", sources: ["international-results"], core: true },
  { item: "National teams: coach, ranking, squad", sources: ["wikipedia-national"], core: true },
  { item: "Injuries (Premier League, official)", sources: ["fpl"], core: true },
  { item: "Injury/team news (other leagues)", sources: ["google-news", "bbc"], core: true },
  { item: "Weather at kick-off", sources: ["open-meteo"], core: false },
  { item: "Stadium location", sources: ["wikidata"], core: false },
  { item: "Lineups", sources: ["premier-league", "uefa", "espn"], core: false },
  { item: "Goal times (Bundesliga)", sources: ["openligadb"], core: false },
  { item: "Domestic cup results", sources: ["cups"], core: false },
  { item: "Club profile, badge", sources: ["thesportsdb"], core: false },
];

async function main() {
  const status = new Map<Check["id"], "live" | "saved" | "down">();
  let failed = 0;
  // One at a time, so a saved copy is credited to the right source.
  const results: string[] = [];
  for (const c of checks) {
    results.push(await (async () => {
      const t0 = Date.now();
      const before = staleLog.length;
      try {
        const r = await c.run();
        const saved = staleLog.slice(before);
        status.set(c.id, saved.length ? "saved" : "live");
        if (saved.length) return ` SAVED ${c.name.padEnd(34)} live source down (${saved[0].error}); serving the copy saved ${saved[0].savedAt.slice(0, 16).replace("T", " ")}`;
        const ageDays = r.newest ? (Date.now() - new Date(r.newest).getTime()) / DAY : null;
        const stale = c.maxAgeDays != null && ageDays != null && ageDays > c.maxAgeDays;
        if (stale) failed++;
        const age = ageDays == null ? "" : ` · newest ${ageDays < 1 ? `${Math.round(ageDays * 24)}h` : `${ageDays.toFixed(1)}d`} ago`;
        return `${stale ? "STALE" : "  OK "}  ${c.name.padEnd(34)} ${r.summary}${age} (${Date.now() - t0}ms)`;
      } catch (e) {
        status.set(c.id, "down");
        return ` FAIL  ${c.name.padEnd(34)} ${e instanceof Error ? e.message : e}`;
      }
    })());
  }
  console.log(results.join("\n"));
  console.log(`\n${[...status.values()].filter((x) => x === "live").length}/${checks.length} sources live${failed ? `, ${failed} with old data` : ""}\n`);

  let coreGaps = 0;
  for (const { item, sources, core } of ITEMS) {
    const from = sources.find((x) => status.get(x) === "live") ?? sources.find((x) => status.get(x) === "saved");
    const how = !from ? "MISSING" : status.get(from) === "live" ? "live" : "saved copy";
    if (!from && core) coreGaps++;
    console.log(`${how === "live" ? "  ✓" : how === "saved copy" ? "  ~" : core ? "  ✗" : "  -"} ${item.padEnd(46)} ${from ? `${from} (${how})` : "no source available"}`);
  }
  console.log(coreGaps ? `\n${coreGaps} core data item(s) unavailable` : "\nCore data: all available");
  process.exit(coreGaps ? 1 : 0);
}

main();
