import type { Leg } from "../types";
import type { Pick, PickStat, Side, TeamSection } from "../dossier/types";
import type { HeadToHead } from "./match";
import type { TeamGame } from "./team";
import { isDraw, teamScore } from "../teams/match";
import { MARKET_LABEL, seasonStart as seasonStartIso } from "../leagues";

const n = (x: number | null | undefined, dp = 1) => (x == null ? "?" : x.toFixed(dp));

/** Which side(s) a selection backs, e.g. "Arsenal or Draw" → home + draw. */
export function sidesOf(selection: string, home: string, away: string): (Side | "draw")[] {
  const parts = selection.split(/\s*(?:\/|\bor\b|,|&|\+)\s*/i).filter(Boolean);
  const compact = selection.toLowerCase().replace(/\s+/g, "");
  if (compact === "1x") return ["home", "draw"];
  if (compact === "x2") return ["draw", "away"];
  if (compact === "12") return ["home", "away"];
  return parts.flatMap((p): (Side | "draw")[] => {
    if (isDraw(p)) return ["draw"];
    const h = teamScore(p, home);
    const a = teamScore(p, away);
    if (Math.max(h, a) < 0.5) return [];
    return [h >= a ? "home" : "away"];
  });
}

/** Asian handicap record: how often the side would have won / pushed / lost at this line. Quarter lines split the stake. */
export function handicapRecord(games: TeamGame[], line: number) {
  const halves = Number.isInteger(line * 2) ? [line] : [line - 0.25, line + 0.25];
  let win = 0;
  let push = 0;
  let lose = 0;
  for (const g of games) {
    for (const l of halves) {
      const d = g.gf - g.ga + l;
      if (d > 0) win += 1 / halves.length;
      else if (d === 0) push += 1 / halves.length;
      else lose += 1 / halves.length;
    }
  }
  return { win, push, lose, games: games.length };
}

/** "won 3, drew 1 and lost 1 of their last 5 games" */
const record = (g: TeamGame[], what: string) => {
  const w = g.filter((x) => x.gf > x.ga).length;
  const d = g.filter((x) => x.gf === x.ga).length;
  return g.length ? `won ${w}, drew ${d} and lost ${g.length - w - d} of their ${what}` : `have no ${what} yet`;
};

/** "in all 4 away games" / "in 3 of 4 away games" / "in none of their 4 away games". Counts, never bare percentages. */
export function inGames(g: TeamGame[], f: (x: TeamGame) => boolean, what: string) {
  const k = g.filter(f).length;
  if (!g.length) return `in no ${what} yet`;
  if (g.length === 1) return k ? `in their only ${what.replace(/s$/, "")}` : `in none of their ${what} (1 played)`;
  if (k === g.length) return g.length === 2 ? `in both ${what}` : `in all ${k} ${what}`;
  if (k === 0) return `in none of their ${g.length} ${what}`;
  return `in ${k} of ${g.length} ${what}`;
}
const times = (k: number) => (k === 0 ? "0 times" : k === 1 ? "once" : k === 2 ? "twice" : `${k} times`);

