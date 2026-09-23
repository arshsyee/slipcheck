const BASE = "https://api.the-odds-api.com/v4";
const CACHE_TTL_MS = 60_000;

export interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

export interface OddsMarket {
  key: "h2h" | "spreads" | "totals" | string;
  outcomes: OddsOutcome[];
}

export interface OddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
}

export interface OddsEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

interface CacheEntry {
  at: number;
  events: OddsEvent[];
  remaining: string | null;
}

// In-memory cache so repeat comparisons don't burn the free-tier quota.
const cache = new Map<string, CacheEntry>();

export class OddsApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function fetchOdds(
  sportKey: string,
  apiKey: string,
): Promise<{ events: OddsEvent[]; remaining: string | null }> {
  const cacheKey = `${sportKey}:${apiKey.slice(-6)}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit;

  const url = new URL(`${BASE}/sports/${sportKey}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us,us2");
  url.searchParams.set("markets", "h2h,spreads,totals");
  url.searchParams.set("oddsFormat", "american");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    let detail = body.slice(0, 200);
    try {
      detail = (JSON.parse(body) as { message?: string }).message ?? detail;
    } catch {}
    throw new OddsApiError(`The Odds API: ${detail}`, res.status);
  }
  const events = (await res.json()) as OddsEvent[];
  const entry = { at: Date.now(), events, remaining: res.headers.get("x-requests-remaining") };
  cache.set(cacheKey, entry);
  return entry;
}

/** Cheap call (doesn't count against quota) used by the Settings "Test" button. */
export async function testOddsKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${BASE}/sports?apiKey=${encodeURIComponent(apiKey)}`, { cache: "no-store" });
  if (!res.ok) return { ok: false, message: `The Odds API returned ${res.status}` };
  const remaining = res.headers.get("x-requests-remaining");
  return { ok: true, message: remaining ? `Connected: ${remaining} requests left this month` : "Connected" };
}
