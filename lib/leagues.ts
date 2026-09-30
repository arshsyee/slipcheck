import type { League, Leg, Market } from "./types";

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

export const HAS_LINE = new Set<Leg["market"]>(["total_goals", "asian_handicap", "total_corners", "total_cards"]);
/** A typical starting line when switching to an over/under market. */
export const DEFAULT_LINE: Partial<Record<Leg["market"], number>> = { total_goals: 2.5, total_corners: 9.5, total_cards: 3.5, asian_handicap: 0 };

/** The picks a market allows, as the slip reader writes them (see LegSchema). null = free text. */
export function pickOptions(market: Leg["market"], home: string, away: string): string[] | null {
  switch (market) {
    case "1x2":
      return [home, "Draw", away];
    case "double_chance":
      return [`${home} or Draw`, `${home} or ${away}`, `Draw or ${away}`];
    case "draw_no_bet":
    case "asian_handicap":
      return [home, away];
    case "total_goals":
    case "total_corners":
    case "total_cards":
      return ["Over", "Under"];
    case "btts":
      return ["Yes", "No"];
    default:
      return null;
  }
}

/** What's missing or doesn't fit, so the leg gets an amber outline. */
export function legProblems(leg: Leg): string[] {
  const home = leg.homeTeam ?? "";
  const away = leg.awayTeam ?? "";
  const opts = pickOptions(leg.market, home, away);
  const out: string[] = [];
  if (!home || !away) out.push("A team is missing.");
  if (opts && !opts.some((o) => o.toLowerCase() === leg.selection.trim().toLowerCase()))
    out.push(leg.selection ? `The slip was read as “${leg.selection}”. Pick one above.` : "No pick chosen.");
  if (HAS_LINE.has(leg.market) && leg.line == null) out.push("No line set.");
  if (leg.oddsDecimal == null) out.push("No odds entered.");
  return out;
}

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
