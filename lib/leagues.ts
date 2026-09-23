import type { League, Market } from "./types";

export interface LeagueInfo {
  label: string;
  country: string;
  /** ESPN soccer league slug (site.api.espn.com/apis/site/v2/sports/soccer/{espn}). */
  espn: string;
  /** football-data.co.uk division code; null for UEFA competitions (use each club's domestic division). */
  fd: string | null;
  /** OpenLigaDB league shortcut, where available. */
  openLigaDb?: string;
  uefaCompetitionId?: number;
}

export const LEAGUE_INFO: Record<Exclude<League, "OTHER">, LeagueInfo> = {
  EPL: { label: "Premier League", country: "England", espn: "eng.1", fd: "E0" },
  LA_LIGA: { label: "La Liga", country: "Spain", espn: "esp.1", fd: "SP1" },
  SERIE_A: { label: "Serie A", country: "Italy", espn: "ita.1", fd: "I1" },
  BUNDESLIGA: { label: "Bundesliga", country: "Germany", espn: "ger.1", fd: "D1", openLigaDb: "bl1" },
  LIGUE_1: { label: "Ligue 1", country: "France", espn: "fra.1", fd: "F1" },
  UCL: { label: "Champions League", country: "Europe", espn: "uefa.champions", fd: null, uefaCompetitionId: 1 },
};

export function leagueInfo(league: League): LeagueInfo | null {
  return league === "OTHER" ? null : LEAGUE_INFO[league];
}

export function leagueLabel(league: League) {
  return league === "OTHER" ? "Other" : LEAGUE_INFO[league].label;
}

export const DOMESTIC_LEAGUES = (Object.keys(LEAGUE_INFO) as Exclude<League, "OTHER">[]).filter((l) => LEAGUE_INFO[l].fd);

export const MARKET_LABEL: Record<Market, string> = {
  "1x2": "Match result (1X2)",
  double_chance: "Double chance",
  draw_no_bet: "Draw no bet",
  total_goals: "Over/Under goals",
  asian_handicap: "Asian handicap",
  btts: "Both teams to score",
  other: "Other",
};

/** football-data.co.uk season code for the season containing `date` (Aug–Jun seasons): 2026-09 → "2627". */
export function seasonCode(date = new Date(), yearsBack = 0): string {
  const startYear = (date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1) - yearsBack;
  const two = (y: number) => String(y % 100).padStart(2, "0");
  return `${two(startYear)}${two(startYear + 1)}`;
}

/** ESPN cup competitions per country (checked 2026-09-23). */
export const CUP_SLUGS: Record<string, string[]> = {
  England: ["eng.fa", "eng.league_cup"],
  Germany: ["ger.dfb_pokal"],
  Spain: ["esp.copa_del_rey"],
  Italy: ["ita.coppa_italia"],
  France: ["fra.coupe_de_france"],
};

/** 1 July of the season containing `date` (seasons run Aug–May). */
export function seasonStart(date = new Date()): string {
  const y = date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `${y}-07-01T00:00:00Z`;
}
