import { PROVIDERS, PROVIDER_IDS, type AIProvider } from "./ai/providers";
import type { ClientSettings } from "./types";

/**
 * Keys typed into the Settings page win; .env.local (ANTHROPIC_API_KEY, XAI_API_KEY, …) is the fallback.
 * The chosen provider is used if it has a key, otherwise whichever provider has one.
 * Everything runs on the user's own machine, so keys only ever go to the providers.
 */
export function resolveSettings(s: Partial<ClientSettings> = {}) {
  const keyOf = (p: AIProvider) => s.keys?.[p] || process.env[`${PROVIDERS[p].env}_API_KEY`] || "";
  const provider = s.provider && keyOf(s.provider) ? s.provider : (PROVIDER_IDS.find(keyOf) ?? "anthropic");
  return { provider, apiKey: keyOf(provider), model: process.env[`${PROVIDERS[provider].env}_MODEL`] || PROVIDERS[provider].model, keyOf };
}

export function errorResponse(e: unknown, status = 500) {
  const message = e instanceof Error ? e.message : String(e);
  return Response.json({ error: message }, { status });
}
