import { z } from "zod";

export const LEAGUES = [
  "EPL",
  "CHAMPIONSHIP",
  "LA_LIGA",
  "SERIE_A",
  "BUNDESLIGA",
  "LIGUE_1",
  "EREDIVISIE",
  "PRIMEIRA_LIGA",
  "SCOTTISH_PREM",
  "UCL",
  "UEL",
  "UECL",
  "OTHER",
] as const;

export const MARKETS = [
  "1x2",
  "double_chance",
  "draw_no_bet",
  "total_goals",
  "asian_handicap",
  "btts",
  "other",
] as const;

export const CURRENCIES = ["GBP", "EUR", "USD"] as const;

export const LegSchema = z.object({
  league: z.enum(LEAGUES).describe("Competition the match is in; OTHER if not one of the listed ones"),
  homeTeam: z.string().nullable().describe("Home team full name, e.g. 'Manchester United'"),
  awayTeam: z.string().nullable().describe("Away team full name"),
  market: z.enum(MARKETS),
  selection: z
    .string()
    .describe(
      "The pick. 1x2 / draw_no_bet / asian_handicap: a team name or 'Draw'. double_chance: two outcomes joined by ' or ', e.g. 'Arsenal or Draw'. total_goals: 'Over' or 'Under'. btts: 'Yes' or 'No'. other: the text as shown.",
    ),
  line: z.number().nullable().describe("Goal line for totals (2.5) or handicap for the picked team (-0.75); null otherwise"),
  oddsDecimal: z.number().nullable().describe("This leg's odds as a DECIMAL number, e.g. 2.5 (convert 6/4 to 2.5, +150 to 2.5)"),
});

export const SlipSchema = z.object({
  sportsbook: z.string().nullable().describe("Bookmaker the slip is from, e.g. 'Bet365', 'Sky Bet'"),
  currency: z.enum(CURRENCIES).nullable().describe("Currency of the stake; GBP for £, EUR for €"),
  stake: z.number().nullable().describe("Total stake"),
  betType: z.enum(["single", "acca"]).describe("'acca' when several selections are combined into one bet"),
  totalOddsDecimal: z.number().nullable().describe("Combined odds shown on the slip, as decimal"),
  potentialReturn: z.number().nullable().describe("Potential returns shown on the slip (including stake)"),
  legs: z.array(LegSchema),
});

export type Leg = z.infer<typeof LegSchema>;
export type Slip = z.infer<typeof SlipSchema>;
export type League = (typeof LEAGUES)[number];
export type Market = (typeof MARKETS)[number];
export type Currency = (typeof CURRENCIES)[number];

export type AIProvider = "anthropic" | "openai";
export type Region = "uk" | "eu";
export type OddsFormat = "decimal" | "fractional" | "american";

/** Keys + prefs the browser sends to the local API routes. */
export interface ClientSettings {
  provider: AIProvider;
  anthropicKey?: string;
  openaiKey?: string;
  oddsKey?: string;
  anthropicModel?: string;
  openaiModel?: string;
  regions?: Region[];
  oddsFormat?: OddsFormat;
}

export interface BookQuote {
  book: string;
  bookKey: string;
  /** Betting exchange: prices are before commission. */
  exchange: boolean;
  /** Per-leg decimal odds, aligned with slip.legs (null = book doesn't offer that leg at that line). */
  legOdds: (number | null)[];
  /** Per-leg line the book offers (may differ from the slip's line). */
  legLines: (number | null)[];
  decimal: number | null;
  payout: number | null;
  complete: boolean;
  lastUpdate?: string;
}

export interface LegMatch {
  legIndex: number;
  eventId: string | null;
  eventName: string | null;
  commenceTime: string | null;
  note?: string;
}

export interface CompareResult {
  stake: number;
  currency: Currency;
  slipDecimal: number | null;
  slipPayout: number | null;
  matches: LegMatch[];
  quotes: BookQuote[];
  requestsRemaining?: string | null;
  /** True when priced against the built-in sample odds instead of the live API. */
  demo?: boolean;
}
