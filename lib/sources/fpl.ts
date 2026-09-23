import { z } from "zod";
import { cached, DAY, MINUTE } from "./cache";
import { fetchJson } from "./http";
import { bestTeamMatch } from "../teams/match";

const BASE = "https://fantasy.premierleague.com/api";

const BootstrapSchema = z.object({
  teams: z.array(z.object({ id: z.number(), name: z.string(), short_name: z.string() })),
  element_types: z.array(z.object({ id: z.number(), singular_name_short: z.string() })),
  events: z.array(z.object({ id: z.number(), finished: z.boolean() })),
  elements: z.array(
    z.object({
      id: z.number(),
      web_name: z.string(),
      first_name: z.string(),
      second_name: z.string(),
      team: z.number(),
      element_type: z.number(),
      status: z.string(),
      news: z.string(),
      news_added: z.string().nullable(),
      chance_of_playing_next_round: z.number().nullable(),
      minutes: z.number(),
      goals_scored: z.number(),
      assists: z.number(),
      expected_goals: z.string(),
      expected_assists: z.string(),
      form: z.string(),
      starts: z.number().optional(),
      penalties_order: z.number().nullable().optional(),
      direct_freekicks_order: z.number().nullable().optional(),
      corners_and_indirect_freekicks_order: z.number().nullable().optional(),
    }),
  ),
});

export type Bootstrap = z.infer<typeof BootstrapSchema>;

export function bootstrap(): Promise<Bootstrap> {
  return cached("fpl:bootstrap", 20 * MINUTE, () => fetchJson(`${BASE}/bootstrap-static/`, BootstrapSchema));
}

export interface AvailabilityEntry {
  player: string;
  position: string;
  status: "injured" | "suspended" | "doubtful" | "unavailable" | "not in squad";
  chance: number | null;
  news: string;
  since: string | null;
}

export interface PlayerForm {
  player: string;
  position: string;
  minutes: number;
  goals: number;
  assists: number;
  xg: number;
  xa: number;
}

export interface FplTeamData {
  team: string;
  availability: AvailabilityEntry[];
  keyPlayers: PlayerForm[];
}

const STATUS: Record<string, AvailabilityEntry["status"]> = {
  i: "injured",
  s: "suspended",
  d: "doubtful",
  u: "unavailable",
  n: "not in squad",
};

/** Premier League only: official FPL availability flags and season attacking output per player. */
export async function getFplTeam(club: string): Promise<FplTeamData | null> {
  const d = await bootstrap();
  const hit = bestTeamMatch(club, d.teams.map((t) => t.name));
  const team = d.teams.find((t) => t.name === hit?.name);
  if (!team) return null;
  const pos = (id: number) => d.element_types.find((e) => e.id === id)?.singular_name_short ?? "";
  const players = d.elements.filter((e) => e.team === team.id);

  const availability = players
    .filter((p) => p.status !== "a" && p.status !== "u")
    .map((p) => ({
      player: `${p.first_name} ${p.second_name}`,
      position: pos(p.element_type),
      status: STATUS[p.status] ?? "doubtful",
      chance: p.chance_of_playing_next_round,
      news: p.news,
      since: p.news_added,
    }))
    .sort((a, b) => (a.chance ?? 0) - (b.chance ?? 0));

  const keyPlayers = players
    .filter((p) => p.minutes > 0)
    .map((p) => ({
      player: p.web_name,
      position: pos(p.element_type),
      minutes: p.minutes,
      goals: p.goals_scored,
      assists: p.assists,
      xg: Number(p.expected_goals),
      xa: Number(p.expected_assists),
    }))
    .sort((a, b) => b.xg + b.xa - (a.xg + a.xa))
    .slice(0, 6);

  return { team: team.name, availability, keyPlayers };
}

const LiveSchema = z.object({ elements: z.array(z.object({ id: z.number(), stats: z.object({ starts: z.number(), minutes: z.number() }) })) });

/** Who started / how long each player played in one finished gameweek. Finished gameweeks don't change, so cache for a day. */
export function getGameweekStarts(gw: number): Promise<Map<number, { starts: number; minutes: number }>> {
  return cached(`fpl:live:${gw}`, DAY, async () => {
    const d = await fetchJson(`${BASE}/event/${gw}/live/`, LiveSchema);
    return d.elements.map((e) => [e.id, e.stats] as const);
  }).then((entries) => new Map(entries));
}
