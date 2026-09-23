import { z } from "zod";
import { cached, DAY } from "./cache";
import { fetchJson } from "./http";
import { bestTeamMatch } from "../teams/match";

export interface ClubProfile {
  name: string;
  founded: number | null;
  stadium: string | null;
  capacity: number | null;
  location: string | null;
  badge: string | null;
  website: string | null;
  description: string | null;
  espnId: string | null;
}

const Schema = z.object({
  teams: z
    .array(
      z.object({
        strTeam: z.string(),
        strSport: z.string().nullable().optional(),
        intFormedYear: z.string().nullable().optional(),
        strStadium: z.string().nullable().optional(),
        intStadiumCapacity: z.string().nullable().optional(),
        strLocation: z.string().nullable().optional(),
        strBadge: z.string().nullable().optional(),
        strWebsite: z.string().nullable().optional(),
        strDescriptionEN: z.string().nullable().optional(),
        idESPN: z.string().nullable().optional(),
      }),
    )
    .nullable(),
});

/** TheSportsDB club profile via its public test key ("3"). */
export function getClubProfile(club: string): Promise<ClubProfile | null> {
  return cached(`sportsdb:${club}`, 7 * DAY, async () => {
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(club)}`;
    const d = await fetchJson(url, Schema);
    const soccer = (d.teams ?? []).filter((t) => (t.strSport ?? "Soccer") === "Soccer");
    const hit = bestTeamMatch(club, soccer.map((t) => t.strTeam));
    const t = soccer.find((x) => x.strTeam === hit?.name);
    if (!t) return null;
    const n = (v?: string | null) => (v && Number(v) > 0 ? Number(v) : null);
    const description = t.strDescriptionEN?.split(/\r?\n/).find((p) => p.trim().length > 40)?.trim() ?? null;
    return {
      name: t.strTeam,
      founded: n(t.intFormedYear),
      stadium: t.strStadium ?? null,
      capacity: n(t.intStadiumCapacity),
      location: t.strLocation ?? null,
      badge: t.strBadge ?? null,
      website: t.strWebsite ? (t.strWebsite.startsWith("http") ? t.strWebsite : `https://${t.strWebsite}`) : null,
      description: description && description.length > 600 ? `${description.slice(0, 597)}…` : description,
      espnId: t.idESPN ?? null,
    };
  });
}
