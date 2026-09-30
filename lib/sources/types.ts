export type SourceId =
  | "football-data"
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

export const SOURCES: Record<SourceId, { name: string; homepage: string }> = {
  "football-data": { name: "football-data.co.uk", homepage: "https://www.football-data.co.uk" },
  openligadb: { name: "OpenLigaDB", homepage: "https://www.openligadb.de" },
  "open-meteo": { name: "Open-Meteo", homepage: "https://open-meteo.com" },
  wikidata: { name: "Wikidata", homepage: "https://www.wikidata.org" },
  wikipedia: { name: "Wikipedia", homepage: "https://en.wikipedia.org" },
  bbc: { name: "BBC Sport", homepage: "https://www.bbc.co.uk/sport/football" },
  "google-news": { name: "Google News", homepage: "https://news.google.com" },
  thesportsdb: { name: "TheSportsDB", homepage: "https://www.thesportsdb.com" },
  fpl: { name: "Fantasy Premier League", homepage: "https://fantasy.premierleague.com" },
  "premier-league": { name: "Premier League", homepage: "https://www.premierleague.com" },
  uefa: { name: "UEFA", homepage: "https://www.uefa.com" },
  "international-results": { name: "International results (martj42, CC0)", homepage: "https://github.com/martj42/international_results" },
};

/** A source's display name and link; any name we no longer know (e.g. in an old saved report) shows as itself. */
export const sourceInfo = (id: string) => SOURCES[id as SourceId] ?? { name: id, homepage: "https://github.com/arshsyee/slipcheck" };

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
