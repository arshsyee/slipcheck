import type { AIProvider, ClientSettings } from "./types";

/**
 * Keys typed into the Settings page win; .env.local is the fallback.
 * Everything runs on the user's own machine, so keys only ever go to the providers.
 */
export function resolveSettings(s: Partial<ClientSettings> = {}) {
  // The keys decide: the browser's key first, otherwise whichever key .env.local has.
  const anthropicKey = s.anthropicKey || process.env.ANTHROPIC_API_KEY || "";
  const openaiKey = s.openaiKey || process.env.OPENAI_API_KEY || "";
  const provider: AIProvider = s.anthropicKey ? "anthropic" : s.openaiKey ? "openai" : anthropicKey ? "anthropic" : openaiKey ? "openai" : "anthropic";
  return {
    provider,
    anthropicKey,
    openaiKey,
    anthropicModel: process.env.ANTHROPIC_MODEL || undefined,
    openaiModel: process.env.OPENAI_MODEL || undefined,
  };
}

/** The key says whose it is: Claude keys start "sk-ant-", ChatGPT keys "sk-". */
export function providerOf(key: string): AIProvider | null {
  return key.startsWith("sk-ant-") ? "anthropic" : key.startsWith("sk-") ? "openai" : null;
}

export function errorResponse(e: unknown, status = 500) {
  const message = e instanceof Error ? e.message : String(e);
  return Response.json({ error: message }, { status });
}
