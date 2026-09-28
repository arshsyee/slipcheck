import { z } from "zod";
import { cached, HOUR } from "./cache";
import { fetchJson } from "./http";
import { bootstrap, getGameweekStarts, type Bootstrap } from "./fpl";
import { bestTeamMatch } from "../teams/match";
import { likelyLineup, POSITIONS, type LikelyLineup, type Position, type SquadPlayer } from "../stats/lineup";

export interface Squad {
  source: "fpl" | "wikipedia";
  /** When the source's list was last updated, as it states it (Wikipedia "updated" / "named in the squad"). */
  asOf: string | null;
  players: SquadPlayer[];
  /** Null when no free source has recent lineups. */
  likely: LikelyLineup | null;
  /** Facts worth knowing about individual players, each with its numbers. */
  watch: string[];
  /** National teams: the sentence(s) on Wikipedia about players who withdrew from this squad. */
  withdrawals: string | null;
  /**
   * National teams: players marked injured/suspended/withdrawn for the current window ("Recent call-ups").
   * Optional: reports saved before this field existed (e.g. restored in the browser) don't have it.
   */
  outs?: SquadPlayer[];
}

const FPL_POS: Record<string, Position> = { GKP: "GK", DEF: "DEF", MID: "MID", FWD: "FWD" };
const STATUS: Record<string, SquadPlayer["status"]> = { a: "available", d: "doubtful", i: "injured", s: "suspended", u: "unavailable", n: "unavailable" };
const WINDOW = 5;

/** Premier League squad from FPL: positions, official availability, starts in the last 5 league games, set-piece takers. */
export function getFplSquad(club: string): Promise<Squad | null> {
  return cached(`squad:fpl:v3:${club}`, 20 * 60_000, async () => {
    const d = await bootstrap();
    const hit = bestTeamMatch(club, d.teams.map((t) => t.name));
    const team = d.teams.find((t) => t.name === hit?.name);
    if (!team) return null;
    const pos = (id: number) => FPL_POS[d.element_types.find((e) => e.id === id)?.singular_name_short ?? ""] ?? "MID";
    const mine = d.elements.filter((e) => e.team === team.id);
    const gws = d.events.filter((e) => e.finished).map((e) => e.id).slice(-WINDOW);
    const lives = await Promise.all(gws.map((g) => getGameweekStarts(g)));
    const startsOf = (id: number) => lives.reduce((n, l) => n + (l.get(id)?.starts ?? 0), 0);

    const players: SquadPlayer[] = mine
      .filter((e) => e.status !== "u" || e.minutes > 0)
      .map((e) => ({
        name: e.web_name,
        pos: pos(e.element_type),
        number: null,
        status: STATUS[e.status] ?? "unknown",
        chance: e.chance_of_playing_next_round,
        note: e.news || null,
        starts: startsOf(e.id),
        minutes: e.minutes,
        goals: e.goals_scored,
        caps: null,
        club: null,
      }));

    // Shape of the most recent game this team played: FPL position of each starter.
    const last = [...lives].reverse().find((l) => mine.filter((e) => l.get(e.id)?.starts).length >= 11);
    const shape = Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<Position, number>;
    for (const e of mine) if (last?.get(e.id)?.starts) shape[pos(e.element_type)]++;

    const watch = fplWatch(mine);

    return {
      source: "fpl",
      asOf: null,
      players,
      likely: last ? likelyLineup(players, shape, gws.length) : null,
      watch,
      withdrawals: null,
      outs: [],
    };
  });
}

type FplPlayer = Bootstrap["elements"][number];

/**
 * Players to watch from FPL, only among players who can play: injured, suspended or 0% players are listed under
 * "Out" instead. If the first-choice set-piece taker is out, the next one in the order is named, with the reason.
 */
