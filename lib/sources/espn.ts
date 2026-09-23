import { z } from "zod";
import { cached, DAY, HOUR, MINUTE } from "./cache";
import { fetchJson as fetchJsonRaw } from "./http";

/**
 * ESPN's API is undocumented and sits behind Akamai bot protection, which blocked us (403) after heavy testing.
 * Be a light client: every response is cached on disk with long lifetimes, and after one 403 we stop calling
 * ESPN for the rest of the process instead of hammering it.
 */
let blocked: Error | null = null;
const fetchJson: typeof fetchJsonRaw = async (url, schema, init) => {
  if (blocked) throw blocked;
  try {
    return await fetchJsonRaw(url, schema, init);
  } catch (e) {
    if (e instanceof Error && / 403$/.test(e.message)) blocked = new Error(`${e.message} (ESPN is blocking requests; skipped for this run)`);
    throw e;
  }
};
import { bestTeamMatch } from "../teams/match";

const SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const V2 = "https://site.api.espn.com/apis/v2/sports/soccer";
export const UEFA_SLUGS = ["uefa.champions", "uefa.europa", "uefa.europa.conf"];

export interface EspnTeam {
  id: string;
  name: string;
  abbreviation: string;
  logo: string | null;
  color: string | null;
  slug: string;
}

const TeamsSchema = z.object({
  sports: z.array(
    z.object({
      leagues: z.array(
        z.object({
          teams: z.array(
            z.object({
              team: z.object({
                id: z.string(),
                displayName: z.string(),
                abbreviation: z.string().optional(),
                color: z.string().optional(),
                logos: z.array(z.object({ href: z.string() })).optional(),
              }),
            }),
          ),
        }),
      ),
    }),
  ),
});

export function getTeams(slug: string): Promise<EspnTeam[]> {
  return cached(`espn:teams:${slug}`, 7 * DAY, async () => {
    const d = await fetchJson(`${SITE}/${slug}/teams?limit=1000`, TeamsSchema);
    return (d.sports[0]?.leagues[0]?.teams ?? []).map(({ team }) => ({
      id: team.id,
      name: team.displayName,
      abbreviation: team.abbreviation ?? team.displayName.slice(0, 3).toUpperCase(),
      logo: team.logos?.[0]?.href ?? null,
      color: team.color ? `#${team.color}` : null,
      slug,
    }));
  }, { disk: true });
}

/** Find a club by name across several ESPN leagues (division lists lag promotions, so callers pass the whole country). */
export async function findTeam(name: string, slugs: string[]): Promise<EspnTeam | null> {
  const results = await Promise.allSettled(slugs.map((s) => getTeams(s)));
  // Report an outage rather than a silent "not found" when every league list failed.
  if (results.length && results.every((r) => r.status === "rejected")) throw (results[0] as PromiseRejectedResult).reason;
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const hit = bestTeamMatch(name, [...new Set(all.map((t) => t.name))]);
  return hit ? (all.find((t) => t.name === hit.name) ?? null) : null;
}

// ---------- standings ----------

