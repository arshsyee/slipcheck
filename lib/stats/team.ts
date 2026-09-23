import type { MatchRow } from "../sources/footballData";
import { bestTeamMatch } from "../teams/match";

export type Venue = "all" | "home" | "away";

/** One match from a club's point of view. */
export interface TeamGame {
  kickoff: string;
  opponent: string;
  venue: "home" | "away";
  gf: number;
  ga: number;
  htgf: number | null;
  htga: number | null;
  xgf: number | null;
  xga: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  cornersAgainst: number | null;
  yellows: number | null;
  reds: number | null;
  result: "W" | "D" | "L";
  referee: string | null;
}

/** The club's name as football-data.co.uk spells it in these rows ("Man United"), or null. */
export function resolveName(club: string, rows: MatchRow[]): string | null {
  const names = [...new Set(rows.flatMap((r) => [r.home, r.away]))];
  return bestTeamMatch(club, names, 0.6)?.name ?? null;
}

export function gamesFor(rows: MatchRow[], name: string, venue: Venue = "all"): TeamGame[] {
  return rows
    .filter((r) => (venue !== "away" && r.home === name) || (venue !== "home" && r.away === name))
    .map((r) => {
      const home = r.home === name;
      const gf = home ? r.fthg : r.ftag;
      const ga = home ? r.ftag : r.fthg;
      return {
        kickoff: r.kickoff,
        opponent: home ? r.away : r.home,
        venue: home ? ("home" as const) : ("away" as const),
        gf,
        ga,
        htgf: home ? r.hthg : r.htag,
        htga: home ? r.htag : r.hthg,
        xgf: home ? r.hxg : r.axg,
        xga: home ? r.axg : r.hxg,
        shots: home ? r.hs : r.as,
        shotsOnTarget: home ? r.hst : r.ast,
        corners: home ? r.hc : r.ac,
        cornersAgainst: home ? r.ac : r.hc,
        yellows: home ? r.hy : r.ay,
        reds: home ? r.hr : r.ar,
        result: gf > ga ? ("W" as const) : gf < ga ? ("L" as const) : ("D" as const),
        referee: r.referee,
      };
    })
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff));
}

export interface FormSummary {
  games: TeamGame[];
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export function form(games: TeamGame[], n: number): FormSummary {
  const g = games.slice(0, n);
  const count = (r: TeamGame["result"]) => g.filter((x) => x.result === r).length;
  const won = count("W");
  const drawn = count("D");
  return {
    games: g,
    won,
    drawn,
    lost: count("L"),
    goalsFor: sum(g.map((x) => x.gf)),
    goalsAgainst: sum(g.map((x) => x.ga)),
    points: won * 3 + drawn,
  };
}

export interface Averages {
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  xgFor: number | null;
  xgAgainst: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  cornersAgainst: number | null;
  yellows: number | null;
  reds: number | null;
}

/** Per-game averages; stat averages only use games where that stat was recorded. */
export function averages(games: TeamGame[]): Averages {
  return {
    played: games.length,
    goalsFor: avg(games.map((g) => g.gf)) ?? 0,
    goalsAgainst: avg(games.map((g) => g.ga)) ?? 0,
    xgFor: avg(games.map((g) => g.xgf)),
    xgAgainst: avg(games.map((g) => g.xga)),
    shots: avg(games.map((g) => g.shots)),
    shotsOnTarget: avg(games.map((g) => g.shotsOnTarget)),
    corners: avg(games.map((g) => g.corners)),
    cornersAgainst: avg(games.map((g) => g.cornersAgainst)),
    yellows: avg(games.map((g) => g.yellows)),
    reds: avg(games.map((g) => g.reds)),
  };
}

export interface Rates {
  played: number;
  btts: number;
  over15: number;
  over25: number;
  over35: number;
  cleanSheets: number;
  failedToScore: number;
  scoredFirstHalf: number | null;
  /** Final goal difference from the club's side, bucketed: ≤-2, -1, 0, +1, ≥+2. */
  margins: { le_m2: number; m1: number; zero: number; p1: number; ge_p2: number };
}

/** Rates are fractions 0..1 of games played. */
export function rates(games: TeamGame[]): Rates {
  const n = games.length || 1;
  const frac = (f: (g: TeamGame) => boolean) => games.filter(f).length / n;
  const withHt = games.filter((g) => g.htgf != null);
  const diff = (g: TeamGame) => g.gf - g.ga;
  return {
    played: games.length,
    btts: frac((g) => g.gf > 0 && g.ga > 0),
    over15: frac((g) => g.gf + g.ga > 1.5),
    over25: frac((g) => g.gf + g.ga > 2.5),
    over35: frac((g) => g.gf + g.ga > 3.5),
    cleanSheets: frac((g) => g.ga === 0),
    failedToScore: frac((g) => g.gf === 0),
    scoredFirstHalf: withHt.length ? withHt.filter((g) => (g.htgf ?? 0) > 0).length / withHt.length : null,
    margins: {
      le_m2: games.filter((g) => diff(g) <= -2).length,
      m1: games.filter((g) => diff(g) === -1).length,
      zero: games.filter((g) => diff(g) === 0).length,
      p1: games.filter((g) => diff(g) === 1).length,
      ge_p2: games.filter((g) => diff(g) >= 2).length,
    },
  };
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function avg(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? round(sum(v) / v.length, 2) : null;
}

export const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
