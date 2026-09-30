import type { League } from "../types";
import { LEAGUE_INFO } from "../leagues";
import { getFixtures } from "./footballData";
import { getSeasonMatches, openLigaSeason } from "./openLigaDb";
import { getPlUpcoming } from "./premierLeague";
import { getCompetitionMatches, UEFA_COMPETITIONS } from "./uefa";
import { getUpcomingCupTies } from "./cups";
import { bestTeamMatch } from "../teams/match";

export interface UpcomingMatch {
  date: string;
  competition: string;
  opponent: string;
  venue: "home" | "away";
}

/** UEFA's id for the Nations League in its match API. */
const NATIONS_LEAGUE = { id: 2014, name: "UEFA Nations League" };

/**
 * A team's scheduled matches from every free fixture list we have, soonest first.
 * Clubs: UEFA competitions, their league (Premier League site, OpenLigaDB, football-data.co.uk's next round) and cups.
 * National teams: the Nations League (UEFA). Other fixtures may exist that no free source lists.
 */
export async function getUpcomingMatches(team: string, domestic: League | null, national: boolean): Promise<UpcomingMatch[]> {
  const now = Date.now();
  const info = domestic ? LEAGUE_INFO[domestic as keyof typeof LEAGUE_INFO] : null;
  const pools: { competition: string; matches: { date: string; home: string; away: string }[] }[] = [];
  const add = async (competition: string, load: () => Promise<{ date: string; home: string; away: string }[]>) => {
    pools.push({ competition, matches: await load().catch(() => []) });
  };

  const uefa = national ? [NATIONS_LEAGUE] : UEFA_COMPETITIONS;
  await Promise.all([
    ...uefa.map((c) =>
      add(c.name, async () => (await getCompetitionMatches(c.id)).filter((m) => m.status !== "FINISHED").map((m) => ({ date: m.kickoff, home: m.home, away: m.away }))),
    ),
    ...(national || !info
      ? []
      : [
          domestic === "EPL"
            ? add(info.label, async () => (await getPlUpcoming(team)).filter((f) => f.kickoff).map((f) => ({ date: f.kickoff!, home: f.home, away: f.away })))
            : Promise.resolve(),
          info.openLigaDb
            ? add(info.label, async () => (await getSeasonMatches(info.openLigaDb!, openLigaSeason())).filter((m) => !m.finished).map((m) => ({ date: m.kickoff, home: m.home, away: m.away })))
            : Promise.resolve(),
          info.fd ? add(info.label, async () => (await getFixtures()).filter((f) => f.div === info.fd).map((f) => ({ date: f.kickoff, home: f.home, away: f.away }))) : Promise.resolve(),
          (async () => {
            const ties = await getUpcomingCupTies(info.country).catch(() => []);
            for (const c of new Set(ties.map((t) => t.competition))) pools.push({ competition: c, matches: ties.filter((t) => t.competition === c) });
          })(),
        ]),
  ]);

  const out: UpcomingMatch[] = [];
  for (const { competition, matches } of pools) {
    // Each list spells clubs its own way; match closely (0.8) so a similarly named club never stands in.
    const hit = bestTeamMatch(team, [...new Set(matches.flatMap((m) => [m.home, m.away]))], 0.8)?.name;
    if (!hit) continue;
    for (const m of matches) {
      if (new Date(m.date).getTime() <= now || (m.home !== hit && m.away !== hit)) continue;
      out.push({ date: m.date, competition, opponent: m.home === hit ? m.away : m.home, venue: m.home === hit ? "home" : "away" });
    }
  }
  // The same match can come from two lists (Premier League site and football-data.co.uk): one per day.
  const byDay = new Map<string, UpcomingMatch>();
  for (const m of out.sort((a, b) => a.date.localeCompare(b.date))) if (!byDay.has(m.date.slice(0, 10))) byDay.set(m.date.slice(0, 10), m);
  return [...byDay.values()];
}