export function buildPick(
  leg: Leg,
  home: TeamSection,
  away: TeamSection,
  h2h: HeadToHead | null,
): Pick {
  const hs = home.stats.ok ? home.stats.data : null;
  const as = away.stats.ok ? away.stats.data : null;
  const bullets: string[] = [];
  const title = `${MARKET_LABEL[leg.market]}: ${leg.selection}${leg.line != null ? ` ${leg.line > 0 && leg.market === "asian_handicap" ? "+" : ""}${leg.line}` : ""}`;
  const sides = sidesOf(leg.selection, home.name, away.name);
  const pickSide: Pick["pickSide"] =
    leg.market === "total_goals" || leg.market === "btts" ? "both" : sides.length === 1 ? sides[0] : sides.includes("home") ? "home" : sides.includes("away") ? "away" : null;

  // Home side's home games and away side's away games this season.
  const hv = hs?.venue.allGames ?? [];
  const av = as?.venue.allGames ?? [];
  const both = (f: (x: TeamGame) => boolean, verb: string) => {
    if (hs) bullets.push(`${home.name} ${verb} ${inGames(hv, f, "home games")} this season.`);
    if (as) bullets.push(`${away.name} ${verb} ${inGames(av, f, "away games")} this season.`);
  };
  const rank = (t: TeamSection) => (t.standing?.ok && t.standing.data ? `${ordinal(t.standing.data.rank)} with ${t.standing.data.points} points` : null);

  switch (leg.market) {
    case "1x2":
    case "draw_no_bet":
    case "double_chance":
    case "other": {
      const hr = rank(home);
      const ar = rank(away);
      if (hr && ar) bullets.push(`${home.name} are ${hr}; ${away.name} are ${ar}.`);
      if (hs) bullets.push(`${home.name} ${record(hs.overall.form5.games, "last 5 league games")}.`);
      if (as) bullets.push(`${away.name} ${record(as.overall.form5.games, "last 5 league games")}.`);
      if (hs) bullets.push(`At home this season, ${home.name} ${record(hv, "home games")}.`);
      if (as) bullets.push(`Away this season, ${away.name} ${record(av, "away games")}.`);
      break;
    }
    case "total_goals": {
      const line = leg.line ?? 2.5;
      const goals = Math.floor(line) + 1;
      both((g) => g.gf + g.ga > line, `had ${goals} or more goals`);
      if (h2h?.meetings.length) {
        const over = h2h.meetings.filter((m) => m.homeGoals + m.awayGoals > line).length;
        bullets.push(`${over} of their last ${h2h.meetings.length} meetings had ${goals} or more goals (${n(h2h.avgGoals)} goals per game on average).`);
      }
      if (!bullets.length) bullets.push(`Not enough games yet to say how often these teams see ${goals} or more goals.`);
      break;
    }
    case "btts": {
      both((g) => g.gf > 0 && g.ga > 0, "saw both teams score");
      both((g) => g.gf > 0, "scored");
      both((g) => g.ga > 0, "conceded");
      if (h2h?.meetings.length) bullets.push(`Both teams scored in ${h2h.btts} of their last ${h2h.meetings.length} meetings.`);
      break;
    }
    case "asian_handicap": {
      const s = pickSide === "home" ? hs : pickSide === "away" ? as : null;
      const team = pickSide === "home" ? home.name : away.name;
      if (s && leg.line != null) {
        const r = handicapRecord(s.overall.form10.games, leg.line);
        const line = `${leg.line > 0 ? "+" : ""}${leg.line}`;
        bullets.push(`${team} ${line} in each of their last ${r.games} games would have won ${fmt(r.win)}, lost ${fmt(r.lose)}${r.push ? ` and been refunded ${fmt(r.push)}` : ""}.`);
        const m = s.overall.rates.margins;
        bullets.push(`This season ${team} won by 2 or more ${times(m.ge_p2)}, won by 1 ${times(m.p1)}, drew ${times(m.zero)}, lost by 1 ${times(m.m1)} and lost by 2 or more ${times(m.le_m2)}.`);
      }
      break;
    }
  }

  if (h2h?.meetings.length && (leg.market === "1x2" || leg.market === "double_chance" || leg.market === "draw_no_bet")) {
    bullets.push(`Last ${h2h.meetings.length} meetings: ${home.name} won ${h2h.aWins}, ${away.name} won ${h2h.bWins}, ${h2h.draws} drawn.`);
  }
  for (const t of [home, away]) {
    // A coach appointed this season changes what the season averages mean.
    const c = t.coach.ok ? t.coach.data : null;
    if (c?.coach.since && c.record && c.coach.since >= seasonStartIso()) {
      const r = c.record.allCompsThisSeason.played ? c.record.allCompsThisSeason : c.record.league;
      bullets.push(`${t.name} have a new coach, ${c.coach.name}, since ${c.coach.since.slice(0, 10)}.${r ? ` Under them: won ${r.won}, drew ${r.drawn}, lost ${r.lost}.` : " No games under them yet."}`);
    }
    if (t.restDays != null && t.restDays <= 3) bullets.push(`${t.name} last played ${t.restDays} day${t.restDays === 1 ? "" : "s"} before this match.`);
    if (t.availability.ok && t.availability.data.kind === "official") {
      const out = t.availability.data.players.filter((p) => p.chance === 0 || p.status === "injured" || p.status === "suspended");
      if (out.length) bullets.push(`${t.name} are missing ${out.slice(0, 4).map((p) => p.player).join(", ")}${out.length > 4 ? ` and ${out.length - 4} more` : ""}.`);
    }
  }

  for (const [t, st] of [[home, hs], [away, as]] as const) {
    if (!st) bullets.push(`No league stats for ${t.name}: SlipCheck covers the Premier League, La Liga, Serie A, Bundesliga and Ligue 1.`);
  }

  const primaryTab: Pick["primaryTab"] =
    leg.market === "total_goals" || leg.market === "btts" || leg.market === "asian_handicap" ? "stats" : "form";
  return { pickSide, title, bullets: bullets.slice(0, 8), stats: marketStats(leg, home, away), primaryTab };
}

