import type { Leg } from "../types";
import type { OddsBookmaker, OddsEvent } from "./client";
import { ODDS_API_MARKET } from "./leagues";
import { TEAM_ALIASES } from "./aliases";

/** Tokens that carry no identity ("FC", "de", "1899"). */
const GENERIC = new Set([
  "fc", "afc", "cf", "sc", "sv", "as", "ss", "us", "cd", "ud", "rc", "sd", "ca", "club", "de", "del", "the", "and",
  "of", "calcio", "fk", "sk", "bk", "vfb", "vfl", "tsg", "cp", "sl",
]);

/** Tokens that tell apart clubs from the same city (Manchester United/City, Real/Atlético Madrid, Inter/AC Milan). */
const QUALIFIERS = new Set([
  "united", "utd", "city", "real", "atletico", "athletic", "inter", "ac", "sporting", "rovers", "wanderers", "albion",
  "county", "town", "hotspur", "wednesday", "olympique", "rayo",
]);

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonical(s: string): string {
  const n = normalize(s);
  return TEAM_ALIASES[n] ?? n;
}

function parts(name: string) {
  const tokens = canonical(name).split(" ").filter((t) => t && !/^\d+$/.test(t));
  return {
    distinctive: new Set(tokens.filter((t) => !GENERIC.has(t) && !QUALIFIERS.has(t))),
    qualifiers: new Set(tokens.filter((t) => QUALIFIERS.has(t))),
  };
}

const isSubset = (a: Set<string>, b: Set<string>) => [...a].every((t) => b.has(t));

/** 0..1 similarity between two club names ("Man Utd" vs "Manchester United" → 1). */
export function teamScore(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  if (canonical(a) === canonical(b)) return 1;
  const pa = parts(a);
  const pb = parts(b);
  if (!pa.distinctive.size || !pb.distinctive.size) return 0;
  // Same city, different club.
  if (pa.qualifiers.size && pb.qualifiers.size && ![...pa.qualifiers].some((q) => pb.qualifiers.has(q))) return 0;
  if (isSubset(pa.distinctive, pb.distinctive) || isSubset(pb.distinctive, pa.distinctive)) return 0.9;
  const shared = [...pa.distinctive].filter((t) => pb.distinctive.has(t)).length;
  return (0.6 * shared) / Math.max(pa.distinctive.size, pb.distinctive.size);
}

export const MATCH_THRESHOLD = 0.5;
const DRAW = /^(the )?(draw|tie|x)$/i;

export function isDraw(s: string) {
  return DRAW.test(s.trim());
}

export function matchEvent(leg: Leg, events: OddsEvent[]): OddsEvent | null {
  let best: OddsEvent | null = null;
  let bestScore = 0;
  const bothKnown = Boolean(leg.homeTeam && leg.awayTeam);

  for (const ev of events) {
    let score: number;
    if (bothKnown) {
      // Allow for home/away being swapped on the slip.
      score = Math.max(
        Math.min(teamScore(leg.homeTeam, ev.home_team), teamScore(leg.awayTeam, ev.away_team)),
        Math.min(teamScore(leg.homeTeam, ev.away_team), teamScore(leg.awayTeam, ev.home_team)) * 0.95,
      );
    } else {
      const hints = [leg.homeTeam, leg.awayTeam, leg.selection].filter((h): h is string => Boolean(h) && !isDraw(h!));
      score = Math.max(0, ...hints.map((h) => Math.max(teamScore(h, ev.home_team), teamScore(h, ev.away_team)))) * 0.8;
    }
    if (score > bestScore) {
      bestScore = score;
      best = ev;
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}

export interface LegPrice {
  price: number;
  point: number | null;
  /** True when the book's line equals the slip's line (or no line applies). */
  exact: boolean;
}

export function findLegPrice(leg: Leg, event: OddsEvent, book: OddsBookmaker): LegPrice | null {
  if (leg.market === "other") return null;
  const market = book.markets.find((m) => m.key === ODDS_API_MARKET[leg.market].key);
  if (!market) return null;

  let outcome;
  switch (leg.market) {
    case "1x2":
      outcome = isDraw(leg.selection)
        ? market.outcomes.find((o) => isDraw(o.name))
        : byTeam(market.outcomes, leg.selection, event);
      break;
    case "draw_no_bet":
    case "asian_handicap":
      outcome = byTeam(market.outcomes, leg.selection, event);
      break;
    case "total_goals": {
      const side = /under/i.test(leg.selection) ? "under" : "over";
      outcome = market.outcomes.find((o) => o.name.toLowerCase() === side);
      break;
    }
    case "btts": {
      const yes = /^y/i.test(leg.selection.trim());
      outcome = market.outcomes.find((o) => /^y/i.test(o.name) === yes);
      break;
    }
    case "double_chance": {
      const want = dcKey(leg.selection, event);
      outcome = want ? market.outcomes.find((o) => dcKey(o.name, event) === want) : undefined;
      break;
    }
  }
  if (!outcome) return null;

  const point = outcome.point ?? null;
  const hasLine = leg.market === "total_goals" || leg.market === "asian_handicap";
  const exact = !hasLine || leg.line == null || point === leg.line;
  return { price: outcome.price, point, exact };
}

function byTeam(outcomes: { name: string; price: number; point?: number }[], selection: string, event: OddsEvent) {
  const side = sideOf(selection, event);
  if (!side) return undefined;
  const team = side === "home" ? event.home_team : event.away_team;
  return outcomes.find((o) => o.name === team) ?? outcomes.find((o) => teamScore(o.name, team) >= 0.9);
}

type Side = "home" | "away" | "draw";

function sideOf(text: string, event: OddsEvent): Side | null {
  const t = text.trim();
  if (isDraw(t)) return "draw";
  if (/^(home|1)$/i.test(t)) return "home";
  if (/^(away|2)$/i.test(t)) return "away";
  const h = teamScore(t, event.home_team);
  const a = teamScore(t, event.away_team);
  if (Math.max(h, a) < MATCH_THRESHOLD) return null;
  return h >= a ? "home" : "away";
}

/** Double chance selection ("Arsenal or Draw", "1X", "Draw/Chelsea") → a stable key like "draw+home". */
function dcKey(text: string, event: OddsEvent): string | null {
  const shorthand: Record<string, Side[]> = { "1x": ["home", "draw"], x2: ["draw", "away"], "12": ["home", "away"] };
  const compact = text.toLowerCase().replace(/\s+/g, "");
  const sides =
    shorthand[compact] ??
    text
      .split(/\s*(?:\/|\bor\b|,|&|\+)\s*/i)
      .filter(Boolean)
      .map((p) => sideOf(p, event));
  if (sides.length !== 2 || sides.some((s) => !s) || sides[0] === sides[1]) return null;
  return [...sides].sort().join("+");
}
