import type { AIProvider, Slip } from "../types";
import { parseSlipWithClaude } from "./claude";
import { parseSlipWithOpenAI } from "./openai";

export async function parseSlip(opts: {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  imageBase64: string;
  mimeType: string;
}): Promise<Slip> {
  return opts.provider === "openai" ? parseSlipWithOpenAI(opts) : parseSlipWithClaude(opts);
}