function ordinal(i: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = i % 100;
  return `${i}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

/** "3 of 4" */
const count = (g: TeamGame[], f: (x: TeamGame) => boolean) => (g.length ? `${g.filter(f).length} of ${g.length}` : "—");
const ppg = (g: TeamGame[]) => (g.length ? (g.filter((x) => x.gf > x.ga).length * 3 + g.filter((x) => x.gf === x.ga).length) / g.length : null);
const avgOf = (g: TeamGame[], f: (x: TeamGame) => number | null) => {
  const v = g.map(f).filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const xgd = (x: TeamGame) => (x.xgf != null && x.xga != null ? x.xgf - x.xga : null);

/**
 * The numbers that matter for this bet type, side by side. "home / away games" rows use the home side's
 * home games and the away side's away games; "all" rows use every league game this season.
 */
export function marketStats(leg: Leg, home: TeamSection, away: TeamSection): PickStat[] {
  const hs = home.stats.ok ? home.stats.data : null;
  const as = away.stats.ok ? away.stats.data : null;
  if (!hs || !as) return [];
  const hv = hs.venue.allGames ?? [];
  const av = as.venue.allGames ?? [];
  const ho = hs.overall.allGames ?? [];
  const ao = as.overall.allGames ?? [];
  const row = (label: string, f: (g: TeamGame[]) => string, venue = true): PickStat => ({ label, home: f(venue ? hv : ho), away: f(venue ? av : ao) });
  const lg = (t: TeamSection) => (t.season.ok ? t.season.data?.league : null);
  const position: PickStat = {
    label: "League position",
    home: lg(home) ? `${ordinal(lg(home)!.table.rank)}, ${lg(home)!.table.points} points` : "—",
    away: lg(away) ? `${ordinal(lg(away)!.table.rank)}, ${lg(away)!.table.points} points` : "—",
  };

  switch (leg.market) {
    case "1x2":
    case "draw_no_bet":
    case "double_chance":
    case "other":
      return [
        position,
        row("Games won (home / away games)", (g) => count(g, (x) => x.gf > x.ga)),
        row("Games drawn (home / away games)", (g) => count(g, (x) => x.gf === x.ga)),
        row("Points per game (home / away)", (g) => n(ppg(g), 2)),
        row("Points per game (all games)", (g) => n(ppg(g), 2), false),
        row("Expected goals (xG) for minus against, per game", (g) => n(avgOf(g, xgd), 2), false),
      ];
    case "total_goals": {
      const line = leg.line ?? 2.5;
      return [
        row(`Games with ${Math.floor(line) + 1}+ goals (home / away games)`, (g) => count(g, (x) => x.gf + x.ga > line)),
        row(`Games with ${Math.floor(line) + 1}+ goals (all games)`, (g) => count(g, (x) => x.gf + x.ga > line), false),
        row(`Games with ${Math.floor(line) + 1}+ goals (last 5)`, (g) => count(g.slice(0, 5), (x) => x.gf + x.ga > line), false),
        row("Total goals per game (home / away games)", (g) => n(avgOf(g, (x) => x.gf + x.ga), 2)),
        row("Total expected goals (xG) per game (home / away games)", (g) => n(avgOf(g, (x) => (x.xgf != null && x.xga != null ? x.xgf + x.xga : null)), 2)),
      ];
    }
    case "btts":
      return [
        row("Both teams scored (home / away games)", (g) => count(g, (x) => x.gf > 0 && x.ga > 0)),
        row("Both teams scored (all games)", (g) => count(g, (x) => x.gf > 0 && x.ga > 0), false),
        row("Games they scored in (home / away games)", (g) => count(g, (x) => x.gf > 0)),
        row("Games they conceded in (home / away games)", (g) => count(g, (x) => x.ga > 0)),
        row("Expected goals (xG) for / against per game", (g) => `${n(avgOf(g, (x) => x.xgf), 2)} / ${n(avgOf(g, (x) => x.xga), 2)}`, false),
      ];
    case "asian_handicap": {
      const line = leg.line ?? 0;
      // The line is quoted for the picked side; the other side gets the opposite line.
      const pickHome = sidesOf(leg.selection, home.name, away.name)[0] !== "away";
      const cover = (g: TeamGame[], l: number) => {
        const r = handicapRecord(g, l);
        return r.games ? `${fmt(r.win)} / ${fmt(r.push)} / ${fmt(r.lose)}` : "—";
      };
      return [
        position,
        { label: "Bet at this line: won / refunded / lost (all games)", home: cover(ho, pickHome ? line : -line), away: cover(ao, pickHome ? -line : line) },
        row("Goals for minus against, per game", (g) => n(avgOf(g, (x) => x.gf - x.ga), 2), false),
        row("Expected goals (xG) for minus against, per game", (g) => n(avgOf(g, xgd), 2), false),
        row("Won by 2 or more goals (all games)", (g) => count(g, (x) => x.gf - x.ga >= 2), false),
      ];
    }
  }
}