export interface StandingRow {
  teamId: string;
  team: string;
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** Points docked by the league (ESPN publishes these; results-only sources can't know them). */
  deductions?: number;
}

const StandingsSchema = z.object({
  children: z
    .array(
      z.object({
        standings: z.object({
          entries: z.array(
            z.object({
              team: z.object({ id: z.string(), displayName: z.string() }),
              stats: z.array(z.object({ name: z.string(), value: z.number().nullable().optional() })),
            }),
          ),
        }),
      }),
    )
    .optional(),
});

export function getStandings(slug: string): Promise<StandingRow[]> {
  return cached(`espn:standings:${slug}`, 6 * HOUR, async () => {
    const d = await fetchJson(`${V2}/${slug}/standings`, StandingsSchema);
    const rows = (d.children ?? []).flatMap((c) => c.standings.entries);
    return rows
      .map((e) => {
        const s = (n: string) => e.stats.find((x) => x.name === n)?.value ?? 0;
        return {
          teamId: e.team.id,
          team: e.team.displayName,
          rank: s("rank"),
          played: s("gamesPlayed"),
          won: s("wins"),
          drawn: s("ties"),
          lost: s("losses"),
          goalsFor: s("pointsFor"),
          goalsAgainst: s("pointsAgainst"),
          goalDiff: s("pointDifferential"),
          points: s("points"),
          deductions: s("deductions") || 0,
        };
      })
      .sort((a, b) => a.rank - b.rank);
  }, { disk: true });
}

// ---------- schedule ----------

export interface EspnEvent {
  id: string;
  date: string;
  completed: boolean;
  competition: string;
  slug: string;
  venue: string | null;
  home: { id: string; name: string; score: number | null };
  away: { id: string; name: string; score: number | null };
}

const ScoreSchema = z.union([z.string(), z.object({ value: z.number().nullable().optional(), displayValue: z.string().optional() })]);
const ScheduleSchema = z.object({
  events: z
    .array(
      z.object({
        id: z.string(),
        date: z.string(),
        league: z.object({ name: z.string().optional(), abbreviation: z.string().optional() }).optional(),
        competitions: z.array(
          z.object({
            status: z.object({ type: z.object({ completed: z.boolean() }) }),
            venue: z.object({ fullName: z.string().optional() }).optional(),
            competitors: z.array(
              z.object({
                id: z.string(),
                homeAway: z.string(),
                score: ScoreSchema.optional(),
                team: z.object({ displayName: z.string() }),
              }),
            ),
          }),
        ),
      }),
    )
    .optional(),
});

function scoreOf(s: z.infer<typeof ScoreSchema> | undefined): number | null {
  if (s == null) return null;
  if (typeof s === "string") return s === "" ? null : Number(s);
  return s.value ?? (s.displayValue ? Number(s.displayValue) : null);
}

/** A club's season schedule in one competition. `fixtures: true` returns upcoming matches instead of results. */
export function getSchedule(slug: string, teamId: string, fixtures = false): Promise<EspnEvent[]> {
  const url = `${SITE}/${slug}/teams/${teamId}/schedule${fixtures ? "?fixture=true" : ""}`;
  return cached(`espn:${url}`, 6 * HOUR, async () => {
    const d = await fetchJson(url, ScheduleSchema);
    return (d.events ?? []).flatMap((e) => {
      const c = e.competitions[0];
      const home = c?.competitors.find((x) => x.homeAway === "home");
      const away = c?.competitors.find((x) => x.homeAway === "away");
      if (!c || !home || !away) return [];
      return [
        {
          id: e.id,
          date: e.date,
          completed: c.status.type.completed,
          competition: e.league?.name ?? slug,
          slug,
          venue: c.venue?.fullName ?? null,
          home: { id: home.id, name: home.team.displayName, score: scoreOf(home.score) },
          away: { id: away.id, name: away.team.displayName, score: scoreOf(away.score) },
        },
      ];
    });
  }, { disk: true });
}

/** This season's results across the domestic league, domestic cups and UEFA competitions, newest first. */
export async function getRecentResults(domesticSlug: string, teamId: string, cupSlugs: string[] = []): Promise<EspnEvent[]> {
  const lists = await Promise.all(
    [domesticSlug, ...cupSlugs, ...UEFA_SLUGS].map((s) => getSchedule(s, teamId).catch(() => [] as EspnEvent[])),
  );
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((e) => e.completed && !seen.has(e.id) && seen.add(e.id))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** The upcoming meeting between two clubs in a competition, if ESPN lists it. */
export async function findUpcomingEvent(slug: string, homeId: string, awayId: string): Promise<EspnEvent | null> {
  const events = await getSchedule(slug, homeId, true);
  const ids = new Set([homeId, awayId]);
  return events.find((e) => !e.completed && ids.has(e.home.id) && ids.has(e.away.id)) ?? null;
}

// ---------- match summary ----------

export interface LineupPlayer {
  name: string;
  jersey: string | null;
  position: string | null;
}

export interface EspnLineup {
  teamId: string;
  team: string;
  formation: string | null;
  starters: LineupPlayer[];
  subs: LineupPlayer[];
}

export interface EspnSummary {
  venue: { name: string; city: string | null; country: string | null } | null;
  attendance: number | null;
  referee: string | null;
  lineups: EspnLineup[];
  news: { headline: string; url: string | null; published: string | null }[];
}

const SummarySchema = z.object({
  gameInfo: z
    .object({
      venue: z
        .object({
          fullName: z.string().optional(),
          address: z.object({ city: z.string().optional(), country: z.string().optional() }).optional(),
        })
        .optional(),
      attendance: z.number().optional(),
      officials: z.array(z.object({ displayName: z.string().optional(), position: z.object({ name: z.string().optional() }).optional() })).optional(),
    })
    .optional(),
  rosters: z
    .array(
      z.object({
        team: z.object({ id: z.string(), displayName: z.string() }),
        formation: z.string().optional(),
        roster: z
          .array(
            z.object({
              starter: z.boolean().optional(),
              jersey: z.string().optional(),
              athlete: z.object({ displayName: z.string() }),
              position: z.object({ abbreviation: z.string().optional() }).optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  news: z
    .object({
      articles: z
        .array(
          z.object({
            headline: z.string(),
            published: z.string().optional(),
            links: z.object({ web: z.object({ href: z.string() }).optional() }).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export function getSummary(slug: string, eventId: string): Promise<EspnSummary> {
  const url = `${SITE}/${slug}/summary?event=${eventId}`;
  return cached(`espn:${url}`, 10 * MINUTE, async () => {
    const d = await fetchJson(url, SummarySchema);
    const v = d.gameInfo?.venue;
    const ref = d.gameInfo?.officials?.find((o) => !o.position?.name || /referee/i.test(o.position.name)) ?? d.gameInfo?.officials?.[0];
    const toPlayer = (p: NonNullable<NonNullable<z.infer<typeof SummarySchema>["rosters"]>[number]["roster"]>[number]) => ({
      name: p.athlete.displayName,
      jersey: p.jersey ?? null,
      position: p.position?.abbreviation ?? null,
    });
    return {
      venue: v?.fullName ? { name: v.fullName, city: v.address?.city ?? null, country: v.address?.country ?? null } : null,
      attendance: d.gameInfo?.attendance ?? null,
      referee: ref?.displayName ?? null,
      lineups: (d.rosters ?? [])
        .filter((r) => r.roster?.length)
        .map((r) => ({
          teamId: r.team.id,
          team: r.team.displayName,
          formation: r.formation ?? null,
          starters: (r.roster ?? []).filter((p) => p.starter).map(toPlayer),
          subs: (r.roster ?? []).filter((p) => !p.starter).map(toPlayer),
        })),
      news: (d.news?.articles ?? []).slice(0, 8).map((a) => ({
        headline: a.headline,
        url: a.links?.web?.href ?? null,
        published: a.published ?? null,
      })),
    };
  }, { disk: true });
}

// ---------- scoreboard (fixtures by day) ----------

const ScoreboardSchema = ScheduleSchema;

/** All matches in a competition on one day (UTC date, YYYYMMDD). */
export function getScoreboard(slug: string, yyyymmdd: string): Promise<EspnEvent[]> {
  const url = `${SITE}/${slug}/scoreboard?dates=${yyyymmdd}`;
  return cached(`espn:${url}`, 6 * HOUR, async () => {
    const d = await fetchJson(url, ScoreboardSchema);
    return (d.events ?? []).flatMap((e) => {
      const c = e.competitions[0];
      const home = c?.competitors.find((x) => x.homeAway === "home");
      const away = c?.competitors.find((x) => x.homeAway === "away");
      if (!c || !home || !away) return [];
      return [{
        id: e.id,
        date: e.date,
        completed: c.status.type.completed,
        competition: e.league?.name ?? slug,
        slug,
        venue: c.venue?.fullName ?? null,
        home: { id: home.id, name: home.team.displayName, score: scoreOf(home.score) },
        away: { id: away.id, name: away.team.displayName, score: scoreOf(away.score) },
      }];
    });
  }, { disk: true });
}

/** Upcoming matches in a competition over the next `days` days. */
export async function getUpcoming(slug: string, days = 21): Promise<EspnEvent[]> {
  const dates = Array.from({ length: days }, (_, i) => new Date(Date.now() + i * DAY).toISOString().slice(0, 10).replace(/-/g, ""));
  const lists = await Promise.all(dates.map((d) => getScoreboard(slug, d).catch(() => [] as EspnEvent[])));
  return lists.flat().filter((e) => !e.completed && new Date(e.date).getTime() > Date.now());
}
