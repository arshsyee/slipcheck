import type { Leg } from "../types";
import type { Pick, PickStat, Side, TeamSection } from "../dossier/types";
import type { HeadToHead } from "./match";
import type { TeamGame } from "./team";
import { isDraw, teamScore } from "../teams/match";
import { MARKET_LABEL, seasonStart as seasonStartIso } from "../leagues";
import { formatOdds, impliedProbability } from "../odds/convert";

// "—" for missing: the report shows it as the red "N/A · no free source".
const n = (x: number | null | undefined, dp = 1) => (x == null ? "—" : x.toFixed(dp));

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
    leg.market === "total_goals" || leg.market === "btts" || leg.market === "total_corners" || leg.market === "total_cards" ? "both" : sides.length === 1 ? sides[0] : sides.includes("home") ? "home" : sides.includes("away") ? "away" : null;

  // What the slip's odds mean, as a probability. Not a prediction: the bettor compares it with the counts below.
  if (leg.oddsDecimal && leg.oddsDecimal > 1) {
    bullets.push(`Your odds (${formatOdds(leg.oddsDecimal)}) imply a ${Math.round(impliedProbability(leg.oddsDecimal) * 100)}% chance, bookmaker's margin included.`);
  }
  // The comparison lives in `stats` (a table); bullets are only facts that don't fit it.
  switch (leg.market) {
    case "total_goals": {
      const line = leg.line ?? 2.5;
      if (h2h?.meetings.length) {
        const over = h2h.meetings.filter((m) => m.homeGoals + m.awayGoals > line).length;
        bullets.push(`Head-to-head: ${over} of the last ${h2h.meetings.length} meetings had ${Math.floor(line) + 1}+ goals (${n(h2h.avgGoals)} per game).`);
      }
      break;
    }
    case "btts":
      if (h2h?.meetings.length) bullets.push(`Head-to-head: both teams scored in ${h2h.btts} of the last ${h2h.meetings.length} meetings.`);
      break;
    case "asian_handicap": {
      const s = pickSide === "home" ? hs : pickSide === "away" ? as : null;
      const team = pickSide === "home" ? home.name : away.name;
      if (s && leg.line != null) {
        const r = handicapRecord(s.overall.form10.games, leg.line);
        bullets.push(`${team} ${leg.line > 0 ? "+" : ""}${leg.line} over their last ${r.games} games: won ${fmt(r.win)}, lost ${fmt(r.lose)}${r.push ? `, refunded ${fmt(r.push)}` : ""}.`);
      }
      break;
    }
  }

  if (h2h?.meetings.length && (leg.market === "1x2" || leg.market === "double_chance" || leg.market === "draw_no_bet")) {
    bullets.push(`Head-to-head (last ${h2h.meetings.length}): ${home.name} won ${h2h.aWins}, ${away.name} won ${h2h.bWins}, ${h2h.draws} drawn.`);
  }
  for (const t of [home, away]) {
    // A coach appointed this season changes what the season averages mean.
    const c = t.coach.ok ? t.coach.data : null;
    if (c?.coach.since && c.record && c.coach.since >= seasonStartIso()) {
      const r = c.record.allCompsThisSeason.played ? c.record.allCompsThisSeason : c.record.league;
      bullets.push(`${t.name} have a new coach, ${c.coach.name}, since ${c.coach.since.slice(0, 10)}.${r ? ` Under them: won ${r.won}, drew ${r.drawn}, lost ${r.lost}.` : " No games under them yet."}`);
    }
    // Rotation risk: a game soon after this one.
    if (t.after && t.after.daysAfter <= 4) {
      bullets.push(`${t.name} play ${t.after.venue === "home" ? "" : "away at "}${t.after.opponent} (${t.after.competition}) ${t.after.daysAfter} day${t.after.daysAfter === 1 ? "" : "s"} after this match.`);
    }
    if (t.restDays != null && t.restDays <= 3) bullets.push(`${t.name} last played ${t.restDays} day${t.restDays === 1 ? "" : "s"} before this match.`);
    // No official list: players this team's injury headlines name (from the squad cross-check).
    const named = t.squad?.ok ? (t.squad.data?.players.filter((p) => p.inNews).map((p) => p.name) ?? []) : [];
    if (named.length && !(t.availability.ok && t.availability.data.kind === "official")) {
      bullets.push(`${t.name}: ${named.slice(0, 4).join(", ")}${named.length > 4 ? ` and ${named.length - 4} more` : ""} named in injury news (headlines, not an official list).`);
    }
    if (t.availability.ok && t.availability.data.kind === "official") {
      const out = t.availability.data.players.filter((p) => p.chance === 0 || p.status === "injured" || p.status === "suspended");
      if (out.length) bullets.push(`${t.name} are missing ${out.slice(0, 4).map((p) => p.player).join(", ")}${out.length > 4 ? ` and ${out.length - 4} more` : ""}.`);
    }
  }

  for (const [t, st] of [[home, hs], [away, as]] as const) {
    if (!st) bullets.push(`No league stats for ${t.name}: SlipCheck covers the Premier League, La Liga, Serie A, Bundesliga and Ligue 1.`);
  }

  return { pickSide, title, bullets: bullets.slice(0, 8), stats: marketStats(leg, home, away) };
}

