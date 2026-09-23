import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bestTeamMatch, isDraw, matchFixture, teamScore } from "../lib/teams/match";
import { LEAGUE_INFO } from "../lib/leagues";

type Names = Record<string, { fd: string[]; espn: { id: string; name: string }[] }>;
const names: Names = JSON.parse(readFileSync("tests/fixtures/team-names.json", "utf8"));

/** Clubs football-data.co.uk lists that ESPN has no entry for (none in the top 5 as of 2026-09-23). */
const MISSING_ON_ESPN = new Set<string>([]);

describe("football-data.co.uk → ESPN club mapping (recorded names, top 5 leagues)", () => {
  // ESPN's division lists lag promotions/relegations, so match within the whole country.
  const byCountry: Record<string, string[]> = {};
  for (const [league, v] of Object.entries(names)) {
    const c = LEAGUE_INFO[league as keyof typeof LEAGUE_INFO].country;
    byCountry[c] = [...new Set([...(byCountry[c] ?? []), ...v.espn.map((e) => e.name)])];
  }

  for (const [league, { fd }] of Object.entries(names)) {
    it(`${league}: every club maps to exactly one ESPN club`, () => {
      const pool = byCountry[LEAGUE_INFO[league as keyof typeof LEAGUE_INFO].country];
      const failures: string[] = [];
      for (const n of fd.filter((x) => !MISSING_ON_ESPN.has(x))) {
        const [first, second] = pool.map((e) => ({ e, s: teamScore(n, e) })).sort((a, b) => b.s - a.s);
        if (first.s < 0.5) failures.push(`${n}: no match`);
        else if (second && second.s >= first.s - 0.02) failures.push(`${n}: tie ${first.e} / ${second.e}`);
      }
      expect(failures).toEqual([]);
    });
  }
});

describe("other sources' spellings → ESPN (recorded names)", () => {
  const other: Record<string, Record<string, string[]>> = JSON.parse(readFileSync("tests/fixtures/team-names-other.json", "utf8"));
  const espnIn = (league: string) => names[league].espn.map((e) => e.name);
  const best = (n: string, pool: string[]) => pool.map((e) => ({ e, s: teamScore(n, e) })).sort((a, b) => b.s - a.s);

  it.each([
    ["openligadb", "BUNDESLIGA"],
    ["fpl", "EPL"],
  ])("%s %s: every club maps to exactly one ESPN club", (src, league) => {
    const failures = other[src][league].filter((n) => {
      const [a, b] = best(n, espnIn(league));
      return a.s < 0.5 || (b && b.s >= a.s - 0.02);
    });
    expect(failures).toEqual([]);
  });

  it("UEFA names for clubs from the top 5 map to the right ESPN club", () => {
    const pool = Object.values(names).flatMap((v) => v.espn.map((e) => e.name));
    const expected: Record<string, string> = {
      "B. Dortmund": "Borussia Dortmund",
      "Paris": "Paris Saint-Germain",
      "Inter": "Internazionale",
      "Atleti": "Atlético Madrid",
    };
    const uefaNames = new Set(Object.values(other.uefa).flat());
    for (const [u, espn] of Object.entries(expected)) {
      if (!uefaNames.has(u)) continue; // not in this season's draw
      expect(best(u, pool)[0].e, u).toBe(espn);
    }
    // Any UEFA club that does match a covered club must match unambiguously.
    const ambiguous = [...uefaNames].filter((n) => {
      const [a, b] = best(n, pool);
      return a.s >= 0.5 && b && b.s >= a.s - 0.02 && a.e !== b.e;
    });
    expect(ambiguous).toEqual([]);
  });
});

describe("same-city and same-name traps", () => {
  it.each([
    ["Manchester United", "Manchester City"],
    ["Man Utd", "Newcastle United"],
    ["Real Madrid", "Atletico Madrid"],
    ["Inter", "AC Milan"],
    ["Paris FC", "Paris Saint-Germain"],
  ])("%s ≠ %s", (a, b) => {
    expect(teamScore(a, b)).toBeLessThan(0.5);
  });

  it("prefers the exact club when one name contains the other", () => {
    expect(bestTeamMatch("Paris FC", ["Paris Saint-Germain", "Paris FC"])?.name).toBe("Paris FC");
  });
});

describe("bet-slip nicknames", () => {
  it.each([
    ["Man Utd", "Manchester United"],
    ["Man City", "Manchester City"],
    ["Spurs", "Tottenham Hotspur"],
    ["Wolves", "Wolverhampton Wanderers"],
    ["Nott'm Forest", "Nottingham Forest"],
    ["Brighton", "Brighton & Hove Albion"],
    ["Atleti", "Atlético Madrid"],
    ["Barca", "Barcelona"],
    ["Inter", "Inter Milan"],
    ["PSG", "Paris Saint-Germain"],
    ["Bayern", "Bayern Munich"],
    ["Gladbach", "Borussia Mönchengladbach"],
    ["Olympiakos", "Olympiacos"],
    ["St Pauli", "St. Pauli"],
  ])("%s → %s", (slip, official) => {
    expect(teamScore(slip, official)).toBeGreaterThanOrEqual(0.9);
  });
});

describe("fixtures", () => {
  const fixtures = [
    { home: "Arsenal", away: "Chelsea" },
    { home: "Manchester United", away: "Newcastle United" },
    { home: "Manchester City", away: "Liverpool" },
  ];

  it("finds a fixture even when home/away are swapped", () => {
    expect(matchFixture("Chelsea", "Arsenal", fixtures)).toBe(fixtures[0]);
  });

  it("doesn't match a fixture on one shared team when both are given", () => {
    expect(matchFixture("Arsenal", "Spurs", fixtures)).toBeNull();
  });

  it("works with a single known team", () => {
    expect(matchFixture("Man Utd", null, fixtures)).toBe(fixtures[1]);
  });

  it("recognises draw selections", () => {
    expect(["Draw", "X", "the draw", "Tie"].every(isDraw)).toBe(true);
    expect(isDraw("Arsenal")).toBe(false);
  });
});
