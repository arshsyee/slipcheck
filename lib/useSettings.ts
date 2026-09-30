"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ClientSettings } from "./types";

const STORAGE_KEY = "slipcheck.settings.v1";
const CHANGE_EVENT = "slipcheck:settings";
const SERVER = "__server__";
const DEFAULTS: ClientSettings = {};

export interface EnvStatus {
  anthropic: boolean;
  openai: boolean;
  provider: "anthropic" | "openai";
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function readRaw(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Settings live in this browser's localStorage and are sent only to the local API routes. */
export function useSettings() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => SERVER);
  const loaded = raw !== SERVER;
  const settings = useMemo<ClientSettings>(() => {
    if (!raw || raw === SERVER) return DEFAULTS;
    try {
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return DEFAULTS;
    }
  }, [raw]);

  const [env, setEnv] = useState<EnvStatus | null>(null);
  useEffect(() => {
    fetch("/api/test-key")
      .then((r) => r.json())
      .then(setEnv)
      .catch(() => {});
  }, []);

  const update = useCallback(
    (patch: Partial<ClientSettings>) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, ...patch }));
      } catch {}
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [settings],
  );

  const hasAiKey = Boolean(settings.anthropicKey || settings.openaiKey || env?.anthropic || env?.openai);

  return { settings, update, env, loaded, hasAiKey };
}
