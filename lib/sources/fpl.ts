import { z } from "zod";
import { cached, DAY, MINUTE } from "./cache";
import { fetchJson } from "./http";

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

const LiveSchema = z.object({ elements: z.array(z.object({ id: z.number(), stats: z.object({ starts: z.number(), minutes: z.number() }) })) });

/** Who started / how long each player played in one finished gameweek. Finished gameweeks don't change, so cache for a day. */
export function getGameweekStarts(gw: number): Promise<Map<number, { starts: number; minutes: number }>> {
  return cached(`fpl:live:${gw}`, DAY, async () => {
    const d = await fetchJson(`${BASE}/event/${gw}/live/`, LiveSchema);
    return d.elements.map((e) => [e.id, e.stats] as const);
  }).then((entries) => new Map(entries));
}
