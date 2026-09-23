import type { MatchRow } from "../sources/footballData";
import type { EspnEvent, StandingRow } from "../sources/espn";
import type { League } from "../types";
import { computeTable } from "./table";
import { gamesFor, round, type TeamGame } from "./team";

export interface Split {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  ppg: number | null;
}

export function split(games: { gf: number; ga: number }[]): Split {
  const won = games.filter((g) => g.gf > g.ga).length;
  const drawn = games.filter((g) => g.gf === g.ga).length;
  return {
    played: games.length,
    won,
    drawn,
    lost: games.length - won - drawn,
    goalsFor: games.reduce((s, g) => s + g.gf, 0),
    goalsAgainst: games.reduce((s, g) => s + g.ga, 0),
    ppg: games.length ? round((won * 3 + drawn) / games.length) : null,
  };
}

export interface LeagueSeason {
  table: StandingRow;
  ppg: number | null;
  home: Split;
  away: Split;
  /** Season totals; null when some games have no xG. */
  xgFor: number | null;
  xgAgainst: number | null;
  /** Goals scored minus xG: positive = finishing above chances created. */
  goalsMinusXg: number | null;
  /** xG conceded minus goals conceded: positive = conceding fewer than chances allowed. */
  xgaMinusGoalsAgainst: number | null;
  /** League position after each of the club's games, oldest first. */
  positionByRound: { date: string; position: number }[];
}

/** The club's domestic league season so far. `fdName` is the football-data.co.uk spelling. */
export function leagueSeason(rows: MatchRow[], fdName: string, league: League, deductions: Map<string, number>): LeagueSeason | null {
  const table = computeTable(rows, league, deductions);
  const row = table.find((r) => r.team === fdName);
  if (!row) return null;
  const games = gamesFor(rows, fdName);
  const withXg = games.filter((g) => g.xgf != null && g.xga != null);
  const fullXg = withXg.length === games.length && games.length > 0;
  const xgFor = fullXg ? round(withXg.reduce((s, g) => s + g.xgf!, 0)) : null;
  const xgAgainst = fullXg ? round(withXg.reduce((s, g) => s + g.xga!, 0)) : null;

  // Position after each of the club's games: table from every match up to that kick-off.
  const sorted = [...rows].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const positionByRound = [...games]
    .reverse()
    .map((g) => {
      const upTo = sorted.filter((r) => r.kickoff <= g.kickoff);
      const pos = computeTable(upTo, league, deductions).findIndex((r) => r.team === fdName) + 1;
      return { date: g.kickoff, position: pos };
    });

  return {
    table: row,
    ppg: row.played ? round(row.points / row.played) : null,
    home: split(games.filter((g) => g.venue === "home")),
    away: split(games.filter((g) => g.venue === "away")),
    xgFor,
    xgAgainst,
    goalsMinusXg: xgFor != null ? round(row.goalsFor - xgFor) : null,
    xgaMinusGoalsAgainst: xgAgainst != null ? round(xgAgainst - row.goalsAgainst) : null,
    positionByRound,
  };
}

export interface SameStageLastSeason {
  division: string;
  played: number;
  points: number;
  position: number;
}

/** Where the club was after the same number of games last season (in whichever division it played). */
export function sameStageLastSeason(lastSeasonRows: MatchRow[], fdName: string, gamesPlayed: number, league: League, division: string): SameStageLastSeason | null {
  const games = gamesFor(lastSeasonRows, fdName).reverse().slice(0, gamesPlayed);
  if (!games.length) return null;
  const cutoff = games.at(-1)!.kickoff;
  const upTo = lastSeasonRows.filter((r) => r.kickoff <= cutoff);
  const s = split(games);
  return {
    division,
    played: games.length,
    points: s.won * 3 + s.drawn,
    position: computeTable(upTo, league).findIndex((r) => r.team === fdName) + 1,
  };
}

export interface CompetitionRun {
  competition: string;
  record: Split;
  results: { date: string; opponent: string; venue: "home" | "away"; score: string; result: "W" | "D" | "L" }[];
}

/** Results outside the domestic league this season (Europe, cups), grouped by competition. */
export function otherCompetitions(events: EspnEvent[], teamId: string, domesticSlug: string): CompetitionRun[] {
  const byComp = new Map<string, EspnEvent[]>();
  for (const e of events) {
    if (!e.completed || e.slug === domesticSlug) continue;
    byComp.set(e.competition, [...(byComp.get(e.competition) ?? []), e]);
  }
  return [...byComp].map(([competition, evs]) => {
    const games = evs
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((e) => {
        const home = e.home.id === teamId;
        const gf = (home ? e.home.score : e.away.score) ?? 0;
        const ga = (home ? e.away.score : e.home.score) ?? 0;
        return {
          date: e.date,
          opponent: home ? e.away.name : e.home.name,
          venue: home ? ("home" as const) : ("away" as const),
          score: `${gf}-${ga}`,
          result: gf > ga ? ("W" as const) : gf < ga ? ("L" as const) : ("D" as const),
          gf,
          ga,
        };
      });
    return { competition, record: split(games), results: games.map((g) => ({ date: g.date, opponent: g.opponent, venue: g.venue, score: g.score, result: g.result })) };
  });
}

export interface CoachRecord {
  /** All competitions this season since the coach arrived (ESPN). */
  allCompsThisSeason: Split & { results: { date: string; competition: string; opponent: string; score: string; result: "W" | "D" | "L" }[] };
  /** Domestic league games in charge, within the seasons we have (football-data.co.uk, up to 5 seasons). */
  league: (Split & { xgForPg: number | null; xgAgainstPg: number | null; from: string }) | null;
  /** League this season before they arrived, when they took over mid-season. */
  leagueBeforeThisSeason: Split | null;
}

/** Form since the coach's appointment date. */
export function coachRecord(
  since: string,
  espnEvents: EspnEvent[],
  teamId: string,
  leagueGames: TeamGame[],
  seasonStartIso: string,
): CoachRecord {
  const mine = espnEvents
    .filter((e) => e.completed && e.date >= since)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => {
      const home = e.home.id === teamId;
      const gf = (home ? e.home.score : e.away.score) ?? 0;
      const ga = (home ? e.away.score : e.home.score) ?? 0;
      return { date: e.date, competition: e.competition, opponent: home ? e.away.name : e.home.name, gf, ga, score: `${gf}-${ga}`, result: gf > ga ? ("W" as const) : gf < ga ? ("L" as const) : ("D" as const) };
    });
  const inCharge = leagueGames.filter((g) => g.kickoff >= since);
  const xgGames = inCharge.filter((g) => g.xgf != null && g.xga != null);
  const before = leagueGames.filter((g) => g.kickoff < since && g.kickoff >= seasonStartIso);
  return {
    allCompsThisSeason: { ...split(mine), results: mine.map((g) => ({ date: g.date, competition: g.competition, opponent: g.opponent, score: g.score, result: g.result })) },
    league: inCharge.length
      ? {
          ...split(inCharge),
          xgForPg: xgGames.length ? round(xgGames.reduce((s, g) => s + g.xgf!, 0) / xgGames.length) : null,
          xgAgainstPg: xgGames.length ? round(xgGames.reduce((s, g) => s + g.xga!, 0) / xgGames.length) : null,
          from: inCharge.at(-1)!.kickoff,
        }
      : null,
    leagueBeforeThisSeason: since > seasonStartIso && before.length ? split(before) : null,
  };
}
