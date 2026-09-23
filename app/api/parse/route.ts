import { parseSlip } from "@/lib/ai";
import { errorResponse, resolveSettings } from "@/lib/keys";
import type { ClientSettings } from "@/lib/types";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("image");
  const settings = resolveSettings(JSON.parse(String(form.get("settings") ?? "{}")) as Partial<ClientSettings>);

  if (!(file instanceof File)) return errorResponse("No image uploaded", 400);
  if (!ALLOWED.includes(file.type)) return errorResponse("Upload a PNG, JPG, WEBP or GIF screenshot", 400);
  if (file.size > MAX_BYTES) return errorResponse("Image is larger than 8 MB", 400);

  const apiKey = settings.provider === "openai" ? settings.openaiKey : settings.anthropicKey;
  if (!apiKey) {
    const name = settings.provider === "openai" ? "OpenAI" : "Anthropic (Claude)";
    return errorResponse(`Add your ${name} API key in Settings first`, 400);
  }

  try {
    const slip = await parseSlip({
      provider: settings.provider,
      apiKey,
      model: settings.provider === "openai" ? settings.openaiModel : settings.anthropicModel,
      imageBase64: Buffer.from(await file.arrayBuffer()).toString("base64"),
      mimeType: file.type,
    });
    return Response.json({ slip });
  } catch (e) {
    return errorResponse(e, 502);
  }
}
