import type { League, Leg, Slip } from "./types";
import { LEAGUE_INFO } from "./leagues";
import { cached, HOUR } from "./sources/cache";
import { getNextMatch } from "./sources/sportsDb";
import { getCompetitionMatches } from "./sources/uefa";
import { bestTeamMatch, teamScore } from "./teams/match";

export interface SampleSlip {
  id: string;
  title: string;
  blurb: string;
  slip: Slip;
}

type LegPick = Pick<Leg, "market" | "selection" | "line">;
type PickFn = (home: string, away: string, club: string) => LegPick;

/**
 * A club's real next match as a slip leg. League legs: TheSportsDB (next match, only if it's in that league).
 * Champions League legs: UEFA's own fixture list. No ESPN, so samples survive its outages.
 */
async function nextLeg(club: string, league: League, pick: PickFn): Promise<Leg | null> {
  if (league === "UCL") {
    const upcoming = (await getCompetitionMatches(1)).filter((m) => m.status !== "FINISHED" && new Date(m.kickoff).getTime() > Date.now());
    const hit = bestTeamMatch(club, [...new Set(upcoming.flatMap((m) => [m.home, m.away]))]);
    const m = hit && upcoming.find((x) => x.home === hit.name || x.away === hit.name);
    return m ? { league, homeTeam: m.home, awayTeam: m.away, oddsDecimal: null, ...pick(m.home, m.away, hit!.name) } : null;
  }
  const m = await getNextMatch(club);
  const label = LEAGUE_INFO[league as keyof typeof LEAGUE_INFO]?.label ?? "";
  // The club's next match may be a cup or European game; only use it if it's in this league.
  if (!m || new Date(m.kickoff).getTime() < Date.now() || !m.league || !sameLeague(m.league, label)) return null;
  const mine = teamScore(club, m.home) >= teamScore(club, m.away) ? m.home : m.away;
  return { league, homeTeam: m.home, awayTeam: m.away, oddsDecimal: null, ...pick(m.home, m.away, mine) };
}

/** "English Premier League" vs "Premier League", "Spanish La Liga" vs "La Liga", "German Bundesliga" vs "Bundesliga". */
const sameLeague = (theirs: string, ours: string) => ours.length > 0 && theirs.toLowerCase().includes(ours.toLowerCase());

/** Example slips built from each club's real next fixture, refreshed hourly. */
export function getSampleSlips(): Promise<SampleSlip[]> {
  return cached("samples:v2", HOUR, async () => {
    const [ars, rma, inter, bay, city, rmaUcl, bayUcl] = await Promise.all([
      nextLeg("Arsenal", "EPL", (_h, _a, c) => ({ market: "1x2", selection: c, line: null })),
      nextLeg("Real Madrid", "LA_LIGA", () => ({ market: "total_goals", selection: "Over", line: 2.5 })),
      nextLeg("Inter Milan", "SERIE_A", () => ({ market: "btts", selection: "Yes", line: null })),
      nextLeg("Bayern Munich", "BUNDESLIGA", (_h, _a, c) => ({ market: "asian_handicap", selection: c, line: -1.5 })),
      nextLeg("Manchester City", "EPL", () => ({ market: "btts", selection: "Yes", line: null })),
      nextLeg("Real Madrid", "UCL", (_h, _a, c) => ({ market: "draw_no_bet", selection: c, line: null })),
      nextLeg("Bayern Munich", "UCL", (_h, _a, c) => ({ market: "double_chance", selection: `${c} or Draw`, line: null })),
    ].map((p) => p.catch(() => null)));

    const slip = (legs: (Leg | null)[]): Slip => {
      return { legs: legs.filter((x): x is Leg => x !== null) };
    };

    return [
      { id: "weekend-acca", title: "Weekend 4-fold", blurb: "Arsenal win, Real Madrid over 2.5, Inter BTTS, Bayern -1.5", slip: slip([ars, rma, inter, bay]) },
      { id: "city-btts", title: "Man City BTTS", blurb: "Single: both teams to score", slip: slip([city]) },
      { id: "ucl-double", title: "Champions League double", blurb: "Real Madrid draw no bet + Bayern double chance", slip: slip([rmaUcl, bayUcl]) },
    ].filter((s) => s.slip.legs.length > 0);
  });
}
