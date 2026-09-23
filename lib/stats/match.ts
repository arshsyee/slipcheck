import type { MatchRow } from "../sources/footballData";
import { normalize } from "../teams/match";
import { avg, round } from "./team";

export interface H2HMeeting {
  kickoff: string;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
}

export interface HeadToHead {
  meetings: H2HMeeting[];
  /** From the perspective of `a` (the slip's home team). */
  aWins: number;
  draws: number;
  bWins: number;
  avgGoals: number | null;
  btts: number;
  over25: number;
}

/** Meetings between two clubs (football-data.co.uk spellings) in the supplied rows, newest first. */
export function headToHead(rows: MatchRow[], a: string, b: string, limit = 10): HeadToHead {
  const meetings = rows
    .filter((r) => (r.home === a && r.away === b) || (r.home === b && r.away === a))
    .sort((x, y) => y.kickoff.localeCompare(x.kickoff))
    .slice(0, limit)
    .map((r) => ({ kickoff: r.kickoff, home: r.home, away: r.away, homeGoals: r.fthg, awayGoals: r.ftag }));
  const aGoals = (m: H2HMeeting) => (m.home === a ? m.homeGoals : m.awayGoals);
  const bGoals = (m: H2HMeeting) => (m.home === a ? m.awayGoals : m.homeGoals);
  return {
    meetings,
    aWins: meetings.filter((m) => aGoals(m) > bGoals(m)).length,
    draws: meetings.filter((m) => aGoals(m) === bGoals(m)).length,
    bWins: meetings.filter((m) => aGoals(m) < bGoals(m)).length,
    avgGoals: avg(meetings.map((m) => m.homeGoals + m.awayGoals)),
    btts: meetings.filter((m) => m.homeGoals > 0 && m.awayGoals > 0).length,
    over25: meetings.filter((m) => m.homeGoals + m.awayGoals > 2.5).length,
  };
}

export interface RefereeStats {
  name: string;
  games: number;
  yellowsPerGame: number | null;
  redsPerGame: number | null;
  foulsPerGame: number | null;
  homeWinRate: number;
  over25Rate: number;
}

/** "M Oliver" (football-data.co.uk) and "Michael Oliver" (ESPN) are the same referee. */
export function sameReferee(a: string, b: string): boolean {
  const pa = normalize(a).split(" ");
  const pb = normalize(b).split(" ");
  if (pa.at(-1) !== pb.at(-1)) return false;
  return pa[0][0] === pb[0][0];
}

export function refereeStats(rows: MatchRow[], referee: string): RefereeStats | null {
  const games = rows.filter((r) => r.referee && sameReferee(r.referee, referee));
  if (!games.length) return null;
  const perGame = (f: (r: MatchRow) => number | null) => {
    const v = games.map(f).filter((x): x is number => x != null);
    return v.length ? round(v.reduce((s, x) => s + x, 0) / v.length) : null;
  };
  return {
    name: games[0].referee!,
    games: games.length,
    yellowsPerGame: perGame((r) => (r.hy == null || r.ay == null ? null : r.hy + r.ay)),
    redsPerGame: perGame((r) => (r.hr == null || r.ar == null ? null : r.hr + r.ar)),
    foulsPerGame: perGame((r) => (r.hf == null || r.af == null ? null : r.hf + r.af)),
    homeWinRate: games.filter((r) => r.fthg > r.ftag).length / games.length,
    over25Rate: games.filter((r) => r.fthg + r.ftag > 2.5).length / games.length,
  };
}

/** Days between a club's previous match (any competition) and kick-off. */
export function restDays(previousMatchIso: string | null | undefined, kickoffIso: string): number | null {
  if (!previousMatchIso) return null;
  return Math.floor((new Date(kickoffIso).getTime() - new Date(previousMatchIso).getTime()) / 86_400_000);
}
