import { describe, expect, it } from "vitest";
import { compareSlip } from "../lib/odds/compare";
import { matchEvent, teamScore } from "../lib/odds/match";
import { demoEventsBySport } from "../lib/demo/odds";
import { SAMPLE_SLIPS } from "../lib/demo/slips";

const feed = demoEventsBySport(new Date("2026-09-22T12:00:00Z"));
const run = (id: string) => {
  const s = SAMPLE_SLIPS.find((x) => x.id === id)!;
  return { slip: s.slip, r: compareSlip(s.slip, feed) };
};
const book = (r: ReturnType<typeof compareSlip>, key: string) => r.quotes.find((q) => q.bookKey === key)!;

describe("sample slip scenarios", () => {
  it("single moneyline: finds a better price than DraftKings", () => {
    const { r } = run("single-ml");
    expect(r.quotes[0].bookKey).toBe("espnbet"); // Chiefs -125 is the best price on the board
    expect(r.quotes[0].payout).toBe(90);
    expect(book(r, "draftkings").payout).toBe(87.04);
    expect(r.slipPayout).toBe(87.04);
    expect(r.quotes.every((q) => q.complete)).toBe(true);
  });

  it("3-leg parlay: skips books with different lines and missing games", () => {
    const { r } = run("nfl-3leg");
    expect(r.matches.map((m) => m.eventId)).toEqual(["demo-nfl-buf-kc", "demo-nfl-dal-phi", "demo-nfl-det-gb"]);

    const best = r.quotes[0];
    expect(best.bookKey).toBe("fanatics"); // -108, -108, +130
    expect(best.payout).toBeCloseTo(170.62, 1);
    expect(book(r, "fanduel").payout).toBeCloseTo(161.82, 1);

    // BetMGM/Caesars hang Bills +3, not +2.5, so they're shown as alt lines, not priced.
    expect(book(r, "betmgm").complete).toBe(false);
    expect(book(r, "betmgm").legLines[0]).toBe(3);
    expect(book(r, "williamhill_us").complete).toBe(false);
    // Hard Rock has no Lions-Packers market.
    expect(book(r, "hardrockbet").complete).toBe(false);
    expect(book(r, "hardrockbet").legOdds[2]).toBeNull();
  });

  it("MLB parlay: prices Yankees -1.5 + under, beats the slip's payout", () => {
    const { r } = run("mlb-2leg");
    expect(r.slipPayout).toBeCloseTo(110, 1);
    expect(r.quotes[0].bookKey).toBe("fanatics"); // +150 and -108
    expect(r.quotes[0].payout).toBeCloseTo(120.37, 1);
    expect(book(r, "williamhill_us").complete).toBe(false); // total is 8, not 8.5
    expect(r.quotes.find((q) => q.bookKey === "hardrockbet")).toBeUndefined();
  });

  it("already-best slip: top payout equals the slip", () => {
    const { r } = run("already-best");
    expect(r.quotes[0].payout).toBe(r.slipPayout);
    expect(["betmgm", "williamhill_us"]).toContain(r.quotes[0].bookKey);
    expect(book(r, "espnbet").complete).toBe(false); // Eagles -7 there
  });

  it("messy slip: explains the prop and the unlisted game, prices what it can", () => {
    const { r } = run("messy");
    expect(r.matches[0].eventId).toBe("demo-ncaaf-uga-bama");
    expect(r.matches[1].note).toMatch(/props/i);
    expect(r.matches[2].eventId).toBeNull();
    expect(r.matches[2].note).toMatch(/No matching/);
    expect(r.quotes.every((q) => !q.complete)).toBe(true);
    expect(book(r, "williamhill_us").legOdds[0]).toBe(155); // best Georgia price still visible
  });
});

describe("team matching edge cases", () => {
  it("keeps numeric nicknames", () => {
    expect(teamScore("49ers", "San Francisco 49ers")).toBeGreaterThanOrEqual(0.85);
    expect(teamScore("Philadelphia 76ers", "Philadelphia 76ers")).toBe(1);
  });

  it("doesn't confuse teams that share a city", () => {
    expect(teamScore("Los Angeles Rams", "Los Angeles Chargers")).toBeLessThan(0.5);
    expect(teamScore("New York Yankees", "New York Mets")).toBeLessThan(0.5);
    const rams = { sport: "NFL" as const, awayTeam: "Los Angeles Rams", homeTeam: null, market: "moneyline" as const, selection: "Los Angeles Rams", line: null, oddsAmerican: 110 };
    const chargersGame = { ...feed.NFL[0], id: "lac", away_team: "Los Angeles Chargers", home_team: "Denver Broncos" };
    expect(matchEvent(rams, [chargersGame])).toBeNull();
  });

  it("matches abbreviations and city-only names", () => {
    expect(teamScore("KC Chiefs", "Kansas City Chiefs")).toBeGreaterThanOrEqual(0.85);
    expect(teamScore("Kansas City", "Kansas City Chiefs")).toBeGreaterThanOrEqual(0.85);
  });
});
