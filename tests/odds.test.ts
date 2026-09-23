import { describe, expect, it } from "vitest";
import { americanToDecimal, decimalToAmerican, parlayDecimal } from "../lib/odds/convert";
import { matchEvent, teamScore } from "../lib/odds/match";
import { compareSlip } from "../lib/odds/compare";
import type { OddsEvent } from "../lib/odds/client";
import type { Slip } from "../lib/types";

describe("convert", () => {
  it("converts american to decimal", () => {
    expect(americanToDecimal(100)).toBe(2);
    expect(americanToDecimal(150)).toBe(2.5);
    expect(americanToDecimal(-200)).toBe(1.5);
    expect(americanToDecimal(-110)).toBeCloseTo(1.9091, 4);
  });
  it("round-trips decimal to american", () => {
    expect(decimalToAmerican(2.5)).toBe(150);
    expect(decimalToAmerican(1.5)).toBe(-200);
  });
  it("prices parlays", () => {
    expect(parlayDecimal([-110, -110])).toBeCloseTo(3.6446, 3);
  });
});

describe("match", () => {
  it("scores team name variants", () => {
    expect(teamScore("Kansas City Chiefs", "Kansas City Chiefs")).toBe(1);
    expect(teamScore("KC Chiefs", "Kansas City Chiefs")).toBeGreaterThanOrEqual(0.85);
    expect(teamScore("Chiefs", "Kansas City Chiefs")).toBeGreaterThanOrEqual(0.85);
    expect(teamScore("Buffalo Bills", "Kansas City Chiefs")).toBeLessThan(0.5);
  });
});

const book = (key: string, title: string, mlKC: number, spread: { point: number; price: number }, over: number) => ({
  key,
  title,
  last_update: "2026-09-22T00:00:00Z",
  markets: [
    { key: "h2h", outcomes: [{ name: "Kansas City Chiefs", price: mlKC }, { name: "Buffalo Bills", price: 120 }] },
    {
      key: "spreads",
      outcomes: [
        { name: "Kansas City Chiefs", price: spread.price, point: spread.point },
        { name: "Buffalo Bills", price: -110, point: -spread.point },
      ],
    },
    { key: "totals", outcomes: [{ name: "Over", price: over, point: 47.5 }, { name: "Under", price: -110, point: 47.5 }] },
  ],
});

const events: OddsEvent[] = [
  {
    id: "e1",
    sport_key: "americanfootball_nfl",
    commence_time: "2026-09-27T20:25:00Z",
    home_team: "Kansas City Chiefs",
    away_team: "Buffalo Bills",
    bookmakers: [
      book("draftkings", "DraftKings", -140, { point: -2.5, price: -110 }, -110),
      book("fanduel", "FanDuel", -130, { point: -2.5, price: -105 }, -108),
      book("betmgm", "BetMGM", -145, { point: -3, price: -110 }, -115),
    ],
  },
  {
    id: "e2",
    sport_key: "americanfootball_nfl",
    commence_time: "2026-09-27T17:00:00Z",
    home_team: "Dallas Cowboys",
    away_team: "New York Giants",
    bookmakers: [],
  },
];

const slip: Slip = {
  sportsbook: "DraftKings",
  stake: 10,
  betType: "parlay",
  totalOddsAmerican: null,
  potentialPayout: null,
  legs: [
    { sport: "NFL", awayTeam: "Bills", homeTeam: "Chiefs", market: "spread", selection: "Chiefs", line: -2.5, oddsAmerican: -110 },
    { sport: "NFL", awayTeam: "Buffalo Bills", homeTeam: "Kansas City Chiefs", market: "total", selection: "Over", line: 47.5, oddsAmerican: -110 },
  ],
};

describe("compareSlip", () => {
  it("matches the right event", () => {
    expect(matchEvent(slip.legs[0], events)?.id).toBe("e1");
  });

  it("ranks books by payout and excludes non-matching lines", () => {
    const r = compareSlip(slip, { NFL: events });
    expect(r.matches.every((m) => m.eventId === "e1")).toBe(true);
    expect(r.quotes[0].bookKey).toBe("fanduel");
    expect(r.quotes[0].complete).toBe(true);
    expect(r.quotes[0].payout).toBeGreaterThan(r.quotes[1].payout!);
    const mgm = r.quotes.find((q) => q.bookKey === "betmgm")!;
    expect(mgm.complete).toBe(false); // -3 isn't the slip's -2.5
    expect(mgm.legLines[0]).toBe(-3);
    expect(r.slipPayout).toBeCloseTo(36.45, 1);
  });
});
