"use client";

import clsx from "clsx";
import { AlertCircle } from "lucide-react";
import type { SourceId, SourceResult } from "@/lib/sources/types";
import { SOURCES } from "@/lib/sources/types";
import type { TeamGame } from "@/lib/stats/team";

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function kickoffLabel(iso: string | null | undefined): string {
  if (!iso) return "Kick-off TBC";
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export const pct = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x * 100)}%`);
export const fix = (x: number | null | undefined, dp = 2) => (x == null ? "—" : x.toFixed(dp));

export function ResultChip({ game, compact }: { game: TeamGame; compact?: boolean }) {
  return (
    <span
      title={`${game.result} ${game.gf}-${game.ga} ${game.venue === "home" ? "v" : "@"} ${game.opponent}, ${new Date(game.kickoff).toLocaleDateString()}`}
      className={clsx(
        "tabular inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        game.result === "W" ? "bg-win/15 text-win" : game.result === "L" ? "bg-danger/15 text-danger" : "bg-surface-2 text-muted",
      )}
    >
      <b>{game.result}</b>
      {!compact && (
        <>
          {game.gf}-{game.ga}
          <span className="opacity-70">{game.venue === "home" ? "v" : "@"} {game.opponent}</span>
        </>
      )}
    </span>
  );
}

/** Two-sided bar comparing home (left) and away (right) values. `better` says which direction is good. */
export function CompareRow({
  label,
  home,
  away,
  format = (v) => fix(v, 2),
  better = "higher",
}: {
  label: string;
  home: number | null | undefined;
  away: number | null | undefined;
  format?: (v: number | null | undefined) => string;
  better?: "higher" | "lower" | "none";
}) {
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a || 1;
  const homeWins = better === "none" || home == null || away == null ? null : better === "higher" ? h > a : h < a;
  return (
    <div className="grid grid-cols-[56px_1fr_56px] items-center gap-3 py-1.5 text-sm">
      <span className={clsx("tabular text-right", homeWins === true && "font-semibold text-fg", homeWins === false && "text-muted")}>{format(home)}</span>
      <div>
        <div className="mb-1 text-center text-[11px] uppercase tracking-wider text-muted">{label}</div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-home" style={{ width: `${(h / total) * 100}%` }} />
          <div className="h-full bg-away" style={{ width: `${(a / total) * 100}%` }} />
        </div>
      </div>
      <span className={clsx("tabular", homeWins === false && "font-semibold text-fg", homeWins === true && "text-muted")}>{format(away)}</span>
    </div>
  );
}

export function Unavailable({ result, children }: { result?: SourceResult<unknown> | null; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
      <AlertCircle size={15} className="mt-0.5 shrink-0" />
      <div>
        {children ?? "Not available."}
        {result && !result.ok && (
          <div className="mt-0.5 text-xs opacity-80">
            {SOURCES[result.source].name}: {result.error}
          </div>
        )}
      </div>
    </div>
  );
}

export function SourceTag({ source, at }: { source: SourceId; at?: string }) {
  return (
    <a
      href={SOURCES[source].homepage}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-fg"
      title={at ? `Fetched ${new Date(at).toLocaleString()}` : undefined}
    >
      {SOURCES[source].name}
      {at && <span className="opacity-70">· {timeAgo(at)}</span>}
    </a>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted">{children}</h4>
      {right}
    </div>
  );
}

export function Crest({ src, name, size = 36 }: { src: string | null | undefined; name: string; size?: number }) {
  if (!src)
    return (
      <span className="grid shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-muted" style={{ width: size, height: size }}>
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}
