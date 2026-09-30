import { z } from "zod";
import { cached, DAY, HOUR, MINUTE } from "./cache";
import { fetchJson } from "./http";
import { bestTeamMatch, matchFixture } from "../teams/match";

const BASE = "https://footballapi.pulselive.com/football";
// The Premier League's own site API expects to be called from premierleague.com.
const HEADERS = { origin: "https://www.premierleague.com", referer: "https://www.premierleague.com/" };

const Page = <T extends z.ZodType>(item: T) => z.object({ content: z.array(item) });

async function currentSeasonId(): Promise<number> {
  return cached("pl:compseason", DAY, async () => {
    const d = await fetchJson(`${BASE}/competitions/1/compseasons?page=0&pageSize=1`, Page(z.object({ id: z.number() })), { headers: HEADERS });
    if (!d.content[0]) throw new Error("No current Premier League season");
    return d.content[0].id;
  });
}

async function teamIds(): Promise<{ id: number; name: string }[]> {
  const season = await currentSeasonId();
  return cached(`pl:teams:${season}`, DAY, async () => {
    const d = await fetchJson(
      `${BASE}/teams?pageSize=100&comps=1&compSeasons=${season}`,
      Page(z.object({ id: z.number(), name: z.string() })),
      { headers: HEADERS },
    );
    return d.content;
  });
}

const FixtureSchema = z.object({
  id: z.number(),
  kickoff: z.object({ millis: z.number().optional() }).optional(),
  teams: z.array(z.object({ team: z.object({ name: z.string() }) })),
  ground: z.object({ name: z.string().optional(), city: z.string().optional() }).optional(),
});

const Name = z.object({ display: z.string() });
const DetailSchema = FixtureSchema.extend({
  matchOfficials: z.array(z.object({ role: z.string().optional(), name: Name })).optional(),
  teamLists: z
    .array(
      z.object({
        teamId: z.number().optional(),
        formation: z.object({ label: z.string().optional() }).optional(),
        lineup: z.array(z.object({ name: Name, matchPosition: z.string().optional(), matchShirtNumber: z.number().optional() })).optional(),
        substitutes: z.array(z.object({ name: Name, matchPosition: z.string().optional(), matchShirtNumber: z.number().optional() })).optional(),
      })
      // Team sheets are null until published.
      .nullable(),
    )
    .optional(),
});

export interface PlFixture {
  id: number;
  kickoff: string | null;
  home: string;
  away: string;
  ground: string | null;
  city: string | null;
  referee: string | null;
  lineups: { team: string; formation: string | null; starters: PlPlayer[]; subs: PlPlayer[] }[];
}

interface PlPlayer {
  name: string;
  jersey: string | null;
  position: string | null;
}

/** A club's next Premier League fixtures (up to 10), soonest first. */
export async function getPlUpcoming(club: string): Promise<{ id: number; home: string; away: string; kickoff: string | null }[]> {
  const [season, teams] = await Promise.all([currentSeasonId(), teamIds()]);
  const hit = bestTeamMatch(club, teams.map((t) => t.name));
  const teamId = teams.find((t) => t.name === hit?.name)?.id;
  if (teamId == null) return [];
  return cached(`pl:fixtures:v2:${season}:${teamId}`, HOUR, async () => {
    const d = await fetchJson(
      `${BASE}/fixtures?comps=1&compSeasons=${season}&teams=${teamId}&statuses=U,L&pageSize=10&sort=asc`,
      Page(FixtureSchema),
      { headers: HEADERS },
    );
    return d.content.map((f) => ({
      id: f.id,
      home: f.teams[0]?.team.name ?? "",
      away: f.teams[1]?.team.name ?? "",
      kickoff: f.kickoff?.millis ? new Date(f.kickoff.millis).toISOString() : null,
    }));
  });
}

/** Official Premier League fixture: ground, referee, and team sheets once published. */
export async function findPlFixture(home: string | null, away: string | null): Promise<PlFixture | null> {
  const club = home ?? away;
  if (!club) return null;
  const upcoming = await getPlUpcoming(club);
  const fixture = matchFixture(home, away, upcoming);
  if (!fixture) return null;

  return cached(`pl:fixture:${fixture.id}`, 5 * MINUTE, async () => {
    const f = await fetchJson(`${BASE}/fixtures/${fixture.id}`, DetailSchema, { headers: HEADERS });
    const toPlayer = (p: { name: { display: string }; matchPosition?: string; matchShirtNumber?: number }) => ({
      name: p.name.display,
      jersey: p.matchShirtNumber != null ? String(p.matchShirtNumber) : null,
      position: p.matchPosition ?? null,
    });
    return {
      id: f.id,
      kickoff: f.kickoff?.millis ? new Date(f.kickoff.millis).toISOString() : null,
      home: f.teams[0]?.team.name ?? "",
      away: f.teams[1]?.team.name ?? "",
      ground: f.ground?.name ?? null,
      city: f.ground?.city ?? null,
      referee: f.matchOfficials?.find((o) => o.role === "MAIN")?.name.display ?? null,
      lineups: (f.teamLists ?? [])
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t?.lineup?.length)
        .map(({ t, i }) => ({
          team: f.teams[i]?.team.name ?? "",
          formation: t!.formation?.label ?? null,
          starters: (t!.lineup ?? []).map(toPlayer),
          subs: (t!.substitutes ?? []).map(toPlayer),
        })),
    };
  });
}
