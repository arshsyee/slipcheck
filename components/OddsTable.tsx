"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import clsx from "clsx";
import { formatAmerican, formatMoney } from "@/lib/odds/convert";
import type { CompareResult, Slip } from "@/lib/types";

export function OddsTable({ slip, result }: { slip: Slip; result: CompareResult }) {
  const complete = result.quotes.filter((q) => q.complete);
  const best = complete[0];
  const userBook = slip.sportsbook?.toLowerCase().replace(/\s+/g, "");
  const baseline = result.slipPayout;

  if (!result.quotes.length) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-muted">
        No sportsbooks are offering these games right now. Check that the teams are right and that the games haven&apos;t started.
      </div>
    );
  }

  const unpriceable = result.matches.filter((m) => m.note);

  return (
    <div className="space-y-4">
      {!best && (
        <div className="rounded-2xl border border-warn/40 bg-warn/10 p-5 text-sm">
          <div className="font-medium text-warn">No sportsbook offers every leg of this bet at the same line</div>
          {unpriceable.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-muted">
              {unpriceable.map((m) => (
                <li key={m.legIndex}>
                  Leg {m.legIndex + 1}: {m.note}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 text-muted">The prices for each leg that could be matched are still shown below.</div>
        </div>
      )}
      {best && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/15 via-surface to-surface p-6"
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-accent">
                <Trophy size={16} /> Best payout
              </div>
              <div className="mt-1 text-3xl font-semibold tracking-tight">{best.book}</div>
              <div className="mt-1 text-sm text-muted">
                {formatAmerican(best.american)} · {formatMoney(result.stake)} stake
              </div>
            </div>
            <div className="text-right">
              <div className="tabular text-4xl font-semibold text-accent">{formatMoney(best.payout)}</div>
              {baseline != null && best.payout != null && (
                <div className={clsx("tabular mt-1 text-sm", best.payout - baseline > 0.005 ? "text-accent" : "text-muted")}>
                  {best.payout - baseline > 0.005
                    ? `+${formatMoney(best.payout - baseline)} more than your slip`
                    : "Your slip already has the best price"}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Sportsbook</th>
              {slip.legs.map((l, i) => (
                <th key={i} className="px-3 py-3 text-right font-medium">
                  Leg {i + 1}
                  <div className="truncate normal-case tracking-normal text-muted/70">{legShort(l)}</div>
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Odds</th>
              <th className="px-4 py-3 text-right font-medium">Payout</th>
              <th className="px-4 py-3 text-right font-medium">vs. slip</th>
            </tr>
          </thead>
          <tbody>
            {result.quotes.map((q, idx) => {
              const isBest = q === best;
              const isYours = userBook && q.bookKey.includes(userBook.slice(0, 6));
              const diff = baseline != null && q.payout != null ? q.payout - baseline : null;
              return (
                <motion.tr
                  key={q.bookKey}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={clsx(
                    "border-b border-line/60 last:border-0",
                    isBest && "bg-accent/[0.07]",
                    !q.complete && "opacity-50",
                  )}
                >
                  <td className="tabular px-4 py-3 text-muted">{q.complete ? idx + 1 : "–"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <BookBadge name={q.book} highlight={isBest} />
                      <span className="font-medium">{q.book}</span>
                      {isYours && <span className="whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">your book</span>}
                    </div>
                  </td>
                  {q.legOdds.map((o, i) => (
                    <td key={i} className="tabular px-3 py-3 text-right">
                      {o != null ? (
                        formatAmerican(o)
                      ) : q.legLines[i] != null ? (
                        <span className="text-xs text-warn" title="This book offers a different line">
                          alt {slip.legs[i].market === "spread" && q.legLines[i]! > 0 ? "+" : ""}
                          {q.legLines[i]}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  ))}
                  <td className="tabular px-4 py-3 text-right font-medium">{formatAmerican(q.american)}</td>
                  <td className={clsx("tabular px-4 py-3 text-right font-semibold", isBest && "text-accent")}>
                    {formatMoney(q.payout)}
                  </td>
                  <td
                    className={clsx(
                      "tabular px-4 py-3 text-right text-xs",
                      diff == null ? "text-muted" : diff > 0.005 ? "text-accent" : diff < -0.005 ? "text-danger" : "text-muted",
                    )}
                  >
                    {diff == null ? "—" : `${diff > 0 ? "+" : ""}${formatMoney(diff)}`}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Payout includes your stake. Only books with the <em>same</em> line are priced; <span className="text-warn">alt</span> means that book
        has a different line. {result.requestsRemaining && <>Odds API requests left this month: {result.requestsRemaining}.</>}
      </p>
    </div>
  );
}

function legShort(l: Slip["legs"][number]) {
  const line = l.line != null ? ` ${l.line > 0 && l.market === "spread" ? "+" : ""}${l.line}` : "";
  const sel = l.market === "total" ? l.selection : l.selection.split(" ").slice(-1)[0];
  return `${sel}${line}`;
}

function BookBadge({ name, highlight }: { name: string; highlight?: boolean }) {
  const initials = name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={clsx(
        "grid h-7 w-7 shrink-0 place-items-center rounded-md text-[10px] font-bold",
        highlight ? "bg-accent text-bg" : "bg-surface-2 text-muted ring-1 ring-line",
      )}
    >
      {initials}
    </span>
  );
}
