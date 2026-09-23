import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const CACHE_DIR = join(process.cwd(), ".cache");
const memory = new Map<string, { at: number; value: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * Memoise a loader for `ttlMs`. With `disk: true` the value also survives restarts (used for the
 * football-data.co.uk CSVs, which are large and change at most a few times a day).
 * Concurrent callers share one request.
 */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>, opts: { disk?: boolean } = {}): Promise<T> {
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const run = (async () => {
    if (opts.disk) {
      const fromDisk = await readDisk<T>(key, ttlMs);
      if (fromDisk !== undefined) {
        memory.set(key, { at: Date.now(), value: fromDisk });
        return fromDisk;
      }
    }
    const value = await load();
    memory.set(key, { at: Date.now(), value });
    if (opts.disk) await writeDisk(key, value).catch(() => {});
    return value;
  })();

  inFlight.set(key, run);
  try {
    return await run;
  } finally {
    inFlight.delete(key);
  }
}

function diskPath(key: string) {
  return join(CACHE_DIR, `${createHash("sha1").update(key).digest("hex").slice(0, 16)}.json`);
}

async function readDisk<T>(key: string, ttlMs: number): Promise<T | undefined> {
  try {
    const path = diskPath(key);
    const info = await stat(path);
    if (Date.now() - info.mtimeMs > ttlMs) return undefined;
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return undefined;
  }
}

async function writeDisk(key: string, value: unknown) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(diskPath(key), JSON.stringify(value));
}

/** For tests. */
export function clearMemoryCache() {
  memory.clear();
}
