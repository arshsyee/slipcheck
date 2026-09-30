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

/** A national team's real next match (any competition). */
async function nextInternational(team: string, pick: PickFn): Promise<Leg | null> {
  const m = await getNextMatch(team);
  if (!m || new Date(m.kickoff).getTime() < Date.now()) return null;
  const mine = teamScore(team, m.home) >= teamScore(team, m.away) ? m.home : m.away;
  return { league: "OTHER", homeTeam: m.home, awayTeam: m.away, oddsDecimal: null, ...pick(m.home, m.away, mine) };
}

const win: PickFn = (_h, _a, c) => ({ market: "1x2", selection: c, line: null });
const over = (market: "total_goals" | "total_corners" | "total_cards", line: number): PickFn => () => ({ market, selection: "Over", line });
const btts: PickFn = () => ({ market: "btts", selection: "Yes", line: null });

/**
 * Example slips from each club's real next fixture, refreshed hourly. No odds: we don't make prices up.
 * The blurb lists the matches actually found, so a sample never promises a leg it doesn't have.
 */
export function getSampleSlips(): Promise<SampleSlip[]> {
  return cached("samples:v4", HOUR, async () => {
    const legs = await Promise.all(
      [
        nextLeg("Liverpool", "EPL", win),
        nextLeg("Barcelona", "LA_LIGA", win),
        nextLeg("Juventus", "SERIE_A", win),
        nextLeg("Chelsea", "EPL", over("total_goals", 2.5)),
        nextLeg("Inter Milan", "SERIE_A", btts),
        nextLeg("Borussia Dortmund", "BUNDESLIGA", over("total_goals", 2.5)),
        nextLeg("Arsenal", "EPL", over("total_corners", 9.5)),
        nextLeg("Real Madrid", "LA_LIGA", over("total_cards", 3.5)),
        nextLeg("Bayern Munich", "BUNDESLIGA", over("total_corners", 10.5)),
        nextLeg("Real Madrid", "UCL", (_h, _a, c) => ({ market: "draw_no_bet", selection: c, line: null })),
        nextLeg("Paris Saint-Germain", "UCL", (_h, _a, c) => ({ market: "double_chance", selection: `${c} or Draw`, line: null })),
        nextInternational("England", win),
        nextInternational("Brazil", btts),
        nextLeg("Manchester United", "EPL", (_h, _a, c) => ({ market: "asian_handicap", selection: c, line: -1 })),
      ].map((p) => p.catch(() => null)),
    );
    const [liv, bar, juv, che, inter, bvb, ars, rma, bay, rmaUcl, psg, eng, bra, mun] = legs;

    const sample = (id: string, title: string, picks: (Leg | null)[]): SampleSlip => {
      const found = picks.filter((x): x is Leg => x !== null);
      return { id, title, blurb: found.map((l) => `${l.homeTeam} v ${l.awayTeam}`).join(" · "), slip: { legs: found } };
    };

    return [
      sample("treble", "Big-club treble", [liv, bar, juv]),
      sample("goals", "Goals & both teams", [che, inter, bvb]),
      sample("corners-cards", "Corners & cards", [ars, rma, bay]),
      sample("ucl", "Champions League", [rmaUcl, psg]),
      sample("internationals", "Internationals", [eng, bra]),
      sample("handicap", "Single: win by a margin", [mun]),
    ].filter((s) => s.slip.legs.length > 0);
  });
}