export function fplWatch(players: FplPlayer[]): string[] {
  const canPlay = (e: FplPlayer) => !["i", "s", "u", "n"].includes(e.status) && e.chance_of_playing_next_round !== 0;
  const watch: string[] = [];
  const taker = (order: (e: FplPlayer) => number | null | undefined, what: string) => {
    const ranked = players.filter((e) => order(e) != null).sort((a, b) => order(a)! - order(b)!);
    const first = ranked[0];
    const next = ranked.find(canPlay);
    if (!first) return;
    if (canPlay(first)) watch.push(`${first.web_name} takes ${what} (first choice).`);
    else if (next) watch.push(`${next.web_name} likely takes ${what}: first choice ${first.web_name} is out, ${next.web_name} is next in the order.`);
  };
  taker((e) => e.penalties_order, "penalties");
  taker((e) => e.direct_freekicks_order, "direct free kicks");
  const nOf = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const xgi = (e: FplPlayer) => Number(e.expected_goals) + Number(e.expected_assists);
  const threat = players
    .filter((e) => e.minutes >= 180 && canPlay(e))
    .sort((a, b) => xgi(b) - xgi(a) || a.web_name.localeCompare(b.web_name))
    .slice(0, 2);
  for (const e of threat) watch.push(`${e.web_name}: ${nOf(e.goals_scored, "goal")}, ${nOf(e.assists, "assist")}; xG ${Number(e.expected_goals).toFixed(1)} + xA ${Number(e.expected_assists).toFixed(1)} in ${e.minutes} minutes.`);
  return watch;
}

// ---------------- Wikipedia squad lists ----------------

const ParseSchema = z.object({ parse: z.object({ wikitext: z.string() }).optional() });
const WIKI_POS: Record<string, Position> = { GK: "GK", DF: "DEF", MF: "MID", FW: "FWD" };

/** Top-level {{templates}} in wikitext, brace-aware (squad rows contain nested templates). */
export function templates(w: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < w.length; i++) {
    if (w[i] !== "{" || w[i + 1] !== "{") continue;
    let depth = 0;
    let j = i;
    for (; j < w.length - 1; j++) {
      if (w[j] === "{" && w[j + 1] === "{") {
        depth++;
        j++;
      } else if (w[j] === "}" && w[j + 1] === "}") {
        depth--;
        j++;
        if (depth === 0) break;
      }
    }
    out.push(w.slice(i + 2, j - 1));
    i = j;
  }
  return out;
}

