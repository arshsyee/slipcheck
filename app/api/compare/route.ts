import { fetchOdds, type OddsEvent } from "@/lib/odds/client";
import { compareSlip } from "@/lib/odds/compare";
import { sportConfig } from "@/lib/odds/sports";
import { errorResponse, resolveSettings } from "@/lib/keys";
import { demoEventsBySport } from "@/lib/demo/odds";
import { SlipSchema, type ClientSettings, type CompareResult } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as { slip: unknown; settings?: Partial<ClientSettings>; demo?: boolean };
  const parsed = SlipSchema.safeParse(body.slip);
  if (!parsed.success) return errorResponse("Slip is malformed", 400);
  const slip = parsed.data;

  if (body.demo) {
    const result: CompareResult = { ...compareSlip(slip, demoEventsBySport()), demo: true };
    return Response.json(result);
  }

  const { oddsKey } = resolveSettings(body.settings);
  if (!oddsKey) return errorResponse("Add your Odds API key in Settings first", 400);

  // One request per sport on the slip (cached for 60s).
  const sports = [...new Set(slip.legs.map((l) => l.sport))].filter((s) => sportConfig(s));
  const eventsBySport: Record<string, OddsEvent[]> = {};
  let requestsRemaining: string | null = null;
  try {
    await Promise.all(
      sports.map(async (sport) => {
        const { events, remaining } = await fetchOdds(sportConfig(sport)!.oddsKey, oddsKey);
        eventsBySport[sport] = events;
        requestsRemaining = remaining ?? requestsRemaining;
      }),
    );
  } catch (e) {
    return errorResponse(e, 502);
  }

  const result: CompareResult = { ...compareSlip(slip, eventsBySport), requestsRemaining };
  return Response.json(result);
}
