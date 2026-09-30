import { z } from "zod";
import { cached, DAY } from "./cache";
import { fetchJson } from "./http";
import { bestTeamMatch, normalize } from "../teams/match";

/**
 * Wikidata via the plain entity API (wbgetentities + search), not the SPARQL query service:
 * SPARQL timed out at 30s under load; these endpoints answer in ~0.2s.
 */
const API = "https://www.wikidata.org/w/api.php";

export interface ClubFacts {
  qid: string;
  label: string;
  founded: number | null;
  stadium: string | null;
  capacity: number | null;
  lat: number | null;
  lon: number | null;
  /** English Wikipedia article title, for the infobox (current manager). */
  wikipediaTitle: string | null;
}

/** Wikidata country items, to avoid e.g. Lesotho's "Arsenal". England clubs are often tagged United Kingdom. */
const COUNTRY_QID: Record<string, string[]> = {
  England: ["Q21", "Q145"], Germany: ["Q183"], Spain: ["Q29"], Italy: ["Q38"], France: ["Q142"],
};
const FOOTBALL_CLUB = "Q476028";

const Snak = z.object({ datavalue: z.object({ value: z.unknown() }).optional() });
const Claim = z.object({ mainsnak: Snak, qualifiers: z.record(z.string(), z.array(Snak)).optional() });
const EntitiesSchema = z.object({
  entities: z.record(
    z.string(),
    z.object({
      id: z.string().optional(),
      labels: z.record(z.string(), z.object({ value: z.string() })).optional(),
      aliases: z.record(z.string(), z.array(z.object({ value: z.string() }))).optional(),
      claims: z.record(z.string(), z.array(Claim)).optional(),
      sitelinks: z.record(z.string(), z.object({ title: z.string() })).optional(),
    }),
  ),
});
export type Entity = z.infer<typeof EntitiesSchema>["entities"][string];
type ClaimT = z.infer<typeof Claim>;
type SnakT = z.infer<typeof Snak>;

export async function getEntities(ids: string[], props = "claims|labels|sitelinks"): Promise<Record<string, Entity>> {
  const out: Record<string, Entity> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const url = `${API}?action=wbgetentities&format=json&languages=en|fr|de|es|it|pt&sitefilter=enwiki&props=${props}&ids=${ids.slice(i, i + 50).join("|")}`;
    Object.assign(out, (await fetchJson(url, EntitiesSchema)).entities);
  }
  return out;
}

const snakOf = (c: ClaimT | SnakT | undefined): SnakT | undefined => (c && "mainsnak" in c ? c.mainsnak : c);
const valueOf = (c: ClaimT | SnakT | undefined) => snakOf(c)?.datavalue?.value as Record<string, unknown> | undefined;

export const itemId = (c: ClaimT | SnakT | undefined) => (valueOf(c)?.id as string | undefined) ?? null;
export const timeOf = (c: ClaimT | SnakT | undefined) => (valueOf(c)?.time as string | undefined)?.replace(/^\+/, "") ?? null;
const quantity = (c: ClaimT | undefined) => Number(valueOf(c)?.amount) || 0;
export const label = (e: Entity | undefined) => e?.labels?.en?.value ?? null;
/** Statements still in force (no "end time" qualifier). */
export const current = (claims: ClaimT[] = []) => claims.filter((c) => !c.qualifiers?.P582);

/** Reserve/youth/women's sides ("Real Madrid C", "Barcelona B", "Arsenal W.F.C."). */
const SECONDARY = /(\s(B|C|II|III)$)|\b(U-?\d{2}|Castilla|Youth|Juvenil|Primavera|Jugend|Juniors?|Reserves?|Academy|Women|Ladies|W\.F\.C|Femen\w*|Frauen)\b/i;

const SearchSchema = z.object({ query: z.object({ search: z.array(z.object({ title: z.string() })) }) });

/** Current home ground (coordinates + capacity), founding year and Wikipedia article for a football club. */
export function getClubFacts(clubName: string, country?: string | null): Promise<ClubFacts | null> {
  return cached(`wikidata:v5:${clubName}:${country ?? ""}`, 30 * DAY, async () => {
    // Only search within a known country: worldwide, "Ghana" or "Portugal" match unrelated clubs with those names.
    const countries = (country && COUNTRY_QID[country]) || [];
    if (!countries.length) return null;
    const filter = [`haswbstatement:P31=${FOOTBALL_CLUB}`, countries.length ? `haswbstatement:${countries.map((q) => `P17=${q}`).join("|")}` : ""].join(" ");
    const q = `${clubName.replace(/["|]/g, "")} ${filter}`.trim();
    const s = await fetchJson(`${API}?action=query&format=json&list=search&srlimit=10&srsearch=${encodeURIComponent(q)}`, SearchSchema);
    const ids = s.query.search.map((r) => r.title);
    if (!ids.length) return null;

    const ents = Object.values(await getEntities(ids)).filter((e) => label(e));
    const pool = SECONDARY.test(clubName) ? ents : ents.filter((e) => !SECONDARY.test(label(e)!));
    const hit = bestTeamMatch(clubName, pool.map((e) => label(e)!), 0.5);
    const club = pool.find((e) => label(e) === hit?.name);
    if (!club) return null;

    // Clubs can list several current venues (e.g. a training complex); the main ground is the biggest.
    const venueIds = current(club.claims?.P115).map(itemId).filter((x): x is string => Boolean(x));
    const venues = venueIds.length ? Object.values(await getEntities(venueIds, "claims|labels")) : [];
    const cap = (v: Entity) => quantity(v.claims?.P1083?.[0]);
    const venue = venues.sort((a, b) => cap(b) - cap(a))[0];
    const point = valueOf(venue?.claims?.P625?.[0]) as { latitude?: number; longitude?: number } | undefined;
    const founded = timeOf(club.claims?.P571?.[0]);

    return {
      qid: club.id!,
      label: label(club)!,
      founded: founded ? Number(founded.slice(0, 4)) || null : null,
      stadium: label(venue),
      capacity: venue ? cap(venue) || null : null,
      lat: point?.latitude ?? null,
      lon: point?.longitude ?? null,
      wikipediaTitle: club.sitelinks?.enwiki?.title ?? null,
    };
  });
}

/** Coordinates of a stadium by its exact name (for weather). Null when no single exact match exists. */
export function getVenueCoords(venue: string): Promise<{ lat: number; lon: number } | null> {
  return cached(`wikidata:venue:v3:${venue}`, 30 * DAY, async () => {
    const q = `${venue.replace(/["|]/g, "")} haswbstatement:P625`;
    const s = await fetchJson(`${API}?action=query&format=json&list=search&srlimit=5&srsearch=${encodeURIComponent(q)}`, SearchSchema);
    const ids = s.query.search.map((r) => r.title);
    if (!ids.length) return null;
    // Exact name in any of its languages or alternative names ("Alassane Ouattara Stadium" = "Stade Olympique Alassane Ouattara").
    const names = (e: Entity) => [...Object.values(e.labels ?? {}).map((l) => l.value), ...Object.values(e.aliases ?? {}).flat().map((a) => a.value)].map(normalize);
    const exact = Object.values(await getEntities(ids, "claims|labels|aliases")).filter((e) => names(e).includes(normalize(venue)));
    // Two stadiums sharing the name: don't guess.
    if (exact.length !== 1) return null;
    const p = valueOf(exact[0].claims?.P625?.[0]) as { latitude?: number; longitude?: number } | undefined;
    return p?.latitude != null && p.longitude != null ? { lat: p.latitude, lon: p.longitude } : null;
  });
}
