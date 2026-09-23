import type { Sport } from "../types";
import { sportConfig } from "../odds/sports";
import { teamScore } from "../odds/match";

const BASE = "https://site.api.espn.com/apis/site/v2/sports";

export interface TeamInfo {
  id: string;
  name: string;
  abbreviation: string;
  logo: string | null;
  color: string | null;
  record: string | null;
  standing: string | null;
  recent: { date: string; opponent: string; result: "W" | "L" | "T"; score: string }[];
  injuries: { player: string; position: string | null; status: string; detail: string | null }[];
}

// Tiny TTL cache: ESPN's injuries feed alone is several MB.
const cache = new Map<string, { at: number; data: unknown }>();

async function getJson<T>(url: string, ttlMs: number): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
  const data = (await res.json()) as T;
  cache.set(url, { at: Date.now(), data });
  return data;
}

interface EspnTeam {
  id: string;
  displayName: string;
  abbreviation: string;
  color?: string;
  logos?: { href: string }[];
}

async function findTeam(path: string, name: string): Promise<EspnTeam | null> {
  const data = await getJson<{ sports: { leagues: { teams: { team: EspnTeam }[] }[] }[] }>(
    `${BASE}/${path}/teams?limit=1000`,
    60 * 60_000,
  );
  let best: EspnTeam | null = null;
  let bestScore = 0;
  for (const { team } of data.sports[0]?.leagues[0]?.teams ?? []) {
    const s = teamScore(name, team.displayName);
    if (s > bestScore) {
      bestScore = s;
      best = team;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

export async function getTeamInfo(sport: Sport, name: string): Promise<TeamInfo | null> {
  const cfg = sportConfig(sport);
  if (!cfg) return null;
  const team = await findTeam(cfg.espn, name);
  if (!team) return null;

  const [detail, schedule, injuries] = await Promise.allSettled([
    getJson<{ team: { record?: { items?: { summary: string }[] }; standingSummary?: string } }>(
      `${BASE}/${cfg.espn}/teams/${team.id}`,
      10 * 60_000,
    ),
    getJson<{ events?: ScheduleEvent[] }>(`${BASE}/${cfg.espn}/teams/${team.id}/schedule`, 10 * 60_000),
    getJson<{ injuries?: InjuryGroup[] }>(`${BASE}/${cfg.espn}/injuries`, 10 * 60_000),
  ]);

  const d = detail.status === "fulfilled" ? detail.value.team : undefined;
  return {
    id: team.id,
    name: team.displayName,
    abbreviation: team.abbreviation,
    logo: team.logos?.[0]?.href ?? null,
    color: team.color ? `#${team.color}` : null,
    record: d?.record?.items?.[0]?.summary ?? null,
    standing: d?.standingSummary ?? null,
    recent: schedule.status === "fulfilled" ? recentResults(schedule.value.events ?? [], team.id) : [],
    injuries: injuries.status === "fulfilled" ? teamInjuries(injuries.value.injuries ?? [], team.id) : [],
  };
}

interface ScheduleEvent {
  date: string;
  competitions: {
    status: { type: { completed: boolean } };
    competitors: {
      id: string;
      winner?: boolean;
      score?: { displayValue: string } | string;
      team: { abbreviation: string };
    }[];
  }[];
}

function recentResults(events: ScheduleEvent[], teamId: string): TeamInfo["recent"] {
  return events
    .filter((e) => e.competitions[0]?.status.type.completed)
    .slice(-5)
    .reverse()
    .map((e) => {
      const comps = e.competitions[0].competitors;
      const us = comps.find((c) => c.id === teamId);
      const them = comps.find((c) => c.id !== teamId);
      const score = (c?: (typeof comps)[number]) =>
        typeof c?.score === "string" ? c.score : (c?.score?.displayValue ?? "?");
      const result: "W" | "L" | "T" = us?.winner ? "W" : them?.winner ? "L" : "T";
      return {
        date: e.date,
        opponent: them?.team.abbreviation ?? "?",
        result,
        score: `${score(us)}-${score(them)}`,
      };
    });
}

interface InjuryGroup {
  id: string;
  injuries: {
    status: string;
    athlete: { displayName: string; position?: { abbreviation: string } };
    details?: { type?: string; detail?: string };
  }[];
}

function teamInjuries(groups: InjuryGroup[], teamId: string): TeamInfo["injuries"] {
  const group = groups.find((g) => g.id === teamId);
  return (group?.injuries ?? [])
    .filter((i) => i.status && i.status.toLowerCase() !== "active")
    .sort((a, b) => severity(a.status) - severity(b.status))
    .slice(0, 12)
    .map((i) => ({
      player: i.athlete.displayName,
      position: i.athlete.position?.abbreviation ?? null,
      status: i.status,
      detail: [i.details?.type, i.details?.detail].filter(Boolean).join(" · ") || null,
    }));
}

const SEVERITY = ["out", "injured reserve", "doubtful", "questionable", "day-to-day", "probable"];

function severity(status: string) {
  const s = status.toLowerCase();
  const i = SEVERITY.findIndex((k) => s.includes(k));
  return i === -1 ? SEVERITY.length : i;
}
