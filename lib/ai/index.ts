import type { Slip } from "../types";
import { parseSlipWithClaude } from "./claude";
import { parseSlipWithOpenAI } from "./openai";
import { PROVIDERS, type AIProvider } from "./providers";

export async function parseSlip(opts: { provider: AIProvider; apiKey: string; model: string; imageBase64: string; mimeType: string }): Promise<Slip> {
  const p = PROVIDERS[opts.provider];
  return p.baseURL ? parseSlipWithOpenAI({ ...opts, name: p.name, baseURL: p.baseURL }) : parseSlipWithClaude(opts);
}
