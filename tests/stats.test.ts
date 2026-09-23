import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv, toMatchRow, ukToIso, type MatchRow } from "../lib/sources/footballData";
import { averages, form, gamesFor, rates, resolveName } from "../lib/stats/team";
import { headToHead, refereeStats, restDays, sameReferee } from "../lib/stats/match";
import { computeTable } from "../lib/stats/table";
import { aboutClub, mentionIndex } from "../lib/sources/news";

/**
 * All data here is a real snapshot (see tests/fixtures/snapshot/RECORDED_AT, re-record with
 * `npx tsx scripts/record-snapshot.ts`). Expected values come from ESPN's published table or from an
 * independent recount of the raw CSV text, never from the code under test.
 */
const SNAP = "tests/fixtures/snapshot";
const load = (div: string) =>
  parseCsv(readFileSync(`${SNAP}/${div}.csv`, "utf8").replace(/^﻿/, ""))
    .map(toMatchRow)
    .filter((r): r is MatchRow => r !== null);
const E0 = load("E0");
const E1 = load("E1");

interface EspnEntry {
  team: { displayName: string };
  stats: { name: string; value?: number | null }[];
}
const espn = (slug: string) =>
  (JSON.parse(readFileSync(`${SNAP}/${slug}-standings.json`, "utf8")) as { children: { standings: { entries: EspnEntry[] } }[] }).children
    .flatMap((c) => c.standings.entries)
    .map((e) => {
      const s = (n: string) => e.stats.find((x) => x.name === n)?.value ?? 0;
      return { team: e.team.displayName, rank: s("rank"), p: s("gamesPlayed"), w: s("wins"), d: s("ties"), l: s("losses"), gf: s("pointsFor"), ga: s("pointsAgainst"), pts: s("points"), ded: s("deductions") };
    });

/** Independent recount straight from the CSV text (no shared code with lib/stats). */
function rawRows(div: string) {
  const [header, ...lines] = readFileSync(`${SNAP}/${div}.csv`, "utf8").replace(/^﻿/, "").trim().split(/\r?\n/);
  const cols = header.split(",");
  return lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
}

describe("football-data.co.uk parsing (real E0 snapshot)", () => {
  it("parses every played match, with xG, and no odds columns", () => {
    const raw = rawRows("E0").filter((r) => r.FTHG !== "");
    expect(E0).toHaveLength(raw.length);
    expect(E0.every((r) => r.hxg != null && r.axg != null)).toBe(true);
    expect(E0[0]).not.toHaveProperty("B365H");
  });

  it("converts UK local kick-off times to UTC across the clock change", () => {
    expect(ukToIso("16/08/2026", "15:00")).toBe("2026-08-16T14:00:00.000Z"); // BST
    expect(ukToIso("01/03/2026", "15:00")).toBe("2026-03-01T15:00:00.000Z"); // GMT
    expect(ukToIso("05/01/27", "20:00")).toBe("2027-01-05T20:00:00.000Z"); // two-digit year
  });
});

describe("league table vs ESPN's published table", () => {
  it("Premier League: every club's record, points and position match ESPN", () => {
    const mine = computeTable(E0, "EPL");
    for (const t of espn("eng.1")) {
      const r = mine.find((x) => x.team === resolveName(t.team, E0))!;
      expect({ team: t.team, p: r.played, w: r.won, d: r.drawn, l: r.lost, gf: r.goalsFor, ga: r.goalsAgainst, pts: r.points, rank: r.rank }).toEqual({
        team: t.team, p: t.p, w: t.w, d: t.d, l: t.l, gf: t.gf, ga: t.ga, pts: t.pts, rank: t.rank,
      });
    }
  });

  it("points deductions (real case: Southampton in the 2026-27 Championship) match ESPN", () => {
    const table = espn("eng.2");
    const deductions = new Map(table.filter((t) => t.ded).map((t) => [resolveName(t.team, E1)!, t.ded]));
    expect(deductions.size).toBeGreaterThan(0);
    const mine = computeTable(E1, undefined, deductions); // same tie-break rules as the Premier League
    for (const t of table) {
      const r = mine.find((x) => x.team === resolveName(t.team, E1))!;
      expect({ team: t.team, pts: r.points, rank: r.rank }).toEqual({ team: t.team, pts: t.pts, rank: t.rank });
    }
  });
});

