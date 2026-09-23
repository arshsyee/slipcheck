import { buildDossier } from "@/lib/dossier/build";
import { errorResponse } from "@/lib/keys";
import { SlipSchema } from "@/lib/types";

/**
 * Builds a match dossier for every leg and streams them back as NDJSON, one line per leg,
 * in the order they finish. Each line: {"legIndex": n, "dossier": {...}} or {"legIndex": n, "error": "..."}.
 */
export async function POST(request: Request) {
  const parsed = SlipSchema.safeParse(((await request.json()) as { slip: unknown }).slip);
  if (!parsed.success) return errorResponse("Slip is malformed", 400);
  const legs = parsed.data.legs;
  if (!legs.length) return errorResponse("The slip has no legs", 400);
  if (legs.length > 20) return errorResponse("Up to 20 legs per slip", 400);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      await Promise.all(
        legs.map(async (leg, i) => {
          try {
            const dossier = await buildDossier(leg, i);
            controller.enqueue(encoder.encode(JSON.stringify({ legIndex: i, dossier }) + "\n"));
          } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            controller.enqueue(encoder.encode(JSON.stringify({ legIndex: i, error }) + "\n"));
          }
        }),
      );
      controller.close();
    },
  });

  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
