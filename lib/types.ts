import { z } from "zod";

// Scope: Europe's top 5 leagues + the Champions League.
export const LEAGUES = ["EPL", "LA_LIGA", "SERIE_A", "BUNDESLIGA", "LIGUE_1", "UCL", "OTHER"] as const;

export const MARKETS = [
  "1x2",
  "double_chance",
  "draw_no_bet",
  "total_goals",
  "asian_handicap",
  "btts",
  "total_corners",
  "total_cards",
  "other",
] as const;


export const LegSchema = z.object({
  league: z.enum(LEAGUES).describe("Competition the match is in; OTHER if not one of the listed ones"),
  homeTeam: z.string().nullable().describe("Home team full name, e.g. 'Manchester United'"),
  awayTeam: z.string().nullable().describe("Away team full name"),
  market: z.enum(MARKETS),
  selection: z
    .string()
    .describe(
      "The pick. 1x2 / draw_no_bet / asian_handicap: a team name or 'Draw'. double_chance: two outcomes joined by ' or ', e.g. 'Arsenal or Draw'. total_goals / total_corners / total_cards: 'Over' or 'Under'. btts: 'Yes' or 'No'. other: the text as shown.",
    ),
  line: z.number().nullable().describe("Goal line for totals (2.5) or handicap for the picked team (-0.75); null otherwise"),
  oddsDecimal: z.number().nullable().describe("This leg's odds as a DECIMAL number, e.g. 2.5 (convert 6/4 to 2.5)"),
});

export const SlipSchema = z.object({
  legs: z.array(LegSchema),
});

export type Leg = z.infer<typeof LegSchema>;
export type Slip = z.infer<typeof SlipSchema>;
export type League = (typeof LEAGUES)[number];
export type Market = (typeof MARKETS)[number];

export type AIProvider = "anthropic" | "openai";

/** Keys + prefs the browser sends to the local API routes. */
export interface ClientSettings {
  provider: AIProvider;
  anthropicKey?: string;
  openaiKey?: string;
  anthropicModel?: string;
  openaiModel?: string;
}
