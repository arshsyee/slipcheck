import type { League, Leg, Slip } from "./types";
import { LEAGUE_INFO } from "./leagues";
import { findTeam, getSchedule } from "./sources/espn";
import { cached, HOUR } from "./sources/cache";

export interface SampleSlip {
  id: string;
  title: string;
  blurb: string;
  slip: Slip;
}

type LegPick = Pick<Leg, "market" | "selection" | "line">;
type PickFn = (home: string, away: string, club: string) => LegPick;

/** Next scheduled match for a club in a competition, as a slip leg. */
async function nextLeg(club: string, league: League, slug: string, pick: PickFn): Promise<Leg | null> {
  const domestic = LEAGUE_INFO[league as keyof typeof LEAGUE_INFO];
  const team = await findTeam(club, [domestic?.fd ? domestic.espn : slug]);
  if (!team) return null;
  const events = await getSchedule(slug, team.id, true);
  const e = events.find((x) => !x.completed && new Date(x.date).getTime() > Date.now());
  if (!e) return null;
  return { league, homeTeam: e.home.name, awayTeam: e.away.name, oddsDecimal: null, ...pick(e.home.name, e.away.name, team.name) };
}

/** Example slips built from each club's real next fixture, refreshed hourly. */
export function getSampleSlips(): Promise<SampleSlip[]> {
  return cached("samples", HOUR, async () => {
    const [ars, rma, inter, bay, city, rmaUcl, bayUcl] = await Promise.all([
      nextLeg("Arsenal", "EPL", "eng.1", (_h, _a, c) => ({ market: "1x2", selection: c, line: null })),
      nextLeg("Real Madrid", "LA_LIGA", "esp.1", () => ({ market: "total_goals", selection: "Over", line: 2.5 })),
      nextLeg("Inter Milan", "SERIE_A", "ita.1", () => ({ market: "btts", selection: "Yes", line: null })),
      nextLeg("Bayern Munich", "BUNDESLIGA", "ger.1", (_h, _a, c) => ({ market: "asian_handicap", selection: c, line: -1.5 })),
      nextLeg("Manchester City", "EPL", "eng.1", () => ({ market: "btts", selection: "Yes", line: null })),
      nextLeg("Real Madrid", "UCL", "uefa.champions", (_h, _a, c) => ({ market: "draw_no_bet", selection: c, line: null })),
      nextLeg("Bayern Munich", "UCL", "uefa.champions", (_h, _a, c) => ({ market: "double_chance", selection: `${c} or Draw`, line: null })),
    ].map((p) => p.catch(() => null)));

    const slip = (legs: (Leg | null)[], sportsbook: string, currency: Slip["currency"], stake: number): Slip => {
      const l = legs.filter((x): x is Leg => x !== null);
      return { sportsbook, currency, stake, betType: l.length > 1 ? "acca" : "single", totalOddsDecimal: null, potentialReturn: null, legs: l };
    };

    return [
      { id: "weekend-acca", title: "Weekend 4-fold", blurb: "Arsenal win, Real Madrid over 2.5, Inter BTTS, Bayern -1.5", slip: slip([ars, rma, inter, bay], "Bet365", "GBP", 10) },
      { id: "city-btts", title: "Man City BTTS", blurb: "Single: both teams to score", slip: slip([city], "Sky Bet", "GBP", 20) },
      { id: "ucl-double", title: "Champions League double", blurb: "Real Madrid draw no bet + Bayern double chance", slip: slip([rmaUcl, bayUcl], "Unibet", "EUR", 10) },
    ].filter((s) => s.slip.legs.length > 0);
  });
}