describe("team stats (Arsenal, real snapshot)", () => {
  const name = resolveName("Arsenal", E0)!;
  const games = gamesFor(E0, name);
  const raw = rawRows("E0").filter((r) => r.FTHG !== "" && (r.HomeTeam === "Arsenal" || r.AwayTeam === "Arsenal"));
  const side = (r: Record<string, string>) => {
    const home = r.HomeTeam === "Arsenal";
    return { gf: Number(home ? r.FTHG : r.FTAG), ga: Number(home ? r.FTAG : r.FTHG), xgf: Number(home ? r.HxG : r.AxG), htgf: Number(home ? r.HTHG : r.HTAG) };
  };

  it("season record matches ESPN", () => {
    const t = espn("eng.1").find((x) => x.team === "Arsenal")!;
    const f = form(games, 38);
    expect({ p: games.length, w: f.won, d: f.drawn, l: f.lost, gf: f.goalsFor, ga: f.goalsAgainst }).toEqual({ p: t.p, w: t.w, d: t.d, l: t.l, gf: t.gf, ga: t.ga });
  });

  it("averages and rates match a recount of the raw CSV", () => {
    const s = raw.map(side);
    const frac = (f: (x: (typeof s)[number]) => boolean) => s.filter(f).length / s.length;
    const avg = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;
    expect(averages(games)).toMatchObject({ played: s.length, goalsFor: avg(s.map((x) => x.gf)), xgFor: avg(s.map((x) => x.xgf)) });
    expect(rates(games)).toMatchObject({
      btts: frac((x) => x.gf > 0 && x.ga > 0),
      over25: frac((x) => x.gf + x.ga > 2.5),
      cleanSheets: frac((x) => x.ga === 0),
      failedToScore: frac((x) => x.gf === 0),
      scoredFirstHalf: frac((x) => x.htgf > 0),
    });
  });

  it("home-only games are exactly the home rows", () => {
    expect(gamesFor(E0, name, "home")).toHaveLength(raw.filter((r) => r.HomeTeam === "Arsenal").length);
  });
});

describe("match stats (real snapshot)", () => {
  it("head-to-head finds a real meeting with the right score", () => {
    const m = E0[0];
    const h = headToHead(E0, m.home, m.away);
    expect(h.meetings[0]).toMatchObject({ home: m.home, away: m.away, homeGoals: m.fthg, awayGoals: m.ftag });
  });

  it("referee profile matches a recount of that referee's matches", () => {
    const raw = rawRows("E0").filter((r) => r.FTHG !== "" && r.Referee);
    const counts = raw.reduce<Record<string, number>>((a, r) => ((a[r.Referee] = (a[r.Referee] ?? 0) + 1), a), {});
    const ref = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]; // busiest referee
    const mine = raw.filter((r) => r.Referee === ref);
    const yellows = mine.reduce((s, r) => s + Number(r.HY) + Number(r.AY), 0) / mine.length;
    const homeWins = mine.filter((r) => Number(r.FTHG) > Number(r.FTAG)).length / mine.length;
    const r = refereeStats(E0, ref)!;
    expect(r.games).toBe(mine.length);
    expect(r.yellowsPerGame).toBeCloseTo(yellows, 2);
    expect(r.homeWinRate).toBeCloseTo(homeWins, 5);
  });

  it("matches referee name formats across sources", () => {
    expect(sameReferee("Michael Oliver", "M Oliver")).toBe(true); // ESPN vs football-data.co.uk
    expect(sameReferee("Michael Oliver", "A Taylor")).toBe(false);
  });

  it("rest days", () => {
    expect(restDays("2026-09-20T14:00:00Z", "2026-09-27T14:00:00Z")).toBe(7);
    expect(restDays(null, "2026-09-27T14:00:00Z")).toBeNull();
  });
});

describe("headline attribution (real Google News headlines, 2026-09-23)", () => {
  const h = (title: string) => ({ title, url: "https://news.google.com", published: null, publisher: "", source: "google-news" as const });

  it("drops headlines about the opponent from a club's availability", () => {
    const villarrealFeed = [
      h("Real Madrid midfielder a doubt for Villarreal clash, likely to return vs AS Roma"),
      h("Real Madrid reveal nature of Valverde's injury: doubts over his availability for El Clasico"),
      h("Ilias Akhomach returns to Morocco squad after surprise late call-up"),
    ];
    expect(aboutClub(villarrealFeed, "Villarreal", "Real Madrid")).toEqual([]);
  });

  it("drops headlines that never name the club (search matched the article body)", () => {
    const sportingFeed = [
      h("Tottenham's Pedro Porro expected to be out for around a month with hamstring injury - The Athletic"),
      h("Sporting CP boss confirms Hjulmand fitness doubt"),
    ];
    expect(aboutClub(sportingFeed, "Sporting CP", "Lens").map((x) => x.title)).toEqual(["Sporting CP boss confirms Hjulmand fitness doubt"]);
  });

  it("finds clubs by name inside real headlines", () => {
    expect(mentionIndex("Arteta agrees new deal with champions Arsenal", "Arsenal")).toBeGreaterThanOrEqual(0);
    expect(mentionIndex("Valverde to miss Korea friendly after ankle injury", "Real Madrid")).toBe(-1);
  });
});
