import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SlipSchema, type Slip } from "../types";
import { SLIP_PROMPT } from "./prompt";

type ImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export async function parseSlipWithClaude(opts: {
  apiKey: string;
  model: string;
  imageBase64: string;
  mimeType: string;
}): Promise<Slip> {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const response = await client.messages.parse({
    model: opts.model,
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: opts.mimeType as ImageMime, data: opts.imageBase64 },
          },
          { type: "text", text: SLIP_PROMPT },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(SlipSchema) },
  });

  if (response.stop_reason === "refusal") throw new Error("Claude declined to read this image.");
  if (!response.parsed_output) throw new Error("Claude returned an unreadable response. Try a clearer screenshot.");
  return response.parsed_output;
}

export async function testClaudeKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    await new Anthropic({ apiKey }).models.list({ limit: 1 });
    return { ok: true, message: "Connected to Claude" };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, message: "Invalid Anthropic API key" };
    return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
  }
}
