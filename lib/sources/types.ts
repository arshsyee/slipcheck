export type SourceId =
  | "football-data"
  | "espn"
  | "openligadb"
  | "open-meteo"
  | "wikidata"
  | "wikipedia"
  | "bbc"
  | "google-news"
  | "thesportsdb"
  | "fpl"
  | "premier-league"
  | "uefa"
  | "international-results";

export const SOURCES: Record<SourceId, { name: string; homepage: string; tier: "A" | "B" }> = {
  "football-data": { name: "football-data.co.uk", homepage: "https://www.football-data.co.uk", tier: "A" },
  openligadb: { name: "OpenLigaDB", homepage: "https://www.openligadb.de", tier: "A" },
  "open-meteo": { name: "Open-Meteo", homepage: "https://open-meteo.com", tier: "A" },
  wikidata: { name: "Wikidata", homepage: "https://www.wikidata.org", tier: "A" },
  wikipedia: { name: "Wikipedia", homepage: "https://en.wikipedia.org", tier: "A" },
  bbc: { name: "BBC Sport", homepage: "https://www.bbc.co.uk/sport/football", tier: "A" },
  "google-news": { name: "Google News", homepage: "https://news.google.com", tier: "A" },
  thesportsdb: { name: "TheSportsDB", homepage: "https://www.thesportsdb.com", tier: "A" },
  espn: { name: "ESPN", homepage: "https://www.espn.com/soccer", tier: "B" },
  fpl: { name: "Fantasy Premier League", homepage: "https://fantasy.premierleague.com", tier: "B" },
  "premier-league": { name: "Premier League", homepage: "https://www.premierleague.com", tier: "B" },
  uefa: { name: "UEFA", homepage: "https://www.uefa.com", tier: "B" },
  "international-results": { name: "International results (martj42, CC0)", homepage: "https://github.com/martj42/international_results", tier: "A" },
};

/** Every dossier section carries where its data came from and when. */
export type SourceResult<T> =
  | { ok: true; data: T; source: SourceId; fetchedAt: string; url?: string }
  | { ok: false; error: string; source: SourceId; fetchedAt: string; url?: string };

export async function fromSource<T>(source: SourceId, run: () => Promise<T>, url?: string): Promise<SourceResult<T>> {
  const fetchedAt = new Date().toISOString();
  try {
    return { ok: true, data: await run(), source, fetchedAt, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), source, fetchedAt, url };
  }
}

export class NotFoundError extends Error {}
