import { z } from "zod";
import { cached, MINUTE } from "./cache";
import { fetchJson } from "./http";
import { bestTeamMatch } from "../teams/match";

export interface BundesligaGoal {
  minute: number | null;
  scorer: string;
  penalty: boolean;
  ownGoal: boolean;
  forTeam: "home" | "away";
}

export interface BundesligaMatch {
  id: number;
  kickoff: string;
  home: string;
  away: string;
  finished: boolean;
  score: [number, number] | null;
  goals: BundesligaGoal[];
}

const MatchSchema = z.object({
  matchID: z.number(),
  matchDateTimeUTC: z.string(),
  matchIsFinished: z.boolean(),
  team1: z.object({ teamName: z.string() }),
  team2: z.object({ teamName: z.string() }),
  matchResults: z.array(z.object({ resultTypeID: z.number(), pointsTeam1: z.number(), pointsTeam2: z.number() })),
  goals: z.array(
    z.object({
      scoreTeam1: z.number().nullable(),
      scoreTeam2: z.number().nullable(),
      matchMinute: z.number().nullable(),
      goalGetterName: z.string().nullable(),
      isPenalty: z.boolean().nullable().optional(),
      isOwnGoal: z.boolean().nullable().optional(),
    }),
  ),
});

/** OpenLigaDB season: "2026" = 2026/27. */
export function openLigaSeason(date = new Date()) {
  return date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

export function getSeasonMatches(league: string, season = openLigaSeason()): Promise<BundesligaMatch[]> {
  const url = `https://api.openligadb.de/getmatchdata/${league}/${season}`;
  return cached(`openligadb:${url}`, 15 * MINUTE, async () => {
    const d = await fetchJson(url, z.array(MatchSchema));
    return d.map((m) => {
      const final = m.matchResults.find((r) => r.resultTypeID === 2);
      let prev: [number, number] = [0, 0];
      const goals = [...m.goals]
        .sort((a, b) => (a.matchMinute ?? 0) - (b.matchMinute ?? 0))
        .map((g) => {
          const now: [number, number] = [g.scoreTeam1 ?? prev[0], g.scoreTeam2 ?? prev[1]];
          const forTeam: "home" | "away" = now[0] > prev[0] ? "home" : "away";
          prev = now;
          return {
            minute: g.matchMinute,
            scorer: g.goalGetterName ?? "Unknown",
            penalty: Boolean(g.isPenalty),
            ownGoal: Boolean(g.isOwnGoal),
            forTeam,
          };
        });
      return {
        id: m.matchID,
        kickoff: m.matchDateTimeUTC,
        home: m.team1.teamName,
        away: m.team2.teamName,
        finished: m.matchIsFinished,
        score: final ? [final.pointsTeam1, final.pointsTeam2] : null,
        goals,
      };
    });
  });
}

export interface ScorerLine {
  player: string;
  goals: number;
}

export interface GoalTiming {
  /** Goals scored per 15-minute window: 1-15, 16-30, 31-45+, 46-60, 61-75, 76-90+. */
  scored: number[];
  conceded: number[];
}

/** Bundesliga-only extras for one club: top scorers this season and when its goals come. */
export async function getClubGoalProfile(league: string, club: string) {
  const matches = (await getSeasonMatches(league)).filter((m) => m.finished);
  const name = bestTeamMatch(club, [...new Set(matches.flatMap((m) => [m.home, m.away]))])?.name;
  const mine = matches.filter((m) => m.home === name || m.away === name);
  if (!name || !mine.length) return null;

  const scorers = new Map<string, number>();
  const timing: GoalTiming = { scored: Array(6).fill(0), conceded: Array(6).fill(0) };
  for (const m of mine) {
    const side = m.home === name ? "home" : "away";
    for (const g of m.goals) {
      const bucket = Math.min(5, Math.max(0, Math.floor(((g.minute ?? 1) - 1) / 15)));
      if (g.forTeam === side) {
        timing.scored[bucket]++;
        if (!g.ownGoal) scorers.set(g.scorer, (scorers.get(g.scorer) ?? 0) + 1);
      } else timing.conceded[bucket]++;
    }
  }
  const topScorers: ScorerLine[] = [...scorers]
    .map(([player, goals]) => ({ player, goals }))
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 5);
  return { matches: mine.length, topScorers, timing };
}
