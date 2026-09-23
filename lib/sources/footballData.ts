import { cached, DAY, HOUR } from "./cache";
import { fetchText } from "./http";
import { seasonCode } from "../leagues";

/** One played match from a football-data.co.uk season file. Odds columns are deliberately not parsed. */
export interface MatchRow {
  div: string;
  kickoff: string; // ISO, UTC
  home: string;
  away: string;
  fthg: number;
  ftag: number;
  hthg: number | null;
  htag: number | null;
  referee: string | null;
  hxg: number | null;
  axg: number | null;
  hs: number | null;
  as: number | null;
  hst: number | null;
  ast: number | null;
  hf: number | null;
  af: number | null;
  hc: number | null;
  ac: number | null;
  hy: number | null;
  ay: number | null;
  hr: number | null;
  ar: number | null;
}

export interface FixtureRow {
  div: string;
  kickoff: string;
  home: string;
  away: string;
  referee: string | null;
}

const BASE = "https://www.football-data.co.uk";

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const num = (v: string | undefined) => (v == null || v === "" || isNaN(Number(v)) ? null : Number(v));

/** football-data.co.uk dates are dd/mm/yy(yy) with UK local kick-off times. */
export function ukToIso(date: string, time?: string): string {
  const [d, m, yRaw] = date.split("/").map(Number);
  const y = yRaw < 100 ? 2000 + yRaw : yRaw;
  const [hh, mm] = (time || "15:00").split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  return new Date(asUtc - londonOffsetMinutes(asUtc) * 60_000).toISOString();
}

function londonOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((local - utcMs) / 60_000);
}

export function toMatchRow(r: Record<string, string>): MatchRow | null {
  const fthg = num(r.FTHG);
  const ftag = num(r.FTAG);
  if (!r.HomeTeam || !r.AwayTeam || fthg == null || ftag == null || !r.Date) return null;
  return {
    div: r.Div,
    kickoff: ukToIso(r.Date, r.Time),
    home: r.HomeTeam,
    away: r.AwayTeam,
    fthg,
    ftag,
    hthg: num(r.HTHG),
    htag: num(r.HTAG),
    referee: r.Referee || null,
    hxg: num(r.HxG),
    axg: num(r.AxG),
    hs: num(r.HS),
    as: num(r.AS),
    hst: num(r.HST),
    ast: num(r.AST),
    hf: num(r.HF),
    af: num(r.AF),
    hc: num(r.HC),
    ac: num(r.AC),
    hy: num(r.HY),
    ay: num(r.AY),
    hr: num(r.HR),
    ar: num(r.AR),
  };
}

/** Played matches for one division and season ("2627" = 2026/27). Current season refreshes every 6h. */
export function getSeason(div: string, season = seasonCode()): Promise<MatchRow[]> {
  const url = `${BASE}/mmz4281/${season}/${div}.csv`;
  const ttl = season === seasonCode() ? 6 * HOUR : 30 * DAY;
  return cached(`fd:${url}`, ttl, async () => {
    const rows = parseCsv(await fetchText(url));
    return rows.map(toMatchRow).filter((r): r is MatchRow => r !== null);
  }, { disk: true });
}

/** Current season plus `back` previous seasons, oldest first. Missing past seasons (e.g. newly added divisions) are skipped. */
export async function getSeasons(div: string, back = 4): Promise<MatchRow[]> {
  const seasons = Array.from({ length: back + 1 }, (_, i) => seasonCode(new Date(), back - i));
  const results = await Promise.allSettled(seasons.map((s) => getSeason(div, s)));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

/** Upcoming fixtures across all covered divisions (published a few days ahead, with referees when appointed). */
export function getFixtures(): Promise<FixtureRow[]> {
  const url = `${BASE}/fixtures.csv`;
  return cached(`fd:${url}`, 3 * HOUR, async () => {
    return parseCsv(await fetchText(url))
      .filter((r) => r.HomeTeam && r.AwayTeam && r.Date)
      .map((r) => ({
        div: r.Div,
        kickoff: ukToIso(r.Date, r.Time),
        home: r.HomeTeam,
        away: r.AwayTeam,
        referee: r.Referee || null,
      }));
  }, { disk: true });
}

export const FD_SOURCE_URL = (div: string) => `${BASE}/mmz4281/${seasonCode()}/${div}.csv`;
