import { testClaudeKey } from "@/lib/ai/claude";
import { testOpenAIKey } from "@/lib/ai/openai";
import { testOddsKey } from "@/lib/odds/client";
import { resolveSettings } from "@/lib/keys";
import type { ClientSettings } from "@/lib/types";

export async function POST(request: Request) {
  const { which, settings } = (await request.json()) as {
    which: "anthropic" | "openai" | "odds";
    settings?: Partial<ClientSettings>;
  };
  const s = resolveSettings(settings);
  const key = which === "anthropic" ? s.anthropicKey : which === "openai" ? s.openaiKey : s.oddsKey;
  if (!key) return Response.json({ ok: false, message: "No key entered" });

  const result =
    which === "anthropic" ? await testClaudeKey(key) : which === "openai" ? await testOpenAIKey(key) : await testOddsKey(key);
  return Response.json(result);
}

/** Lets the UI know which keys are already set in .env.local (never returns the keys themselves). */
export async function GET() {
  const s = resolveSettings();
  return Response.json({
    anthropic: Boolean(s.anthropicKey),
    openai: Boolean(s.openaiKey),
    odds: Boolean(s.oddsKey),
    provider: s.provider,
  });
}
