import { z } from "zod";
import { cached, HOUR } from "./cache";
import { fetchJson } from "./http";
import { getSeasonMatches, openLigaSeason } from "./openLigaDb";
import { params, plain, templates } from "./squad";
import { bestTeamMatch } from "../teams/match";
import type { EspnEvent } from "./espn";

/**
 * Domestic cup results without ESPN: OpenLigaDB for the DFB-Pokal, Wikipedia's season pages for the rest.
 * Top clubs enter some cups late (FA Cup in January, Coupe de France in December): until then there's nothing to show.
 */
const CUPS: Record<string, { name: string; wikipedia?: (season: string) => string; openLigaDb?: string }[]> = {
  England: [
    { name: "EFL Cup", wikipedia: (s) => `${s} EFL Cup` },
    { name: "FA Cup", wikipedia: (s) => `${s} FA Cup` },
  ],
  Spain: [{ name: "Copa del Rey", wikipedia: (s) => `${s} Copa del Rey` }],
  Italy: [{ name: "Coppa Italia", wikipedia: (s) => `${s} Coppa Italia` }],
  France: [{ name: "Coupe de France", wikipedia: (s) => `${s} Coupe de France` }],
  Germany: [{ name: "DFB-Pokal", openLigaDb: "dfb" }],
};

export interface CupMatch {
  date: string;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  /** Shoot-out score when the tie went to penalties, e.g. "3–4". */
  penalties: string | null;
}

/** "2026–27" for a date in the 2026/27 season (seasons start 1 July). */
export function seasonLabel(date = new Date()) {
  const y = date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `${y}–${String(y + 1).slice(2)}`;
}

/** Played matches from Wikipedia {{Football box}} / {{Football box collapsible}} templates. Unplayed ones (no score) are skipped. */
export function parseFootballBoxes(wikitext: string): CupMatch[] {
  const out: CupMatch[] = [];
  for (const t of templates(wikitext)) {
    const p = params(t);
    if (!/^football ?box( collapsible)?$/i.test(p[0])) continue;
    const score = plain(p.score ?? "").match(/(\d+)\s*[–-]\s*(\d+)/);
    const start = (p.date ?? "").match(/\{\{\s*start date\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/i);
    const when = start ? Date.UTC(+start[1], +start[2] - 1, +start[3], 12) : Date.parse(`${plain(p.date ?? "")} 12:00 UTC`);
    // Team cells carry the tier ("Tranmere Rovers (4)") and bold for the winner; keep just the name.
    const team = (v?: string) => plain(v ?? "").replace(/\(\d+\)/g, "").trim();
    const home = team(p.team1);
    const away = team(p.team2);
    if (!score || Number.isNaN(when) || !home || !away) continue;
    const pens = plain(p.penaltyscore ?? "").match(/(\d+)\s*[–-]\s*(\d+)/);
    out.push({ date: new Date(when).toISOString(), home, away, homeGoals: +score[1], awayGoals: +score[2], penalties: pens ? `${pens[1]}–${pens[2]}` : null });
  }
  return out;
}

const ParseSchema = z.object({ parse: z.object({ wikitext: z.string() }).optional() });

function wikiCup(title: string): Promise<CupMatch[]> {
  return cached(`cups:wiki:${title}`, 6 * HOUR, async () => {
    const d = await fetchJson(`https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&redirects=1&prop=wikitext&page=${encodeURIComponent(title)}`, ParseSchema);
    return parseFootballBoxes(d.parse?.wikitext ?? "");
  });
}

async function openLigaCup(league: string): Promise<CupMatch[]> {
  const matches = await getSeasonMatches(league, openLigaSeason());
  return matches.filter((m) => m.finished && m.score).map((m) => ({ date: m.kickoff, home: m.home, away: m.away, homeGoals: m.score![0], awayGoals: m.score![1], penalties: null }));
}

/**
 * This season's domestic cup games for a club, in the same shape as league/European results (our club's id = `teamId`).
 * Names must match closely (0.8): a cup draw is full of lower-league clubs with similar names.
 */
export async function getCupResults(country: string, club: string, teamId: string): Promise<EspnEvent[]> {
  const season = seasonLabel();
  const lists = await Promise.all(
    (CUPS[country] ?? []).map(async (cup) => ({ cup, matches: await (cup.openLigaDb ? openLigaCup(cup.openLigaDb) : wikiCup(cup.wikipedia!(season))) })),
  );
  return lists.flatMap(({ cup, matches }) => {
    const hit = bestTeamMatch(club, [...new Set(matches.flatMap((m) => [m.home, m.away]))], 0.8);
    if (!hit) return [];
    return matches
      .filter((m) => m.home === hit.name || m.away === hit.name)
      .map((m, i) => ({
        id: `cup:${cup.name}:${m.date}:${i}`,
        date: m.date,
        completed: true,
        competition: m.penalties ? `${cup.name} (penalties ${m.penalties})` : cup.name,
        slug: `cup:${cup.name}`,
        venue: null,
        home: { id: m.home === hit.name ? teamId : m.home, name: m.home, score: m.homeGoals },
        away: { id: m.away === hit.name ? teamId : m.away, name: m.away, score: m.awayGoals },
      }));
  });
}