/** "a|b=[[x|y]]|c={{t|1}}" → { 0: "a", b: "[[x|y]]", c: "{{t|1}}" }, splitting only on top-level pipes. */
export function params(t: string): Record<string, string> {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < t.length; i++) {
    const two = t.slice(i, i + 2);
    if (two === "{{" || two === "[[" || two === "}}" || two === "]]") {
      depth += two[0] === "}" || two[0] === "]" ? -1 : 1;
      cur += two;
      i++;
    } else if (t[i] === "|" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += t[i];
  }
  parts.push(cur);
  const o: Record<string, string> = { 0: parts[0].trim() };
  parts.slice(1).forEach((p, k) => {
    const eq = p.indexOf("=");
    if (eq > 0) o[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
    else o[String(k + 1)] = p.trim();
  });
  return o;
}

/** [[Page|Shown]] → Shown, [[Page]] → Page, strips templates/refs/markup. */
export const plain = (s: string) =>
  s
    .replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Parse a "Current squad" section: club ({{Fs player}}) or national team ({{nat fs g player}}). */
export function parseWikiSquad(wikitext: string): { players: SquadPlayer[]; asOf: string | null; intro: string } | null {
  // The specific heading first: "Players" is often a parent section whose first subsection is the squad.
  const specific = wikitext.search(/==+\s*(Current squad|First[- ]team squad)\s*==+/i);
  const start = specific >= 0 ? specific : wikitext.search(/==+\s*Players\s*==+/i);
  if (start < 0) return null;
  const after = wikitext.slice(start);
  const level = after.match(/^(=+)/)![1].length;
  // Section ends at the next heading of the same or higher level; subsections (e.g. "Out on loan") are not the squad.
  const next = after.slice(level).search(new RegExp(`\\n={2,${level}}[^=]`));
  const sub = after.slice(level).search(/\n={3,}[^=]/);
  const end = [next, sub].filter((x) => x > 0).sort((a, b) => a - b)[0];
  const section = end ? after.slice(0, level + end) : after;

  const players: SquadPlayer[] = [];
  for (const t of templates(section)) {
    const p = params(t);
    if (!/^(fs player|nat fs g player|nat fs player)$/i.test(p[0])) continue;
    const pos = WIKI_POS[(p.pos ?? "").toUpperCase()];
    const name = plain(p.name ?? "");
    if (!pos || !name) continue;
    const num = (v?: string) => (v && /^\d+$/.test(plain(v)) ? Number(plain(v)) : null);
    players.push({
      name,
      pos,
      number: p.no ? plain(p.no) || null : null,
      status: "unknown",
      chance: null,
      // Read the shown text: the link target of "vice-captain" also contains "captain".
      note: /vice/i.test(plain(p.other ?? "")) ? "vice-captain" : /captain/i.test(plain(p.other ?? "")) ? "captain" : null,
      starts: null,
      minutes: null,
      goals: num(p.goals),
      caps: num(p.caps),
      club: p.club ? plain(p.club) : null,
    });
  }
  if (!players.length) return null;
  const updated = section.match(/\{\{\s*updated\s*\|([^|}]+)/i)?.[1]?.trim().replace(/\.$/, "") ?? null;
  const intro = plain(section.slice(section.indexOf("\n"), section.search(/\{\{\s*(nat )?fs (g )?start/i)).replace(/<!--[\s\S]*?-->/g, ""));
  return { players, asOf: updated, intro };
}

const MARK: Record<string, { status: SquadPlayer["status"]; why: string }> = {
  INJ: { status: "injured", why: "withdrew injured" },
  SUS: { status: "suspended", why: "suspended" },
  WD: { status: "unavailable", why: "withdrew (reason not given)" },
};

/**
 * National teams' "Recent call-ups": players marked INJ / SUS / WD for a match on or after `since` (ISO date),
 * i.e. this window's withdrawals, not old ones.
 */
export function parseRecentWithdrawals(wikitext: string, since: string): SquadPlayer[] {
  const i = wikitext.search(/==+\s*Recent call-ups\s*==+/i);
  if (i < 0) return [];
  const out: SquadPlayer[] = [];
  for (const t of templates(wikitext.slice(i, i + 40000))) {
    const p = params(t);
    if (!/^nat fs r player$/i.test(p[0])) continue;
    const latest = p.latest ?? "";
    const mark = latest.match(/<sup>\s*(INJ|SUS|WD)\s*<\/sup>/i)?.[1]?.toUpperCase();
    const date = latest.match(/\{\{\s*sort\s*\|\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
    const pos = WIKI_POS[(p.pos ?? "").toUpperCase()];
    if (!mark || !date || date < since || !pos) continue;
    out.push({ name: plain(p.name ?? ""), pos, number: null, status: MARK[mark].status, chance: null, note: MARK[mark].why, starts: null, minutes: null, goals: null, caps: null, club: p.club ? plain(p.club) : null });
  }
  return out;
}

/** Squad from a club's or national team's Wikipedia page. No availability or lineups: Wikipedia doesn't have them. */
export function getWikiSquad(title: string): Promise<Squad | null> {
  return cached(`squad:wiki:v5:${title}`, 6 * HOUR, async () => {
    const d = await fetchJson(`https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&redirects=1&prop=wikitext&page=${encodeURIComponent(title)}`, ParseSchema);
    const parsed = parseWikiSquad(d.parse?.wikitext ?? "");
    if (!parsed) return null;
    const national = parsed.players.some((p) => p.caps != null);
    // National squads: the intro names the window and anyone who withdrew.
    const sentences = parsed.intro.split(/(?<=\.)\s+/);
    const named = national ? sentences.find((s) => /named in the squad|called up|named for/i.test(s)) ?? null : null;
    const withdrew = sentences.filter((s) => /withdr[ea]w|replaced/i.test(s)).join(" ") || null;
    const watch = national
      ? [...parsed.players]
          .filter((p) => (p.goals ?? 0) > 0)
          .sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0) || a.name.localeCompare(b.name))
          .slice(0, 3)
          .map((p) => `${p.name}: ${p.goals} international goal${p.goals === 1 ? "" : "s"} in ${p.caps} cap${p.caps === 1 ? "" : "s"}${p.club ? ` (${p.club})` : ""}.`)
      : [];
    // This window only: marks dated within the last 30 days or later (upcoming matches).
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const outs = national ? parseRecentWithdrawals(d.parse?.wikitext ?? "", since) : [];
    return { source: "wikipedia", asOf: parsed.asOf ?? named, players: parsed.players, likely: null, watch, withdrawals: withdrew, outs };
  });
}
