import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

// Resolved per call so tests (and other working dirs) get their own cache.
const cacheDir = () => join(process.cwd(), ".cache");
const memory = new Map<string, { at: number; value: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** How long a saved copy may be served when its source is down. */
const STALE_MAX_MS = 14 * DAY;

/** Every time a source failed and we served its last saved copy instead. Read by the dossier builder. */
export const staleLog: { key: string; savedAt: string; error: string }[] = [];

/**
 * Memoise a loader for `ttlMs`, in memory and on disk (.cache/), so values survive restarts.
 * If the loader fails, the last saved copy (up to 14 days old) is returned and recorded in `staleLog`:
 * a source outage shows old-but-labelled data instead of a hole. Concurrent callers share one request.
 */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>, opts: { disk?: boolean } = {}): Promise<T> {
  const disk = opts.disk ?? true;
  // SLIPCHECK_LIVE=1 (health checks): always ask the source; saved copies are only a fallback.
  if (process.env.SLIPCHECK_LIVE === "1") ttlMs = -1;
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const run = (async () => {
    if (disk) {
      const fromDisk = await readDisk<T>(key, ttlMs);
      if (fromDisk !== undefined) {
        memory.set(key, { at: Date.now(), value: fromDisk });
        return fromDisk;
      }
    }
    let value: T;
    try {
      value = await load();
    } catch (e) {
      const saved = disk ? await readDiskAny<T>(key) : undefined;
      if (!saved) throw e;
      staleLog.push({ key, savedAt: saved.savedAt, error: e instanceof Error ? e.message : String(e) });
      return saved.value;
    }
    memory.set(key, { at: Date.now(), value });
    if (disk) await writeDisk(key, value).catch(() => {});
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
  return join(cacheDir(), `${createHash("sha1").update(key).digest("hex").slice(0, 16)}.json`);
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

async function readDiskAny<T>(key: string): Promise<{ value: T; savedAt: string } | undefined> {
  try {
    const path = diskPath(key);
    const info = await stat(path);
    if (Date.now() - info.mtimeMs > STALE_MAX_MS) return undefined;
    return { value: JSON.parse(await readFile(path, "utf8")) as T, savedAt: info.mtime.toISOString() };
  } catch {
    return undefined;
  }
}

async function writeDisk(key: string, value: unknown) {
  await mkdir(cacheDir(), { recursive: true });
  await writeFile(diskPath(key), JSON.stringify(value));
}

/** For tests. */
export function clearMemoryCache() {
  memory.clear();
}
