import { z } from "zod";
import { cached, DAY, HOUR } from "./cache";
import { fetchJson } from "./http";
import { normalize } from "../teams/match";
import { getEntities, itemId, label, timeOf } from "./wikidata";

/**
 * Current head coach, from two independent free sources:
 * - Wikipedia club infobox ("manager =" / "head coach ="): usually updated within hours of an appointment.
 * - Wikidata "head coach" (P286) statements: appointment date, age, nationality, predecessors.
 * Checked on 2026-09-23: both agreed on all clubs sampled. ESPN's coach field is not used (it listed Wenger at Arsenal).
 */
export interface Coach {
  name: string;
  /** Appointment date; null when the source only knows the year (see `sinceYear`). */
  since: string | null;
  sinceYear: number | null;
  age: number | null;
  nationality: string | null;
  /** The coach before them, if they left during the current season (for before/after comparisons). */
  predecessor: { name: string; until: string | null } | null;
  /** "confirmed" = Wikipedia and Wikidata agree; otherwise which one we went with. */
  agreement: "confirmed" | "wikipedia-only" | "wikidata-only" | "conflict";
  wikipediaName: string | null;
  wikidataName: string | null;
}

interface Tenure {
  name: string;
  start: string | null;
  end: string | null;
  dob: string | null;
  nationality: string | null;
}

/** Every head-coach spell (P286) recorded on Wikidata for a club, newest first. Uses the entity API (fast). */
export function getCoachHistory(clubQid: string): Promise<Tenure[]> {
  return cached(`coach:wikidata:v3:${clubQid}`, 12 * HOUR, async () => {
    const club = (await getEntities([clubQid], "claims"))[clubQid];
    const spells = (club?.claims?.P286 ?? []).map((c) => ({
      id: itemId(c),
      start: timeOf(c.qualifiers?.P580?.[0]),
      end: timeOf(c.qualifiers?.P582?.[0]),
    }));
    const coachIds = [...new Set(spells.map((s) => s.id).filter((x): x is string => Boolean(x)))];
    const coaches = coachIds.length ? await getEntities(coachIds, "claims|labels") : {};
    const natIds = [...new Set(Object.values(coaches).map((e) => itemId(e.claims?.P27?.[0])).filter((x): x is string => Boolean(x)))];
    const nats = natIds.length ? await getEntities(natIds, "labels") : {};
    return spells
      .filter((s) => s.id && coaches[s.id])
      .map((s) => {
        const e = coaches[s.id!];
        const nat = itemId(e.claims?.P27?.[0]);
        return {
          name: label(e) ?? "",
          start: s.start,
          end: s.end,
          dob: timeOf(e.claims?.P569?.[0]?.mainsnak),
          nationality: nat ? label(nats[nat]) : null,
        };
      })
      .sort((a, b) => (b.start ?? "").localeCompare(a.start ?? ""));
  }, { disk: true });
}

const ParseSchema = z.object({ parse: z.object({ wikitext: z.string() }).optional() });

/** The manager / head coach named in a club's Wikipedia infobox. */
export function getInfoboxCoach(title: string): Promise<string | null> {
  return cached(`coach:wikipedia:${title}`, 6 * HOUR, async () => {
    const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&section=0&format=json&formatversion=2&redirects=1`;
    const d = await fetchJson(url, ParseSchema);
    const w = d.parse?.wikitext ?? "";
    const m = w.match(/^\s*\|\s*(?:manager|head coach|headcoach|coach)\s*=\s*(.+)$/im);
    if (!m) return null;
    const name = m[1]
      .replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\{\{[^}]*\}\}/g, "")
      .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1")
      .replace(/\(.*?\)/g, "")
      .trim();
    return name || null;
  });
}

/** Same person? Compares surnames and first initial after removing accents ("José Mourinho" = "Jose Mourinho"). */
export function samePerson(a: string, b: string): boolean {
  const pa = normalize(a).split(" ");
  const pb = normalize(b).split(" ");
  return pa.at(-1) === pb.at(-1) && pa[0][0] === pb[0][0];
}

export async function getCoach(clubQid: string, wikipediaTitle: string | null, seasonStart: string): Promise<Coach | null> {
  const [history, wikiName] = await Promise.all([
    getCoachHistory(clubQid).catch(() => [] as Tenure[]),
    wikipediaTitle ? getInfoboxCoach(wikipediaTitle).catch(() => null) : Promise.resolve(null),
  ]);
  const current = history.find((t) => !t.end) ?? null;
  if (!current && !wikiName) return null;

  // Wikipedia is fresher for *who*; Wikidata has the *dates*. Use the Wikidata spell for whoever Wikipedia names.
  const name = wikiName ?? current!.name;
  const spell = history.find((t) => samePerson(t.name, name) && !t.end) ?? history.find((t) => samePerson(t.name, name)) ?? null;
  const agreement: Coach["agreement"] =
    wikiName && current ? (samePerson(wikiName, current.name) ? "confirmed" : "conflict") : wikiName ? "wikipedia-only" : "wikidata-only";

  // Wikidata gives some dates only to the year ("+2026-00-00"): never treat that as 1 January.
  const since = spell?.start && !/-00/.test(spell.start.slice(0, 10)) ? spell.start : null;
  const sinceYear = spell?.start ? Number(spell.start.slice(0, 4)) || null : null;
  const prev = since ? history.find((t) => t.end && t.end <= since && t.end >= seasonStart && !samePerson(t.name, name)) : null;
  return {
    name,
    since,
    sinceYear,
    age: spell?.dob ? Math.floor((Date.now() - new Date(spell.dob).getTime()) / (365.25 * DAY)) : null,
    nationality: spell?.nationality ?? null,
    predecessor: prev ? { name: prev.name, until: prev.end } : null,
    agreement,
    wikipediaName: wikiName,
    wikidataName: current?.name ?? null,
  };
}
