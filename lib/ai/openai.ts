import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { SlipSchema, type Slip } from "../types";
import { SLIP_PROMPT } from "./prompt";

export const DEFAULT_OPENAI_MODEL = "gpt-5";

export async function parseSlipWithOpenAI(opts: {
  apiKey: string;
  model?: string;
  imageBase64: string;
  mimeType: string;
}): Promise<Slip> {
  const client = new OpenAI({ apiKey: opts.apiKey });
  const completion = await client.chat.completions.parse({
    model: opts.model || DEFAULT_OPENAI_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${opts.mimeType};base64,${opts.imageBase64}` } },
          { type: "text", text: SLIP_PROMPT },
        ],
      },
    ],
    response_format: zodResponseFormat(SlipSchema, "bet_slip"),
  });

  const message = completion.choices[0]?.message;
  if (message?.refusal) throw new Error("OpenAI declined to read this image.");
  if (!message?.parsed) throw new Error("OpenAI returned an unreadable response. Try a clearer screenshot.");
  return message.parsed;
}

export async function testOpenAIKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    await new OpenAI({ apiKey }).models.list();
    return { ok: true, message: "Connected to OpenAI" };
  } catch (e) {
    if (e instanceof OpenAI.AuthenticationError) return { ok: false, message: "Invalid OpenAI API key" };
    return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
  }
}
