import type { League, Market } from "./types";

export interface LeagueInfo {
  label: string;
  country: string;
  /** Short competition key used to tell league games from cups and Europe in merged match lists. */
  slug: string;
  /** football-data.co.uk division code; null for UEFA competitions (use each club's domestic division). */
  fd: string | null;
  /** OpenLigaDB league shortcut, where available. */
  openLigaDb?: string;
  uefaCompetitionId?: number;
}

export const LEAGUE_INFO: Record<Exclude<League, "OTHER">, LeagueInfo> = {
  EPL: { label: "Premier League", country: "England", slug: "eng.1", fd: "E0" },
  LA_LIGA: { label: "La Liga", country: "Spain", slug: "esp.1", fd: "SP1" },
  SERIE_A: { label: "Serie A", country: "Italy", slug: "ita.1", fd: "I1" },
  BUNDESLIGA: { label: "Bundesliga", country: "Germany", slug: "ger.1", fd: "D1", openLigaDb: "bl1" },
  LIGUE_1: { label: "Ligue 1", country: "France", slug: "fra.1", fd: "F1" },
  UCL: { label: "Champions League", country: "Europe", slug: "uefa.champions", fd: null, uefaCompetitionId: 1 },
};

export function leagueInfo(league: League): LeagueInfo | null {
  return league === "OTHER" ? null : LEAGUE_INFO[league];
}

export function leagueLabel(league: League) {
  return league === "OTHER" ? "Other" : LEAGUE_INFO[league].label;
}

export const DOMESTIC_LEAGUES = (Object.keys(LEAGUE_INFO) as Exclude<League, "OTHER">[]).filter((l) => LEAGUE_INFO[l].fd);

export const MARKET_LABEL: Record<Market, string> = {
  "1x2": "Who wins",
  double_chance: "One of two results",
  draw_no_bet: "Who wins, refund if draw",
  total_goals: "Number of goals",
  asian_handicap: "Win by a margin",
  btts: "Both teams score",
  total_corners: "Number of corners",
  total_cards: "Number of cards",
  other: "Something else",
};

/** football-data.co.uk season code for the season containing `date` (Aug–Jun seasons): 2026-09 → "2627". */
export function seasonCode(date = new Date(), yearsBack = 0): string {
  const startYear = (date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1) - yearsBack;
  const two = (y: number) => String(y % 100).padStart(2, "0");
  return `${two(startYear)}${two(startYear + 1)}`;
}


/** 1 July of the season containing `date` (seasons run Aug–May). */
export function seasonStart(date = new Date()): string {
  const y = date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `${y}-07-01T00:00:00Z`;
}
