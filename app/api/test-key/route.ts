import { testClaudeKey } from "@/lib/ai/claude";
import { testOpenAIKey } from "@/lib/ai/openai";
import { PROVIDERS, PROVIDER_IDS } from "@/lib/ai/providers";
import { resolveSettings } from "@/lib/keys";
import type { ClientSettings } from "@/lib/types";

export async function POST(request: Request) {
  const { settings } = (await request.json()) as { settings?: Partial<ClientSettings> };
  const s = resolveSettings(settings);
  if (!s.apiKey) return Response.json({ ok: false, message: "No key entered" });
  const p = PROVIDERS[s.provider];
  return Response.json(p.baseURL ? await testOpenAIKey(p.name, p.baseURL, s.apiKey) : await testClaudeKey(s.apiKey));
}

/** Lets the UI know which providers have a key in .env.local (never returns the keys themselves). */
export async function GET() {
  const s = resolveSettings();
  return Response.json(Object.fromEntries(PROVIDER_IDS.map((p) => [p, Boolean(s.keyOf(p))])));
}
