import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { likelyLineup, type SquadPlayer } from "../lib/stats/lineup";
import { parseWikiSquad } from "../lib/sources/squad";

/** Real data recorded 2026-09-23: Arsenal's FPL squad (starts in the last 5 gameweeks) and England's Wikipedia squad. */
describe("lineup & squad (real snapshots)", () => {
  const arsenal = JSON.parse(readFileSync("tests/fixtures/snapshot/arsenal-fpl-squad.json", "utf8")) as SquadPlayer[];

  it("builds the likely XI in the last shape, leaving out the injured", () => {
    const l = likelyLineup(arsenal, { GK: 1, DEF: 4, MID: 5, FWD: 1 }, 5);
    expect(l.xi).toHaveLength(11);
    expect(l.shape).toBe("4-5-1");
    expect(l.xi.map((p) => p.name)).not.toContain("Saliba"); // injured in the snapshot
    expect(l.xi.find((p) => p.pos === "GK")?.name).toBe("Raya"); // 5 of 5 starts
    // Backups never repeat an XI player, and are ordered by starts.
    const xi = new Set(l.xi.map((p) => p.name));
    for (const b of Object.values(l.backups).flat()) expect(xi.has(b.name)).toBe(false);
    expect(l.backups.DEF.map((p) => p.starts)).toEqual([...l.backups.DEF.map((p) => p.starts)].sort((a, b) => (b ?? 0) - (a ?? 0)));
  });

  it("reads a national squad from Wikipedia with positions, caps and goals", () => {
    const s = parseWikiSquad(readFileSync("tests/fixtures/snapshot/england-squad.wikitext", "utf8"))!;
    expect(s.players).toHaveLength(24);
    const kane = s.players.find((p) => p.name === "Harry Kane")!;
    expect(kane).toMatchObject({ pos: "FWD", caps: 121, goals: 85, note: "captain" });
    expect(s.players.filter((p) => p.pos === "GK").map((p) => p.name)).toEqual(["Jordan Pickford", "James Trafford", "Jason Steele"]);
    expect(s.intro).toMatch(/withdrew due to injury/);
  });
});
