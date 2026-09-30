import { z } from "zod";
import { cached, DAY, HOUR } from "./cache";
import { fetchJson } from "./http";
import { getSeasonMatches, openLigaSeason } from "./openLigaDb";
import { params, plain, templates } from "./squad";
import { bestTeamMatch } from "../teams/match";
import type { EspnEvent } from "./espn";
import type { H2HMeeting } from "../stats/match";

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

/** Ties with a date and both teams but no score yet (draws that are made, games not played). */
export function parseUpcomingBoxes(wikitext: string): { date: string; home: string; away: string }[] {
  const out: { date: string; home: string; away: string }[] = [];
  for (const t of templates(wikitext)) {
    const p = params(t);
    if (!/^football ?box( collapsible)?$/i.test(p[0])) continue;
    if (/\d+\s*[–-]\s*\d+/.test(plain(p.score ?? ""))) continue;
    const start = (p.date ?? "").match(/\{\{\s*start date\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/i);
    const when = start ? Date.UTC(+start[1], +start[2] - 1, +start[3], 12) : Date.parse(`${plain(p.date ?? "")} 12:00 UTC`);
    const team = (v?: string) => plain(v ?? "").replace(/\(\d+\)/g, "").trim();
    const home = team(p.team1);
    const away = team(p.team2);
    // "Winner of match 12" placeholders never match a club name, so they drop out later.
    if (Number.isNaN(when) || !home || !away) continue;
    out.push({ date: new Date(when).toISOString(), home, away });
  }
  return out;
}

/** This season's scheduled, unplayed domestic cup ties for a country's cups. */
export async function getUpcomingCupTies(country: string): Promise<{ date: string; home: string; away: string; competition: string }[]> {
  const season = seasonLabel();
  const lists = await Promise.all(
    (CUPS[country] ?? []).map(async (cup) => {
      if (cup.openLigaDb) {
        const matches = await getSeasonMatches(cup.openLigaDb, openLigaSeason());
        return matches.filter((m) => !m.finished).map((m) => ({ date: m.kickoff, home: m.home, away: m.away, competition: cup.name }));
      }
      const title = cup.wikipedia!(season);
      const ties = await cached(`cups:wiki-upcoming:${title}`, 6 * HOUR, async () => {
        const d = await fetchJson(`https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&redirects=1&prop=wikitext&page=${encodeURIComponent(title)}`, ParseSchema);
        return parseUpcomingBoxes(d.parse?.wikitext ?? "");
      });
      return ties.map((x) => ({ ...x, competition: cup.name }));
    }),
  );
  return lists.flat();
}

const ParseSchema = z.object({ parse: z.object({ wikitext: z.string() }).optional() });

function wikiCup(title: string, past = false): Promise<CupMatch[]> {
  return cached(`cups:wiki:${title}`, past ? 30 * DAY : 6 * HOUR, async () => {
    const d = await fetchJson(`https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&redirects=1&prop=wikitext&page=${encodeURIComponent(title)}`, ParseSchema);
    return parseFootballBoxes(d.parse?.wikitext ?? "");
  });
}

async function openLigaCup(league: string, season = openLigaSeason()): Promise<CupMatch[]> {
  const matches = await getSeasonMatches(league, season);
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

/** Cup meetings between two clubs from the same country over the last `seasons` seasons, newest first. */
export async function getCupMeetings(country: string, a: string, b: string, seasons = 5): Promise<H2HMeeting[]> {
  const now = new Date();
  const back = (k: number) => new Date(Date.UTC(now.getUTCFullYear() - k, now.getUTCMonth(), now.getUTCDate()));
  const lists = await Promise.all(
    (CUPS[country] ?? []).flatMap((cup) =>
      Array.from({ length: seasons }, async (_, k) => ({
        cup,
        // A cup page that doesn't exist (e.g. not started yet) is simply empty.
        matches: await (cup.openLigaDb ? openLigaCup(cup.openLigaDb, openLigaSeason(back(k))) : wikiCup(cup.wikipedia!(seasonLabel(back(k))), k > 0)).catch(() => [] as CupMatch[]),
      })),
    ),
  );
  const out: H2HMeeting[] = [];
  for (const { cup, matches } of lists) {
    const names = [...new Set(matches.flatMap((m) => [m.home, m.away]))];
    const ha = bestTeamMatch(a, names, 0.8)?.name;
    const hb = bestTeamMatch(b, names, 0.8)?.name;
    if (!ha || !hb) continue;
    for (const m of matches) {
      if (!((m.home === ha && m.away === hb) || (m.home === hb && m.away === ha))) continue;
      out.push({ competition: m.penalties ? `${cup.name} (penalties ${m.penalties})` : cup.name, kickoff: m.date, home: m.home, away: m.away, homeGoals: m.homeGoals, awayGoals: m.awayGoals });
    }
  }
  return out.sort((x, y) => y.kickoff.localeCompare(x.kickoff));
}