function ordinal(i: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = i % 100;
  return `${i}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const pts = (n: number) => `${n} point${n === 1 ? "" : "s"}`;
const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

/** "3 of 4" */
/** "2 of 5 games": always say what's being counted. */
const count = (g: TeamGame[], f: (x: TeamGame) => boolean) => (g.length ? `${g.filter(f).length} of ${g.length} game${g.length === 1 ? "" : "s"}` : "—");
const ppg = (g: TeamGame[]) => (g.length ? (g.filter((x) => x.gf > x.ga).length * 3 + g.filter((x) => x.gf === x.ga).length) / g.length : null);
const avgOf = (g: TeamGame[], f: (x: TeamGame) => number | null) => {
  const v = g.map(f).filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

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
  const VENUE = `${home.name} at home · ${away.name} away`;
  const ALL = `All games ${hs.period}`;
  const venue = (label: string, f: (g: TeamGame[]) => string): PickStat => ({ group: VENUE, label, home: f(hv), away: f(av) });
  const all = (label: string, f: (g: TeamGame[]) => string): PickStat => ({ group: ALL, label, home: f(ho), away: f(ao) });
  const lg = (t: TeamSection) => (t.season.ok ? t.season.data?.league : null);
  const position: PickStat[] =
    lg(home) || lg(away)
      ? [{ group: ALL, label: "League position", home: lg(home) ? `${ordinal(lg(home)!.table.rank)} · ${pts(lg(home)!.table.points)}` : "—", away: lg(away) ? `${ordinal(lg(away)!.table.rank)} · ${pts(lg(away)!.table.points)}` : "—" }]
      : [];
  const wdl = (g: TeamGame[]) => (g.length ? `W${g.filter((x) => x.gf > x.ga).length} D${g.filter((x) => x.gf === x.ga).length} L${g.filter((x) => x.gf < x.ga).length}` : "—");
  const goals = (g: TeamGame[]) => (g.length ? `${g.reduce((a, x) => a + x.gf, 0)}–${g.reduce((a, x) => a + x.ga, 0)}` : "—");
  const last5 = (g: TeamGame[]) => (g.length ? g.slice(0, 5).reverse().map((x) => (x.gf > x.ga ? "W" : x.gf < x.ga ? "L" : "D")).join(" ") : "—");
  const xg = (g: TeamGame[]) => (g.some((x) => x.xgf != null) ? `${n(avgOf(g, (x) => x.xgf), 2)} – ${n(avgOf(g, (x) => x.xga), 2)}` : "—");
  const line = leg.line ?? 2.5;
  const plus = `${Math.floor(line) + 1}+ goals`;

  switch (leg.market) {
    case "1x2":
    case "draw_no_bet":
    case "double_chance":
    case "other":
      return [
        venue("Record", wdl),
        venue("Goals (for–against)", goals),
        ...position,
        all("Last 5 (oldest → newest)", last5),
        all("Points per game", (g) => n(ppg(g), 2)),
        all("xG per game (for – against)", xg),
      ];
    case "total_goals":
      return [
        venue(`Games with ${plus}`, (g) => count(g, (x) => x.gf + x.ga > line)),
        venue("Goals per game (both teams)", (g) => n(avgOf(g, (x) => x.gf + x.ga), 1)),
        all(`Games with ${plus}`, (g) => count(g, (x) => x.gf + x.ga > line)),
        // Only once there are more than 5 games; before that it repeats the row above.
        ...(ho.length > 5 || ao.length > 5 ? [all(`${plus}, last 5 games`, (g) => count(g.slice(0, 5), (x) => x.gf + x.ga > line))] : []),
        all("xG per game (for – against)", xg),
      ];
    case "btts":
      return [
        venue("Both teams scored", (g) => count(g, (x) => x.gf > 0 && x.ga > 0)),
        venue("Scored", (g) => count(g, (x) => x.gf > 0)),
        venue("Conceded", (g) => count(g, (x) => x.ga > 0)),
        all("Both teams scored", (g) => count(g, (x) => x.gf > 0 && x.ga > 0)),
        all("xG per game (for – against)", xg),
      ];
    case "total_corners":
    case "total_cards": {
      // Match totals (both teams), from the games where the source recorded them.
      const corners = leg.market === "total_corners";
      const total = (x: TeamGame) => (corners ? (x.corners != null && x.cornersAgainst != null ? x.corners + x.cornersAgainst : null) : x.yellows != null && x.reds != null && x.cardsAgainst != null ? x.yellows + x.reds + x.cardsAgainst : null);
      const known = (g: TeamGame[]) => g.filter((x) => total(x) != null);
      const what = corners ? "corners" : "cards";
      const lineCC = leg.line ?? (corners ? 9.5 : 3.5);
      const over = `${Math.floor(lineCC) + 1}+ ${what}`;
      const own = (x: TeamGame) => (corners ? x.corners : x.yellows != null && x.reds != null ? x.yellows + x.reds : null);
      const opp = (x: TeamGame) => (corners ? x.cornersAgainst : x.cardsAgainst);
      return [
        venue(`Games with ${over}`, (g) => count(known(g), (x) => total(x)! > lineCC)),
        venue("Per game (both teams)", (g) => n(avgOf(known(g), total), 1)),
        venue(corners ? "Won – conceded per game" : "Own – opponent's per game", (g) => (known(g).length ? `${n(avgOf(known(g), own), 1)} – ${n(avgOf(known(g), opp), 1)}` : "—")),
        all(`Games with ${over}`, (g) => count(known(g), (x) => total(x)! > lineCC)),
        ...(known(ho).length > 5 || known(ao).length > 5 ? [all(`${over}, last 5 games`, (g) => count(known(g).slice(0, 5), (x) => total(x)! > lineCC))] : []),
      ];
    }
    case "asian_handicap": {
      // The line is quoted for the picked side; the other side gets the opposite line.
      const pickHome = sidesOf(leg.selection, home.name, away.name)[0] !== "away";
      const l = leg.line ?? 0;
      const cover = (g: TeamGame[], x: number) => {
        const r = handicapRecord(g, x);
        return r.games ? `won ${fmt(r.win)} · refund ${fmt(r.push)} · lost ${fmt(r.lose)}` : "—";
      };
      return [
        ...position,
        { group: ALL, label: "At this line", home: cover(ho, pickHome ? l : -l), away: cover(ao, pickHome ? -l : l) },
        all("Won by 2+", (g) => count(g, (x) => x.gf - x.ga >= 2)),
        all("Goals (for–against)", goals),
        all("xG per game (for – against)", xg),
      ];
    }
  }
}
