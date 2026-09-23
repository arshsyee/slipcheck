import { z } from "zod";
import { cached, HOUR, MINUTE } from "./cache";
import { fetchJson } from "./http";
import { matchFixture } from "../teams/match";

const BASE = "https://match.uefa.com/v5";

export interface UefaMatch {
  id: string;
  kickoff: string;
  status: string;
  home: string;
  away: string;
  round: string | null;
  stadium: { name: string | null; city: string | null; capacity: number | null; lat: number | null; lon: number | null } | null;
  referee: string | null;
  lineupStatus: string | null;
}

const Translated = z.object({ EN: z.string().optional() }).partial().optional();
const TeamSchema = z.object({ internationalName: z.string() });
const MatchSchema = z.object({
  id: z.string(),
  kickOffTime: z.object({ dateTime: z.string() }),
  status: z.string(),
  lineupStatus: z.string().optional(),
  homeTeam: TeamSchema,
  awayTeam: TeamSchema,
  round: z.object({ translations: z.object({ name: Translated }).partial().optional() }).optional(),
  stadium: z
    .object({
      capacity: z.number().optional(),
      geolocation: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
      city: z.object({ translations: z.object({ name: Translated }).partial().optional() }).optional(),
      translations: z.object({ mediaName: Translated, officialName: Translated }).partial().optional(),
    })
    .optional(),
  referees: z
    .array(z.object({ role: z.string().optional(), person: z.object({ translations: z.object({ name: Translated }).partial().optional() }).optional() }))
    .optional(),
});

/** UEFA season year is the calendar year the season ends in (2026/27 → 2027). */
export function uefaSeasonYear(date = new Date()) {
  return date.getUTCMonth() >= 6 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
}

export function getCompetitionMatches(competitionId: number, seasonYear = uefaSeasonYear()): Promise<UefaMatch[]> {
  const url = `${BASE}/matches?competitionId=${competitionId}&seasonYear=${seasonYear}&limit=500&order=ASC&offset=0`;
  return cached(`uefa:${url}`, HOUR, async () => {
    const d = await fetchJson(url, z.array(MatchSchema));
    return d.map((m) => {
      const ref = m.referees?.find((r) => r.role === "REFEREE") ?? m.referees?.[0];
      return {
        id: m.id,
        kickoff: m.kickOffTime.dateTime,
        status: m.status,
        home: m.homeTeam.internationalName,
        away: m.awayTeam.internationalName,
        round: m.round?.translations?.name?.EN ?? null,
        stadium: m.stadium
          ? {
              name: m.stadium.translations?.officialName?.EN ?? m.stadium.translations?.mediaName?.EN ?? null,
              city: m.stadium.city?.translations?.name?.EN ?? null,
              capacity: m.stadium.capacity ?? null,
              lat: m.stadium.geolocation?.latitude ?? null,
              lon: m.stadium.geolocation?.longitude ?? null,
            }
          : null,
        referee: ref?.person?.translations?.name?.EN ?? null,
        lineupStatus: m.lineupStatus ?? null,
      };
    });
  });
}

export async function findUefaMatch(competitionId: number, home: string | null, away: string | null): Promise<UefaMatch | null> {
  const upcoming = (await getCompetitionMatches(competitionId)).filter((m) => m.status !== "FINISHED");
  return matchFixture(home, away, upcoming);
}

export interface UefaLineup {
  team: string;
  formation: string | null;
  starters: { name: string; jersey: string | null; position: string | null }[];
  subs: { name: string; jersey: string | null; position: string | null }[];
}

const LineupPlayer = z.object({
  jerseyNumber: z.union([z.number(), z.string()]).optional(),
  type: z.string().optional(),
  player: z.object({
    fieldPosition: z.string().optional(),
    translations: z.object({ shortName: Translated, name: Translated }).partial().optional(),
  }),
});
const LineupTeam = z.object({
  team: z.object({ internationalName: z.string() }).optional(),
  field: z.array(LineupPlayer).optional(),
  bench: z.array(LineupPlayer).optional(),
  tacticalFormation: z.string().optional(),
});
const LineupsSchema = z.object({ homeTeam: LineupTeam.optional(), awayTeam: LineupTeam.optional() });

/** Official lineups (published about an hour before kick-off). */
export function getUefaLineups(matchId: string): Promise<UefaLineup[]> {
  const url = `${BASE}/matches/${matchId}/lineups`;
  return cached(`uefa:${url}`, 5 * MINUTE, async () => {
    const d = await fetchJson(url, LineupsSchema);
    const toPlayer = (p: z.infer<typeof LineupPlayer>) => ({
      name: p.player.translations?.name?.EN ?? p.player.translations?.shortName?.EN ?? "?",
      jersey: p.jerseyNumber != null ? String(p.jerseyNumber) : null,
      position: p.player.fieldPosition ?? null,
    });
    return [d.homeTeam, d.awayTeam]
      .filter((t): t is z.infer<typeof LineupTeam> => Boolean(t?.field?.length))
      .map((t) => ({
        team: t.team?.internationalName ?? "",
        formation: t.tacticalFormation ?? null,
        starters: (t.field ?? []).map(toPlayer),
        subs: (t.bench ?? []).map(toPlayer),
      }));
  });
}
