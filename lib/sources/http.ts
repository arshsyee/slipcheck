import type { z } from "zod";

// Wikimedia asks for a descriptive User-Agent: https://meta.wikimedia.org/wiki/User-Agent_policy
const UA = "SlipCheck/0.2 (self-hosted bet slip research tool; https://meta.wikimedia.org/wiki/User-Agent_policy)";
const TIMEOUT_MS = 15_000;

const RETRIES = 2;

/** Wikimedia rate-limits parallel bursts (429) and asks API clients to send requests one at a time. */
const SERIAL = /(^|\.)(wikipedia|wikidata)\.org$/;
const queues = new Map<string, Promise<unknown>>();

export function fetchText(url: string, init: { headers?: Record<string, string>; timeoutMs?: number } = {}): Promise<string> {
  const host = new URL(url).host;
  if (!SERIAL.test(host)) return fetchNow(url, init);
  const next = (queues.get(host) ?? Promise.resolve()).catch(() => {}).then(() => fetchNow(url, init));
  queues.set(host, next);
  return next;
}

async function fetchNow(url: string, init: { headers?: Record<string, string>; timeoutMs?: number }) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { "user-agent": UA, ...init.headers },
      signal: AbortSignal.timeout(init.timeoutMs ?? TIMEOUT_MS),
      cache: "no-store",
    });
    // Free services rate-limit bursts (TheSportsDB, Wikidata): back off and retry instead of failing.
    if ((res.status === 429 || res.status === 503) && attempt < RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await new Promise((r) => setTimeout(r, Math.min(10_000, (retryAfter > 0 ? retryAfter * 1000 : 1500) * (attempt + 1))));
      continue;
    }
    if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
    return (await res.text()).replace(/^﻿/, "");
  }
}

/** Fetch JSON and validate its shape, so an upstream format change fails loudly instead of rendering nonsense. */
export async function fetchJson<S extends z.ZodType>(
  url: string,
  schema: S,
  init: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<z.infer<S>> {
  const text = await fetchText(url, { ...init, headers: { accept: "application/json", ...init.headers } });
  const parsed = schema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${new URL(url).host} changed format (${issue?.path.join(".")}: ${issue?.message})`);
  }
  return parsed.data;
}
