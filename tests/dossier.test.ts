import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { MatchDossier } from "../lib/dossier/types";

/**
 * Offline: football-data.co.uk is served from the real recorded snapshot; every other source is "down".
 * The dossier must still build, compute stats from what's available, and report each failure.
 */
describe("buildDossier with most sources failing (no network)", () => {
  let d: MatchDossier;
  const calls: string[] = [];

  beforeAll(async () => {
    // Isolate the disk cache so real cached CSVs from dev runs aren't used.
    vi.spyOn(process, "cwd").mockReturnValue(mkdtempSync(join(tmpdir(), "slipcheck-test-")));
    const csv = readFileSync("tests/fixtures/snapshot/E0.csv", "utf8");
    const { seasonCode } = await import("../lib/leagues");
    vi.stubGlobal("fetch", async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith(`/mmz4281/${seasonCode()}/E0.csv`)) return new Response(csv);
      if (url.endsWith("/fixtures.csv")) return new Response("Div,Date,Time,HomeTeam,AwayTeam,Referee\n");
      return new Response("unavailable", { status: 500 });
    });
    const { buildDossier } = await import("../lib/dossier/build");
    d = await buildDossier(
      // Real next fixture (2026-10-10).
      { league: "EPL", homeTeam: "Arsenal", awayTeam: "Leeds United", market: "1x2", selection: "Arsenal", line: null, oddsDecimal: null },
      0,
    );
  }, 30_000);

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("computes stats and the table from the source that worked", () => {
    const s = d.home.stats.ok ? d.home.stats.data! : null;
    expect(s?.fdName).toBe("Arsenal");
    // ESPN's table in the same snapshot: P5, 4-0-1.
    expect(s?.overall.form10).toMatchObject({ won: 4, drawn: 0, lost: 1 });
    expect(d.home.standing?.ok && d.home.standing.data?.rank).toBe(2);
  });

  it("builds head-to-head from whatever seasons are available", () => {
    // Older season files are "down"; Arsenal and Leeds haven't met yet this season.
    expect(d.h2h?.ok).toBe(true);
    if (d.h2h?.ok) expect(d.h2h.data.meetings).toHaveLength(0);
  });

  it("marks failed sources instead of throwing", () => {
    expect(d.fixture.found).toBe(false);
    expect(d.home.news.ok).toBe(false); // every news feed down → reported, not an empty list
    expect(d.home.availability.ok).toBe(false); // FPL and news both down
    const failed = new Set(d.sourceLog.filter((s) => !s.ok).map((s) => s.source));
    expect(failed.has("fpl")).toBe(true);
    expect(failed.has("google-news")).toBe(true);
    expect(d.sourceLog.some((s) => s.ok && s.source === "football-data")).toBe(true);
  });

  it("still produces the pick comparison table from the data it has", () => {
    const row = (label: string) => d.pick.stats.find((r) => r.label === label);
    // Arsenal in the snapshot: 4-0-1 overall.
    expect(row("Last 5 (oldest → newest)")?.home.split(" ").filter((x) => x === "W")).toHaveLength(4);
    expect(row("Record")?.group).toBe("Arsenal at home · Leeds United away");
  });
});

describe("a source that goes down after we've seen it", () => {
  it("serves the last saved copy, labelled with its age, instead of a hole", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(mkdtempSync(join(tmpdir(), "slipcheck-test-")));
    const { cached, staleLog } = await import("../lib/sources/cache");
    const table = [{ team: "Arsenal", points: 12 }];
    // ttl -1: the saved copy is always "expired" (even within the same millisecond), so the second call goes to the source.
    expect(await cached("espn:standings:test", -1, async () => table)).toEqual(table);
    const served = await cached("espn:standings:test", -1, async () => {
      throw new Error("site.api.espn.com returned 403");
    });
    expect(served).toEqual(table);
    expect(staleLog.at(-1)).toMatchObject({ key: "espn:standings:test", error: "site.api.espn.com returned 403" });
    // Never seen before + source down → the error still surfaces.
    await expect(cached("espn:standings:never", 0, async () => { throw new Error("down"); })).rejects.toThrow("down");
    vi.restoreAllMocks();
  });
});

describe("source names in old saved reports", () => {
  it("shows a source we no longer use by its own name instead of crashing", async () => {
    const { sourceInfo } = await import("../lib/sources/types");
    expect(sourceInfo("espn").name).toBe("espn");
    expect(sourceInfo("uefa").name).toBe("UEFA");
  });
});
