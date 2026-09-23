import { TEAM_ALIASES } from "./aliases";

/** Tokens that carry no identity ("FC", "de", "1899"). */
const GENERIC = new Set([
  "fc", "afc", "cf", "sc", "sv", "as", "ss", "us", "cd", "ud", "rc", "sd", "ca", "club", "de", "del", "the", "and",
  "of", "calcio", "fk", "sk", "bk", "vfb", "vfl", "tsg", "cp", "sl", "bsc", "futbol", "football", "fussball", "voetbal",
]);

/** Tokens that tell apart clubs from the same city (Manchester United/City, Real/Atlético Madrid, Inter/AC Milan). */
const QUALIFIERS = new Set([
  "united", "utd", "city", "real", "atletico", "athletic", "inter", "ac", "sporting", "rovers", "wanderers", "albion",
  "county", "town", "hotspur", "wednesday", "olympique", "rayo",
]);

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Abbreviations used by football-data.co.uk and bookmakers. Applied after alias lookup. */
const EXPAND: Record<string, string> = {
  st: "saint", sth: "south", utd: "united", sp: "sporting", ein: "eintracht", weds: "wednesday", rvs: "rovers", wdrs: "wanderers",
  munchen: "munich",
};

export function canonical(s: string): string {
  const n = normalize(s);
  const aliased = TEAM_ALIASES[n] ?? n;
  return aliased
    .split(" ")
    .map((t) => EXPAND[t] ?? t)
    .join(" ");
}

function parts(name: string) {
  const tokens = canonical(name)
    .split(" ")
    .filter((t) => t && !/^\d+$/.test(t));
  return {
    // Single letters are initials ("B. Dortmund", "U. Craiova") and carry no identity on their own.
    distinctive: tokens.filter((t) => t.length > 1 && !GENERIC.has(t) && !QUALIFIERS.has(t)),
    qualifiers: new Set(tokens.filter((t) => QUALIFIERS.has(t))),
  };
}

/** Token equality that tolerates spelling variants: Olympiakos/Olympiacos, Tripolis/Tripoli, Goztep/Goztepe. */
function sameToken(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 5 && long.startsWith(short) && long.length - short.length <= 2) return true;
  return short.length >= 7 && long.length - short.length <= 1 && editDistanceAtMost1(short, long);
}

function editDistanceAtMost1(a: string, b: string): boolean {
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length === b.length) i++;
    j++;
  }
  return edits + (b.length - j) + (a.length - i) <= 1;
}

const sharedCount = (a: string[], b: string[]) => a.filter((t) => b.some((u) => sameToken(t, u))).length;

/** Different clubs whose names contain one another; never treat them as the same club. */
const DIFFERENT_CLUBS = [["paris fc", "paris saint germain"]];

/** 0..1 similarity between two club names ("Man Utd" vs "Manchester United" → 1). */
export function teamScore(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  const ca = canonical(a);
  const cb = canonical(b);
  if (ca === cb) return 1;
  if (DIFFERENT_CLUBS.some(([x, y]) => (ca === x && cb === y) || (ca === y && cb === x))) return 0;
  const pa = parts(a);
  const pb = parts(b);
  if (!pa.distinctive.length || !pb.distinctive.length) return 0;

  const qa = pa.qualifiers;
  const qb = pb.qualifiers;
  // Same city, different club: Manchester United vs City, Real vs Atlético Madrid, Inter vs AC Milan.
  if (qa.size && qb.size && ![...qa].some((q) => qb.has(q))) return 0;

  const shared = sharedCount(pa.distinctive, pb.distinctive);
  const maxLen = Math.max(pa.distinctive.length, pb.distinctive.length);
  const minLen = Math.min(pa.distinctive.length, pb.distinctive.length);
  if (shared === minLen) {
    // One name's identity is contained in the other's.
    // Dundee vs Dundee United: identical core, but only one side has a qualifier, so likely a different club.
    if (shared === maxLen && qa.size !== qb.size) return 0.6;
    return 0.7 + (0.25 * shared) / maxLen;
  }
  return (0.6 * shared) / maxLen;
}

export const MATCH_THRESHOLD = 0.5;
const DRAW = /^(the )?(draw|tie|x)$/i;

export function isDraw(s: string) {
  return DRAW.test(s.trim());
}

/** Best-scoring candidate name for `name`, or null if nothing clears the threshold. */
export function bestTeamMatch(name: string, candidates: string[], threshold = MATCH_THRESHOLD) {
  let best: { name: string; score: number } | null = null;
  for (const c of candidates) {
    const score = teamScore(name, c);
    if (score > (best?.score ?? 0)) best = { name: c, score };
  }
  return best && best.score >= threshold ? best : null;
}

/**
 * Finds the fixture for a home/away pair. Allows home/away to be swapped on the slip,
 * and falls back to a single known team when the other is missing.
 */
export function matchFixture<T extends { home: string; away: string }>(
  home: string | null,
  away: string | null,
  fixtures: T[],
): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const f of fixtures) {
    let score: number;
    if (home && away) {
      score = Math.max(
        Math.min(teamScore(home, f.home), teamScore(away, f.away)),
        Math.min(teamScore(home, f.away), teamScore(away, f.home)) * 0.95,
      );
    } else {
      const one = (home ?? away)!;
      if (!one) continue;
      score = Math.max(teamScore(one, f.home), teamScore(one, f.away)) * 0.8;
    }
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}
