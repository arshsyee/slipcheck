import type { MatchRow } from "../sources/footballData";
import type { League } from "../types";

export interface StandingRow {
  teamId: string;
  team: string;
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** Points docked by the league (a results-only source can't know them; pass them in if known). */
  deductions?: number;
}

/** How each league separates clubs level on points (checked against ESPN's published tables). */
// "h2h" = head-to-head record among the tied clubs, always. "h2h-complete" = only once every tied club has
// played every other home and away (Spain, Italy); until then it falls through to goal difference.
type TieBreak = "gd" | "gf" | "h2h" | "h2h-complete" | "wins";
const TIE_BREAKS: Partial<Record<League, TieBreak[]>> = {
  LA_LIGA: ["h2h-complete", "gd", "gf"],
  SERIE_A: ["h2h-complete", "gd", "gf"],
};
const DEFAULT: TieBreak[] = ["gd", "gf"];

/**
 * League table computed from football-data.co.uk results. Verified against ESPN and Wikipedia:
 * ESPN's own tables are wrong for some divisions (e.g. Scottish League One/Two in 2026-27), this isn't.
 * `deductions` (points docked by the league, keyed by football-data.co.uk name) can't be derived from
 * results, so callers pass them in.
 */
export function computeTable(rows: MatchRow[], league?: League, deductions: Map<string, number> = new Map()): StandingRow[] {
  const table = [...tally(rows).values()].map((r) => ({
    ...r,
    goalDiff: r.goalsFor - r.goalsAgainst,
    points: r.won * 3 + r.drawn - (deductions.get(r.team) ?? 0),
  }));
  const rules = (league && TIE_BREAKS[league]) ?? DEFAULT;

  table.sort((x, y) => y.points - x.points || x.team.localeCompare(y.team));
  // Resolve each group of clubs level on points with the league's rules.
  const sorted: StandingRow[] = [];
  for (let i = 0; i < table.length; ) {
    let j = i;
    while (j < table.length && table[j].points === table[i].points) j++;
    sorted.push(...breakTie(table.slice(i, j), rows, rules));
    i = j;
  }
  sorted.forEach((r, i) => (r.rank = i + 1));
  return sorted;
}

function tally(rows: MatchRow[]) {
  const t = new Map<string, StandingRow>();
  const row = (team: string) => {
    let r = t.get(team);
    if (!r) {
      r = { teamId: "", team, rank: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 };
      t.set(team, r);
    }
    return r;
  };
  for (const m of rows) {
    const h = row(m.home);
    const a = row(m.away);
    h.played++;
    a.played++;
    h.goalsFor += m.fthg;
    h.goalsAgainst += m.ftag;
    a.goalsFor += m.ftag;
    a.goalsAgainst += m.fthg;
    if (m.fthg > m.ftag) {
      h.won++;
      a.lost++;
    } else if (m.fthg < m.ftag) {
      a.won++;
      h.lost++;
    } else {
      h.drawn++;
      a.drawn++;
    }
  }
  return t;
}

function breakTie(group: StandingRow[], rows: MatchRow[], rules: TieBreak[]): StandingRow[] {
  if (group.length < 2) return group;
  // Head-to-head "mini league" among the tied clubs only.
  const names = new Set(group.map((g) => g.team));
  const miniRows = rows.filter((r) => names.has(r.home) && names.has(r.away));
  const mini = tally(miniRows);
  // Every ordered pair (home, away) among the tied clubs has been played.
  const complete = miniRows.length >= group.length * (group.length - 1);
  const h2hPts = (t: string) => {
    const r = mini.get(t);
    return r ? r.won * 3 + r.drawn : 0;
  };
  const h2hGd = (t: string) => {
    const r = mini.get(t);
    return r ? r.goalsFor - r.goalsAgainst : 0;
  };
  return [...group].sort((x, y) => {
    for (const rule of rules) {
      const d =
        rule === "gd" ? y.goalDiff - x.goalDiff
        : rule === "gf" ? y.goalsFor - x.goalsFor
        : rule === "wins" ? y.won - x.won
        : rule === "h2h-complete" && !complete ? 0
        : h2hPts(y.team) - h2hPts(x.team) || h2hGd(y.team) - h2hGd(x.team);
      if (d) return d;
    }
    return x.team.localeCompare(y.team);
  });
}
