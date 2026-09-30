import { z } from "zod";
import { cached, DAY, HOUR } from "./cache";
import { fetchJson } from "./http";
import { bestTeamMatch } from "../teams/match";

export interface ClubProfile {
  id: string;
  name: string;
  founded: number | null;
  stadium: string | null;
  capacity: number | null;
  location: string | null;
  badge: string | null;
  website: string | null;
  description: string | null;
}

const Schema = z.object({
  teams: z
    .array(
      z.object({
        idTeam: z.string(),
        strTeam: z.string(),
        strSport: z.string().nullable().optional(),
        intFormedYear: z.string().nullable().optional(),
        strStadium: z.string().nullable().optional(),
        intStadiumCapacity: z.string().nullable().optional(),
        strLocation: z.string().nullable().optional(),
        strBadge: z.string().nullable().optional(),
        strWebsite: z.string().nullable().optional(),
        strDescriptionEN: z.string().nullable().optional(),
      }),
    )
    .nullable(),
});

/** TheSportsDB club profile via its public test key ("3"). */
export function getClubProfile(club: string): Promise<ClubProfile | null> {
  return cached(`sportsdb:v3:${club}`, 7 * DAY, async () => {
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(club)}`;
    const d = await fetchJson(url, Schema);
    const soccer = (d.teams ?? []).filter((t) => (t.strSport ?? "Soccer") === "Soccer");
    const hit = bestTeamMatch(club, soccer.map((t) => t.strTeam));
    const t = soccer.find((x) => x.strTeam === hit?.name);
    if (!t) return null;
    const n = (v?: string | null) => (v && Number(v) > 0 ? Number(v) : null);
    const description = t.strDescriptionEN?.split(/\r?\n/).find((p) => p.trim().length > 40)?.trim() ?? null;
    return {
      id: t.idTeam,
      name: t.strTeam,
      founded: n(t.intFormedYear),
      stadium: t.strStadium ?? null,
      capacity: n(t.intStadiumCapacity),
      location: t.strLocation ?? null,
      // Images moved to r2.; www. image links now 404.
      badge: t.strBadge?.replace("://www.thesportsdb.com/images/", "://r2.thesportsdb.com/images/") ?? null,
      website: t.strWebsite ? (t.strWebsite.startsWith("http") ? t.strWebsite : `https://${t.strWebsite}`) : null,
      description: description && description.length > 600 ? `${description.slice(0, 597)}…` : description,
    };
  });
}

export interface NextMatch {
  kickoff: string;
  home: string;
  away: string;
  venue: string | null;
  league: string | null;
}

const NextSchema = z.object({
  events: z
    .array(
      z.object({
        strTimestamp: z.string().nullable().optional(),
        dateEvent: z.string().nullable().optional(),
        strTime: z.string().nullable().optional(),
        strHomeTeam: z.string(),
        strAwayTeam: z.string(),
        strVenue: z.string().nullable().optional(),
        strLeague: z.string().nullable().optional(),
      }),
    )
    .nullable(),
});

/**
 * A club's next scheduled match (any competition), from TheSportsDB's free tier (1 match per club).
 * Used when the fixture lists we prefer (football-data.co.uk, Premier League, UEFA) don't have it yet.
 */
export function getNextMatch(club: string): Promise<NextMatch | null> {
  return cached(`sportsdb:next:${club}`, 6 * HOUR, async () => {
    const team = await getClubProfile(club);
    if (!team) return null;
    const d = await fetchJson(`https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=${team.id}`, NextSchema);
    const e = d.events?.[0];
    const when = e?.strTimestamp ?? (e?.dateEvent ? `${e.dateEvent}T${e.strTime ?? "00:00:00"}` : null);
    if (!e || !when) return null;
    // TheSportsDB times are UTC without a zone marker.
    const kickoff = new Date(/Z|[+-]\d\d:?\d\d$/.test(when) ? when : `${when}Z`).toISOString();
    return { kickoff, home: e.strHomeTeam, away: e.strAwayTeam, venue: e.strVenue ?? null, league: e.strLeague ?? null };
  });
}
