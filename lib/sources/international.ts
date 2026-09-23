import { z } from "zod";
import { cached, DAY, HOUR } from "./cache";
import { fetchJson, fetchText } from "./http";
import { parseCsv, type MatchRow } from "./footballData";
import { getInfoboxCoach } from "./coach";
import { bestTeamMatch, normalize } from "../teams/match";

/**
 * National-team football from two free, open sources:
 * - Every men's international since 1872 (martj42/international_results, CC0, updated after each window):
 *   scores, competition, venue city, neutral ground. No kick-off times, xG, shots or cards.
 * - Wikipedia national-team pages: current coach, FIFA and Elo ranking (with the ranking's date).
 */
export const INTL_RESULTS_URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv";

/** Names used on slips/UEFA/FotMob → the dataset's names. */
const NAMES: Record<string, string> = {
  czechia: "Czech Republic",
  turkiye: "Turkey",
  "korea republic": "South Korea",
  "korea dpr": "North Korea",
  usa: "United States",
  "cote d ivoire": "Ivory Coast",
  "ir iran": "Iran",
  "bosnia herzegovina": "Bosnia and Herzegovina",
  "north macedonia": "North Macedonia",
  holland: "Netherlands",
  "cabo verde": "Cape Verde",
  "congo dr": "DR Congo",
};

export interface IntlRow extends MatchRow {
  /** Played at a neutral venue: neither side was at home. */
  neutral: boolean;
  city: string;
}

/** All results, oldest first. `div` holds the competition ("FIFA World Cup", "Friendly", …). */
export function getInternationalResults(): Promise<IntlRow[]> {
  return cached("intl:results", 6 * HOUR, async () => {
    const rows = parseCsv(await fetchText(INTL_RESULTS_URL));
    return rows.flatMap((r) => {
      const fthg = Number(r.home_score);
      const ftag = Number(r.away_score);
      if (!r.date || r.home_score === "NA" || !Number.isFinite(fthg) || !Number.isFinite(ftag)) return [];
      return [{
        div: r.tournament,
        // No kick-off times in the dataset; midday UTC keeps the date right in every European timezone.
        kickoff: `${r.date}T12:00:00.000Z`,
        home: r.home_team,
        away: r.away_team,
        fthg,
        ftag,
        hthg: null, htag: null, referee: null, hxg: null, axg: null, hs: null, as: null, hst: null, ast: null,
        hf: null, af: null, hc: null, ac: null, hy: null, ay: null, hr: null, ar: null,
        neutral: r.neutral === "TRUE",
        city: r.city,
      }];
    });
  });
}

/** The dataset's spelling of a national team, or null if the name isn't a national team that played in the last 4 years. */
export async function resolveNationalTeam(name: string): Promise<string | null> {
  const rows = await getInternationalResults();
  const cutoff = new Date(Date.now() - 4 * 365 * DAY).toISOString();
  const teams = [...new Set(rows.filter((r) => r.kickoff >= cutoff).flatMap((r) => [r.home, r.away]))];
  const wanted = NAMES[normalize(name)] ?? name;
  const exact = teams.find((t) => normalize(t) === normalize(wanted));
  if (exact) return exact;
  // Near-exact only: "Ivory Coast" vs "Ivory Coast" spelling variants, never club-like fuzzy matches.
  const hit = bestTeamMatch(wanted, teams, 0.9);
  return hit?.name ?? null;
}

export interface NationalTeamInfo {
  wikipediaTitle: string;
  coach: string | null;
  fifaRank: number | null;
  eloRank: number | null;
  /** Date of the FIFA ranking release, as Wikipedia states it ("20 July 2026"). */
  rankAsOf: string | null;
}

const ParseSchema = z.object({ parse: z.object({ title: z.string(), wikitext: z.string() }).optional() });
const ExpandSchema = z.object({ expandtemplates: z.object({ wikitext: z.string() }) });
const WIKI = "https://en.wikipedia.org/w/api.php";

async function infobox(title: string) {
  const d = await fetchJson(`${WIKI}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&section=0&format=json&formatversion=2&redirects=1`, ParseSchema);
  return d.parse ?? null;
}

/** "{{FIFA World Rankings|GHA}}" → "65", "(20 July 2026)". Wikipedia expands it from its own ranking data. */
async function expandRank(template: string): Promise<{ rank: number | null; asOf: string | null }> {
  const d = await fetchJson(`${WIKI}?action=expandtemplates&format=json&formatversion=2&prop=wikitext&text=${encodeURIComponent(template)}`, ExpandSchema);
  const w = d.expandtemplates.wikitext.replace(/<ref[\s\S]*$/, "");
  const m = w.match(/^\s*(?:<nowiki\/>)?\s*(\d+)\b/);
  return { rank: m ? Number(m[1]) : null, asOf: w.match(/\(([^)]*\d{4})\)/)?.[1] ?? null };
}

/** Coach and rankings from the team's Wikipedia page. Tries the usual title patterns ("… national football/soccer team"). */
export function getNationalTeamInfo(team: string): Promise<NationalTeamInfo | null> {
  return cached(`intl:wiki:${team}`, 12 * HOUR, async () => {
    const titles = [`${team} national football team`, `${team} men's national football team`, `${team} men's national soccer team`];
    for (const title of titles) {
      const page = await infobox(title);
      const w = page?.wikitext ?? "";
      if (!/\{\{\s*Infobox national football team/i.test(w)) continue; // disambiguation or redirect stub
      const field = (f: string) => w.match(new RegExp(`^\\s*\\|\\s*${f}\\s*=\\s*(.*)$`, "im"))?.[1]?.trim() ?? "";
      const [fifa, elo] = await Promise.all([
        /\{\{[^}]+\}\}/.test(field("FIFA Rank")) ? expandRank(field("FIFA Rank")).catch(() => null) : null,
        /\{\{[^}]+\}\}/.test(field("Elo Rank")) ? expandRank(field("Elo Rank")).catch(() => null) : null,
      ]);
      return {
        wikipediaTitle: page!.title,
        coach: await getInfoboxCoach(page!.title).catch(() => null),
        fifaRank: fifa?.rank ?? null,
        eloRank: elo?.rank ?? null,
        rankAsOf: fifa?.asOf ?? null,
      };
    }
    return null;
  });
}
