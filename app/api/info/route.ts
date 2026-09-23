import { getTeamInfo, type TeamInfo } from "@/lib/info/espn";
import { errorResponse } from "@/lib/keys";
import { SlipSchema } from "@/lib/types";

export async function POST(request: Request) {
  const parsed = SlipSchema.safeParse(((await request.json()) as { slip: unknown }).slip);
  if (!parsed.success) return errorResponse("Slip is malformed", 400);

  // Unique (sport, team) pairs across all legs.
  const wanted = new Map<string, { sport: (typeof parsed.data.legs)[number]["sport"]; name: string }>();
  for (const leg of parsed.data.legs) {
    for (const name of [leg.awayTeam, leg.homeTeam]) {
      if (name) wanted.set(`${leg.sport}:${name}`, { sport: leg.sport, name });
    }
  }

  const teams: Record<string, TeamInfo | null> = {};
  await Promise.all(
    [...wanted].map(async ([key, { sport, name }]) => {
      teams[key] = await getTeamInfo(sport, name).catch(() => null);
    }),
  );
  return Response.json({ teams });
}
