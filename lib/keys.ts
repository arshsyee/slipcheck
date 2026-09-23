import type { AIProvider, ClientSettings } from "./types";

/**
 * Keys typed into the Settings page win; .env.local is the fallback.
 * Everything runs on the user's own machine, so keys only ever go to the providers.
 */
export function resolveSettings(s: Partial<ClientSettings> = {}) {
  const provider: AIProvider =
    s.provider ?? (process.env.AI_PROVIDER === "openai" ? "openai" : "anthropic");
  return {
    provider,
    anthropicKey: s.anthropicKey || process.env.ANTHROPIC_API_KEY || "",
    openaiKey: s.openaiKey || process.env.OPENAI_API_KEY || "",
    oddsKey: s.oddsKey || process.env.ODDS_API_KEY || "",
    anthropicModel: s.anthropicModel || process.env.ANTHROPIC_MODEL || undefined,
    openaiModel: s.openaiModel || process.env.OPENAI_MODEL || undefined,
  };
}

export function errorResponse(e: unknown, status = 500) {
  const message = e instanceof Error ? e.message : String(e);
  return Response.json({ error: message }, { status });
}
