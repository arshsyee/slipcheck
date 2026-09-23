import type { BookQuote, CompareResult, LegMatch, Slip } from "../types";
import type { OddsEvent } from "./client";
import { americanToDecimal, decimalToAmerican, parlayDecimal } from "./convert";
import { findLegPrice, matchEvent } from "./match";

const DEFAULT_STAKE = 10;

/**
 * Pure comparison: given the parsed slip and the odds feed for each sport on it,
 * price the same bet at every book. Only exact-line matches count toward a payout;
 * alternate lines are still reported in legLines so the UI can show them.
 */
export function compareSlip(
  slip: Slip,
  eventsBySport: Partial<Record<string, OddsEvent[]>>,
): Omit<CompareResult, "requestsRemaining"> {
  const stake = slip.stake && slip.stake > 0 ? slip.stake : DEFAULT_STAKE;

  const matchedEvents: (OddsEvent | null)[] = slip.legs.map((leg) =>
    matchEvent(leg, eventsBySport[leg.sport] ?? []),
  );

  const matches: LegMatch[] = slip.legs.map((leg, i) => {
    const ev = matchedEvents[i];
    let note: string | undefined;
    if (leg.market === "player_prop" || leg.market === "other") note = "Player props aren't compared yet (Phase 2)";
    else if (leg.sport === "OTHER") note = "Unsupported sport";
    else if (!ev) note = "No matching upcoming game found";
    return {
      legIndex: i,
      eventId: ev?.id ?? null,
      eventName: ev ? `${ev.away_team} @ ${ev.home_team}` : null,
      commenceTime: ev?.commence_time ?? null,
      note,
    };
  });

  const books = new Map<string, string>();
  for (const ev of matchedEvents) for (const b of ev?.bookmakers ?? []) books.set(b.key, b.title);

  const quotes: BookQuote[] = [...books].map(([bookKey, title]) => {
    const legOdds: (number | null)[] = [];
    const legLines: (number | null)[] = [];
    let lastUpdate: string | undefined;

    slip.legs.forEach((leg, i) => {
      const ev = matchedEvents[i];
      const book = ev?.bookmakers.find((b) => b.key === bookKey);
      const price = ev && book ? findLegPrice(leg, ev, book) : null;
      legOdds.push(price?.exact ? price.price : null);
      legLines.push(price?.point ?? null);
      if (book && (!lastUpdate || book.last_update > lastUpdate)) lastUpdate = book.last_update;
    });

    const complete = legOdds.every((o) => o != null);
    const decimal = complete ? parlayDecimal(legOdds as number[]) : null;
    return {
      book: title,
      bookKey,
      legOdds,
      legLines,
      decimal,
      american: decimal ? decimalToAmerican(decimal) : null,
      payout: decimal ? round2(stake * decimal) : null,
      complete,
      lastUpdate,
    };
  });

  quotes.sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    if (a.payout != null && b.payout != null) return b.payout - a.payout;
    return countNonNull(b.legOdds) - countNonNull(a.legOdds);
  });

  const slipDecimal = slipDecimalOdds(slip);
  return {
    stake,
    slipDecimal,
    slipPayout: slipDecimal ? round2(stake * slipDecimal) : slip.potentialPayout,
    matches,
    quotes,
  };
}

export function slipDecimalOdds(slip: Slip): number | null {
  if (slip.totalOddsAmerican) return americanToDecimal(slip.totalOddsAmerican);
  const legOdds = slip.legs.map((l) => l.oddsAmerican);
  if (legOdds.length && legOdds.every((o) => o != null && o !== 0)) return parlayDecimal(legOdds as number[]);
  return null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const countNonNull = (a: unknown[]) => a.filter((x) => x != null).length;
