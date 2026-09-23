import type { League } from "../types";

export const LEAGUE_CONFIG: Record<Exclude<League, "OTHER">, { label: string; oddsKey: string; espn: string; flag: string }> = {
  EPL: { label: "Premier League", oddsKey: "soccer_epl", espn: "eng.1", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  CHAMPIONSHIP: { label: "Championship", oddsKey: "soccer_efl_champ", espn: "eng.2", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  LA_LIGA: { label: "La Liga", oddsKey: "soccer_spain_la_liga", espn: "esp.1", flag: "🇪🇸" },
  SERIE_A: { label: "Serie A", oddsKey: "soccer_italy_serie_a", espn: "ita.1", flag: "🇮🇹" },
  BUNDESLIGA: { label: "Bundesliga", oddsKey: "soccer_germany_bundesliga", espn: "ger.1", flag: "🇩🇪" },
  LIGUE_1: { label: "Ligue 1", oddsKey: "soccer_france_ligue_one", espn: "fra.1", flag: "🇫🇷" },
  EREDIVISIE: { label: "Eredivisie", oddsKey: "soccer_netherlands_eredivisie", espn: "ned.1", flag: "🇳🇱" },
  PRIMEIRA_LIGA: { label: "Primeira Liga", oddsKey: "soccer_portugal_primeira_liga", espn: "por.1", flag: "🇵🇹" },
  SCOTTISH_PREM: { label: "Scottish Premiership", oddsKey: "soccer_spl", espn: "sco.1", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  UCL: { label: "Champions League", oddsKey: "soccer_uefa_champs_league", espn: "uefa.champions", flag: "🇪🇺" },
  UEL: { label: "Europa League", oddsKey: "soccer_uefa_europa_league", espn: "uefa.europa", flag: "🇪🇺" },
  UECL: { label: "Conference League", oddsKey: "soccer_uefa_europa_conference_league", espn: "uefa.europa.conf", flag: "🇪🇺" },
};

export function leagueConfig(league: League) {
  return league === "OTHER" ? null : LEAGUE_CONFIG[league];
}

export function leagueLabel(league: League) {
  return league === "OTHER" ? "Other" : LEAGUE_CONFIG[league].label;
}

export const MARKET_LABEL = {
  "1x2": "Match result (1X2)",
  double_chance: "Double chance",
  draw_no_bet: "Draw no bet",
  total_goals: "Over/Under goals",
  asian_handicap: "Asian handicap",
  btts: "Both teams to score",
  other: "Other",
} as const;

/** Odds API market key for each of our markets. Featured ones come with the league feed; the rest need a per-match call. */
export const ODDS_API_MARKET = {
  "1x2": { key: "h2h", featured: true },
  total_goals: { key: "totals", featured: true },
  asian_handicap: { key: "spreads", featured: true },
  btts: { key: "btts", featured: false },
  draw_no_bet: { key: "draw_no_bet", featured: false },
  double_chance: { key: "double_chance", featured: false },
} as const;

/** Betting exchanges quote prices before commission. */
export const EXCHANGES = new Set(["betfair_ex_uk", "betfair_ex_eu", "matchbook", "smarkets"]);
