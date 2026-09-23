/**
 * Live health + freshness check for every data source.   npm run check-sources
 * Exits non-zero if any source fails or its newest data is older than its freshness budget.
 */
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
  name: string;
  /** Returns a one-line summary and the timestamp of the newest item (null = timeless data). */
  run: () => Promise<{ summary: string; newest: string | null }>;
  /** Max age of the newest item. International breaks can pause leagues for ~2 weeks. */
  maxAgeDays?: number;
}

const latest = (dates: (string | null | undefined)[]) => dates.filter(Boolean).sort().at(-1) ?? null;

const checks: Check[] = [
  {
    name: "football-data.co.uk results (EPL)",
    maxAgeDays: 21,
    run: async () => {
      const rows = await getSeason("E0");
      const xg = rows.filter((r) => r.hxg != null).length;
      return { summary: `${rows.length} matches, ${xg} with xG`, newest: latest(rows.map((r) => r.kickoff)) };
    },
  },
  {
    name: "football-data.co.uk fixtures",
    run: async () => {
      const all = await getFixtures();
      const f = all.filter((x) => new Date(x.kickoff).getTime() > Date.now());
      const divs = new Set(f.map((x) => x.div)).size;
      // The file is published a few days before each round, so it's often empty during breaks; ESPN/PL/UEFA cover that.
      return { summary: `${f.length} of ${all.length} listed are upcoming (${divs} divisions)`, newest: null };
    },
  },
  {
    name: "ESPN standings + results",
    maxAgeDays: 21,
    run: async () => {
      const table = await getStandings("eng.1");
      const team = await findTeam("Arsenal", ["eng.1"]);
      const results = team ? await getRecentResults("eng.1", team.id) : [];
      return { summary: `table ${table.length} rows, Arsenal ${results.length} results`, newest: results[0]?.date ?? null };
    },
  },
  {
    name: "OpenLigaDB (Bundesliga)",
    maxAgeDays: 21,
    run: async () => {
      const m = (await getSeasonMatches("bl1")).filter((x) => x.finished);
      return { summary: `${m.length} finished, ${m.reduce((n, x) => n + x.goals.length, 0)} goals logged`, newest: latest(m.map((x) => x.kickoff)) };
    },
  },
  {
    name: "Open-Meteo forecast",
    run: async () => {
      const w = await getKickoffWeather(51.555, -0.108, new Date(Date.now() + 2 * DAY).toISOString());
      if (!w) throw new Error("no forecast returned");
      return { summary: `${w.summary}, ${w.tempC}°C, wind ${w.windKmh} km/h`, newest: null };
    },
  },
  {
    name: "Wikidata (stadium)",
    run: async () => {
      const f = await getClubFacts("Arsenal", "England");
      if (!f?.lat) throw new Error("no stadium coordinates");
      return { summary: `${f.stadium}, cap ${f.capacity}, founded ${f.founded}`, newest: null };
    },
  },
  {
    name: "BBC Sport RSS",
    maxAgeDays: 7,
    run: async () => {
      const h = await getBbcClubNews("Arsenal");
      return { summary: `${h.length} headlines`, newest: latest(h.map((x) => x.published)) };
    },
  },
  {
    name: "Google News RSS",
    maxAgeDays: 7,
    run: async () => {
      const h = await getGoogleClubNews("Real Madrid");
      return { summary: `${h.length} headlines`, newest: latest(h.map((x) => x.published)) };
    },
  },
  {
    name: "TheSportsDB",
    run: async () => {
      const p = await getClubProfile("Bayern Munich");
      if (!p) throw new Error("club not found");
      return { summary: `${p.name}, ${p.stadium}`, newest: null };
    },
  },
  {
    name: "Fantasy Premier League",
    run: async () => {
      const t = await getFplTeam("Arsenal");
      if (!t) throw new Error("team not found");
      return { summary: `${t.availability.length} flagged, top xG+xA ${t.keyPlayers[0]?.player}`, newest: latest(t.availability.map((a) => a.since)) };
    },
  },
  {
    name: "Premier League (pulselive)",
    run: async () => {
      const f = await findPlFixture("Arsenal", null);
      if (!f) throw new Error("no upcoming fixture");
      return { summary: `next: ${f.home} v ${f.away} at ${f.ground}`, newest: null };
    },
  },
  {
    name: "UEFA match API",
    run: async () => {
      const m = await getCompetitionMatches(1);
      const next = m.find((x) => x.status !== "FINISHED");
      return { summary: `${m.length} UCL matches, next ${next?.home} v ${next?.away}`, newest: latest(m.filter((x) => x.status === "FINISHED").map((x) => x.kickoff)) };
    },
  },
];

async function main() {
  let failed = 0;
  const results = await Promise.all(
    checks.map(async (c) => {
      const t0 = Date.now();
      try {
        const r = await c.run();
        const ageDays = r.newest ? (Date.now() - new Date(r.newest).getTime()) / DAY : null;
        const stale = c.maxAgeDays != null && ageDays != null && ageDays > c.maxAgeDays;
        if (stale) failed++;
        const age = ageDays == null ? "" : ` · newest ${ageDays < 1 ? `${Math.round(ageDays * 24)}h` : `${ageDays.toFixed(1)}d`} ago`;
        return `${stale ? "STALE" : "  OK "}  ${c.name.padEnd(34)} ${r.summary}${age} (${Date.now() - t0}ms)`;
      } catch (e) {
        failed++;
        return ` FAIL  ${c.name.padEnd(34)} ${e instanceof Error ? e.message : e}`;
      }
    }),
  );
  console.log(results.join("\n"));
  console.log(`\n${checks.length - failed}/${checks.length} sources healthy`);
  process.exit(failed ? 1 : 0);
}

main();
