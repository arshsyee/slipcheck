/** Every AI that can read a slip. All but Claude speak OpenAI's chat format at their own address. */
export const PROVIDERS = {
  anthropic: { name: "Claude", prefix: "sk-ant-", keyUrl: "https://console.anthropic.com/settings/keys", env: "ANTHROPIC", model: "claude-sonnet-5", baseURL: null },
  openai: { name: "ChatGPT", prefix: "sk-", keyUrl: "https://platform.openai.com/api-keys", env: "OPENAI", model: "gpt-5", baseURL: "https://api.openai.com/v1" },
  xai: { name: "Grok", prefix: "xai-", keyUrl: "https://console.x.ai", env: "XAI", model: "grok-4.7", baseURL: "https://api.x.ai/v1" },
  gemini: { name: "Gemini", prefix: "AIza", keyUrl: "https://aistudio.google.com/apikey", env: "GEMINI", model: "gemini-3.8-flash", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai" },
  openrouter: { name: "OpenRouter", prefix: "sk-or-", keyUrl: "https://openrouter.ai/keys", env: "OPENROUTER", model: "~openai/gpt-sol-latest", baseURL: "https://openrouter.ai/api/v1" },
} as const;

export type AIProvider = keyof typeof PROVIDERS;
export const PROVIDER_IDS = Object.keys(PROVIDERS) as AIProvider[];

/** The key says whose it is. Longest prefix first: "sk-ant-" and "sk-or-" before plain "sk-". */
export function providerOf(key: string): AIProvider | null {
  const byPrefix = [...PROVIDER_IDS].sort((a, b) => PROVIDERS[b].prefix.length - PROVIDERS[a].prefix.length);
  return byPrefix.find((p) => key.startsWith(PROVIDERS[p].prefix)) ?? null;
}
