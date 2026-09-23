"use client";

import { motion } from "framer-motion";
import { Activity, CalendarClock } from "lucide-react";
import clsx from "clsx";
import type { TeamInfo } from "@/lib/info/espn";
import type { Leg, LegMatch } from "@/lib/types";

export function InfoCard({
  leg,
  index,
  match,
  away,
  home,
}: {
  leg: Leg;
  index: number;
  match?: LegMatch;
  away: TeamInfo | null | undefined;
  home: TeamInfo | null | undefined;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass rounded-2xl p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wider text-muted">
          Leg {index + 1} · {leg.sport}
        </div>
        {match?.commenceTime && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <CalendarClock size={13} />
            {new Date(match.commenceTime).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
      <div className="mt-1 font-medium">{match?.eventName ?? [leg.awayTeam, leg.homeTeam].filter(Boolean).join(" @ ")}</div>
      {match?.note && <div className="mt-1 text-xs text-warn">{match.note}</div>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TeamBlock team={away} fallback={leg.awayTeam} tag="Away" />
        <TeamBlock team={home} fallback={leg.homeTeam} tag="Home" />
      </div>
    </motion.div>
  );
}

function TeamBlock({ team, fallback, tag }: { team: TeamInfo | null | undefined; fallback: string | null; tag: string }) {
  if (team === undefined) return <div className="h-32 animate-pulse rounded-xl bg-surface-2/60" />;
  if (!team)
    return (
      <div className="rounded-xl border border-line p-4 text-sm text-muted">
        {fallback ? `No public data found for ${fallback}` : `${tag} team unknown`}
      </div>
    );

  return (
    <div className="rounded-xl border border-line bg-surface/50 p-4" style={{ boxShadow: team.color ? `inset 3px 0 0 ${team.color}` : undefined }}>
      <div className="flex items-center gap-3">
        {team.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logo} alt="" className="h-10 w-10 object-contain" />
        )}
        <div className="min-w-0">
          <div className="truncate font-medium">{team.name}</div>
          <div className="text-xs text-muted">
            {tag} · {team.record ?? "–"}
            {team.standing && ` · ${team.standing}`}
          </div>
        </div>
      </div>

      {team.recent.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">Last {team.recent.length}</div>
          <div className="flex flex-wrap gap-1.5">
            {team.recent.map((g, i) => (
              <span
                key={i}
                title={`${g.result} ${g.score} vs ${g.opponent}, ${new Date(g.date).toLocaleDateString()}`}
                className={clsx(
                  "tabular rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                  g.result === "W" ? "bg-accent/15 text-accent" : g.result === "L" ? "bg-danger/15 text-danger" : "bg-surface-2 text-muted",
                )}
              >
                {g.result} {g.score} {g.opponent}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3">
        <div className="mb-1.5 flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted">
          <Activity size={12} /> Injuries
        </div>
        {team.injuries.length === 0 ? (
          <div className="text-xs text-muted">None reported</div>
        ) : (
          <ul className="space-y-1">
            {team.injuries.slice(0, 6).map((inj, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">
                  {inj.player} <span className="text-muted">{inj.position}</span>
                </span>
                <span className={clsx("shrink-0 rounded px-1.5 py-0.5 text-[10px]", injuryColor(inj.status))}>{inj.status}</span>
              </li>
            ))}
            {team.injuries.length > 6 && <li className="text-xs text-muted">+{team.injuries.length - 6} more</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

function injuryColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes("out") || s.includes("injured reserve")) return "bg-danger/15 text-danger";
  if (s.includes("doubtful") || s.includes("questionable")) return "bg-warn/15 text-warn";
  return "bg-surface-2 text-muted";
}
