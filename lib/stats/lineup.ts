export const POSITIONS = ["GK", "DEF", "MID", "FWD"] as const;
export type Position = (typeof POSITIONS)[number];

export interface SquadPlayer {
  name: string;
  pos: Position;
  number: string | null;
  /** "available" only when a source says so; "unknown" when no free source has availability. */
  status: "available" | "doubtful" | "injured" | "suspended" | "unavailable" | "unknown";
  /** Official chance of playing (FPL), when given. */
  chance: number | null;
  note: string | null;
  /** Starts in the last `window` league games, when a source has lineups. */
  starts: number | null;
  minutes: number | null;
  goals: number | null;
  /** National teams: international caps. */
  caps: number | null;
  club: string | null;
  /** A headline about this team that names the player, from the injury/team news search. Not a diagnosis. */
  inNews?: { title: string; publisher: string } | null;
}

export interface LikelyLineup {
  /** e.g. "4-3-3", from the team's most recent lineup. */
  shape: string;
  /** How many recent games `starts` counts. */
  window: number;
  xi: SquadPlayer[];
  /** Next options per position, most-used first. */
  backups: Record<Position, SquadPlayer[]>;
}

const out = (p: SquadPlayer) => p.status === "injured" || p.status === "suspended" || p.status === "unavailable" || p.chance === 0;
const byUse = (a: SquadPlayer, b: SquadPlayer) => (b.starts ?? 0) - (a.starts ?? 0) || (b.minutes ?? 0) - (a.minutes ?? 0) || a.name.localeCompare(b.name);

/**
 * Likely XI = in the shape of the last lineup, the players with the most recent starts per position,
 * leaving out anyone injured, suspended or at 0% chance. A count of what happened, not a prediction.
 */
export function likelyLineup(players: SquadPlayer[], lastShape: Record<Position, number>, window: number): LikelyLineup {
  const fit = players.filter((p) => !out(p));
  const xi: SquadPlayer[] = [];
  const backups = {} as Record<Position, SquadPlayer[]>;
  for (const pos of POSITIONS) {
    const pool = fit.filter((p) => p.pos === pos).sort(byUse);
    xi.push(...pool.slice(0, lastShape[pos]));
    backups[pos] = pool.slice(lastShape[pos], lastShape[pos] + 3);
  }
  return { shape: `${lastShape.DEF}-${lastShape.MID}-${lastShape.FWD}`, window, xi, backups };
}

/** Players who can't play or might not: injured/suspended/unavailable first, then doubtful. */
export function unavailable(players: SquadPlayer[]): SquadPlayer[] {
  return players.filter((p) => out(p) || p.status === "doubtful").sort((a, b) => (a.chance ?? -1) - (b.chance ?? -1) || a.name.localeCompare(b.name));
}
