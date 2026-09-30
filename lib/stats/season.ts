import type { MatchRow } from "../sources/footballData";
import type { StandingRow } from "./table";
import type { League } from "../types";
import { computeTable } from "./table";
import { gamesFor, round, type TeamGame } from "./team";

/** A played or scheduled match in any competition, from our own club's point of view (`id` = our club's id). */
export interface MatchEvent {
  id: string;
  date: string;
  completed: boolean;
  competition: string;
  slug: string;
  venue: string | null;
  home: { id: string; name: string; score: number | null };
  away: { id: string; name: string; score: number | null };
}

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
  /** What's at stake: points gaps to the places that matter, and what's left to play. */
  stakes: Stakes;
}

export interface Stakes {
  /** Points behind 1st (0 = top). When top: lead over 2nd. */
  toFirst: number;
  leadOverSecond: number | null;
  /** Points behind 4th, or ahead of 5th when in the top four. */
  behindFourth: number | null;
  aheadOfFifth: number | null;
  /** First place that goes down automatically, e.g. 18 in a 20-team league. */
  relegationPlace: number;
  /** Points above that place, or below the last safe place when in it. */
  aboveRelegation: number | null;
  belowSafety: number | null;
  gamesLeft: number;
}

/** Automatic relegation places (Germany and France also have a play-off place above these). */
const RELEGATED: Partial<Record<League, number>> = { EPL: 3, LA_LIGA: 3, SERIE_A: 3, BUNDESLIGA: 2, LIGUE_1: 2 };

export function stakes(table: StandingRow[], team: string, league: League): Stakes {
  const row = table.find((r) => r.team === team)!;
  const at = (rank: number) => table[rank - 1]?.points ?? 0;
  const relegationPlace = table.length - (RELEGATED[league] ?? 3) + 1;
  return {
    toFirst: at(1) - row.points,
    leadOverSecond: row.rank === 1 ? row.points - at(2) : null,
    behindFourth: row.rank > 4 ? at(4) - row.points : null,
    aheadOfFifth: row.rank <= 4 ? row.points - at(5) : null,
    relegationPlace,
    aboveRelegation: row.rank < relegationPlace ? row.points - at(relegationPlace) : null,
    belowSafety: row.rank >= relegationPlace ? at(relegationPlace - 1) - row.points : null,
    // Double round robin: every team plays every other twice.
    gamesLeft: (table.length - 1) * 2 - row.played,
  };
}

/** The club's domestic league season so far. `fdName` is the football-data.co.uk spelling. */
export function leagueSeason(rows: MatchRow[], fdName: string, league: League, deductions: Map<string, number> = new Map()): LeagueSeason | null {
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
    stakes: stakes(table, fdName, league),
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
export function otherCompetitions(events: MatchEvent[], teamId: string, domesticSlug: string): CompetitionRun[] {
  const byComp = new Map<string, MatchEvent[]>();
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
  league: (Split & { xgForPg: number | null; xgAgainstPg: number | null; xgGames: number; from: string }) | null;
  /** League this season before they arrived, when they took over mid-season. */
  leagueBeforeThisSeason: Split | null;
}

/** Form since the coach's appointment date. */
export function coachRecord(
  since: string,
  events: MatchEvent[],
  teamId: string,
  leagueGames: TeamGame[],
  seasonStartIso: string,
): CoachRecord {
  const mine = events
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
          xgGames: xgGames.length,
          from: inCharge.at(-1)!.kickoff,
        }
      : null,
    leagueBeforeThisSeason: since > seasonStartIso && before.length ? split(before) : null,
  };
}

/** Plain phrases for each gap, e.g. "3 points behind 1st", "top, 2 points clear". */
export function stakesText(k: Stakes) {
  const p = (x: number) => `${x} point${x === 1 ? "" : "s"}`;
  return {
    first: k.leadOverSecond != null ? `top, ${p(k.leadOverSecond)} clear` : k.toFirst === 0 ? "level on points with 1st" : `${p(k.toFirst)} behind 1st`,
    fourth:
      k.aheadOfFifth != null
        ? k.aheadOfFifth === 0 ? "in the top four, level on points with 5th" : `in the top four, ${p(k.aheadOfFifth)} ahead of 5th`
        : k.behindFourth === 0 ? "level on points with 4th" : `${p(k.behindFourth!)} behind 4th`,
    relegation:
      k.aboveRelegation != null
        ? k.aboveRelegation === 0 ? `level on points with ${ordinalOf(k.relegationPlace)}` : `${p(k.aboveRelegation)} above ${ordinalOf(k.relegationPlace)}`
        : `in the drop zone, ${p(k.belowSafety!)} from safety`,
    left: `${k.gamesLeft} game${k.gamesLeft === 1 ? "" : "s"} left`,
  };
}

const ordinalOf = (i: number) => `${i}${["th", "st", "nd", "rd"][(i % 100 - 20) % 10] ?? ["th", "st", "nd", "rd"][i % 100] ?? "th"}`;
