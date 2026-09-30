import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { SlipSchema, type Slip } from "../types";
import { SLIP_PROMPT } from "./prompt";

/** ChatGPT, Grok, Gemini and OpenRouter all take OpenAI's chat format; only the address and name differ. */
export async function parseSlipWithOpenAI(opts: {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
  imageBase64: string;
  mimeType: string;
}): Promise<Slip> {
  const client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });
  const completion = await client.chat.completions.parse({
    model: opts.model,
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
  if (message?.refusal) throw new Error(`${opts.name} declined to read this image.`);
  if (!message?.parsed) throw new Error(`${opts.name} returned an unreadable response. Try a clearer screenshot.`);
  return message.parsed;
}

/** OpenRouter lists models without a key, so it's checked on /key, which needs one. */
export async function testOpenAIKey(name: string, baseURL: string, apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const path = baseURL.includes("openrouter.ai") ? "/key" : "/models";
    const res = await fetch(baseURL + path, { headers: { authorization: `Bearer ${apiKey}` } });
    // Gemini and Grok answer a bad key with 400, the rest with 401/403; this GET sends nothing else that could be wrong.
    if ([400, 401, 403].includes(res.status)) return { ok: false, message: `Invalid ${name} key` };
    if (!res.ok) return { ok: false, message: `${name} answered HTTP ${res.status}` };
    return { ok: true, message: `Connected to ${name}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
  }
}
