import { getSampleSlips } from "@/lib/samples";
import { errorResponse } from "@/lib/keys";

export async function GET() {
  try {
    return Response.json({ samples: await getSampleSlips() });
  } catch (e) {
    return errorResponse(e, 502);
  }
}
