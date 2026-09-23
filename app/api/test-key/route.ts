import { testClaudeKey } from "@/lib/ai/claude";
import { testOpenAIKey } from "@/lib/ai/openai";
import { resolveSettings } from "@/lib/keys";
import type { ClientSettings } from "@/lib/types";

export async function POST(request: Request) {
  const { which, settings } = (await request.json()) as {
    which: "anthropic" | "openai";
    settings?: Partial<ClientSettings>;
  };
  const s = resolveSettings(settings);
  const key = which === "anthropic" ? s.anthropicKey : s.openaiKey;
  if (!key) return Response.json({ ok: false, message: "No key entered" });
  return Response.json(which === "anthropic" ? await testClaudeKey(key) : await testOpenAIKey(key));
}

/** Lets the UI know which keys are already set in .env.local (never returns the keys themselves). */
export async function GET() {
  const s = resolveSettings();
  return Response.json({ anthropic: Boolean(s.anthropicKey), openai: Boolean(s.openaiKey), provider: s.provider });
}
