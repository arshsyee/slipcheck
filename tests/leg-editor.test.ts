import { describe, expect, it } from "vitest";
import { legProblems, pickOptions } from "../lib/leagues";
import type { Leg } from "../lib/types";

const leg = (p: Partial<Leg>): Leg => ({ league: "OTHER", homeTeam: "Croatia", awayTeam: "England", market: "1x2", selection: "England", line: null, oddsDecimal: 2.5, ...p });

describe("leg review", () => {
  it("offers the market's picks", () => {
    expect(pickOptions("1x2", "Croatia", "England")).toEqual(["Croatia", "Draw", "England"]);
    expect(pickOptions("double_chance", "A", "B")).toEqual(["A or Draw", "A or B", "Draw or B"]);
    expect(pickOptions("other", "A", "B")).toBeNull();
  });

  it("flags only what's missing or doesn't fit", () => {
    expect(legProblems(leg({}))).toEqual([]);
    expect(legProblems(leg({ selection: "england" }))).toEqual([]);
    expect(legProblems(leg({ oddsDecimal: null }))).toEqual([]); // odds are optional
    expect(legProblems(leg({ selection: "Englnd" }))[0]).toContain("“Englnd”");
    expect(legProblems(leg({ market: "total_goals", selection: "Over", line: null }))).toEqual(["No line set."]);
  });
});

describe("odds as a multiplier", () => {
  it("reads any slip format and shows Nx", async () => {
    const { formatOdds, parseOdds } = await import("../lib/odds/convert");
    expect(["2.5x", "2.5", "6/4", " 6 / 4 "].map(parseOdds)).toEqual([2.5, 2.5, 2.5, 2.5]);
    expect(parseOdds("evens")).toBe(2);
    expect(parseOdds("abc")).toBeNull();
    expect([2.5, 10, 1.7272, 21.3125].map(formatOdds)).toEqual(["2.5x", "10x", "1.73x", "21.31x"]);
  });
});
