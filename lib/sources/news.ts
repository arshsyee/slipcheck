import { cached, MINUTE } from "./cache";
import { fetchText } from "./http";
import { canonical, normalize } from "../teams/match";
import { TEAM_ALIASES } from "../teams/aliases";

export interface Headline {
  title: string;
  url: string;
  published: string | null;
  publisher: string;
  source: "bbc" | "google-news";
}

/** Minimal RSS 2.0 item parser (BBC and Google News both publish plain RSS). */
export function parseRss(xml: string, source: Headline["source"], fallbackPublisher: string): Headline[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items.flatMap((item) => {
    const tag = (name: string) => {
      const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
      return m ? decode(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim()) : null;
    };
    const title = tag("title");
    const url = tag("link");
    if (!title || !url) return [];
    const pub = tag("pubDate");
    return [
      {
        // Google News appends " - Publisher" to titles.
        title: source === "google-news" ? title.replace(/\s+-\s+[^-]+$/, "") : title,
        url,
        published: pub ? new Date(pub).toISOString() : null,
        publisher: tag("source") ?? fallbackPublisher,
        source,
      },
    ];
  });
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** BBC club feeds exist for UK clubs at /sport/football/teams/{slug}. */
export function bbcSlug(club: string) {
  return canonical(club)
    .replace(/\b(fc|afc)\b/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function getBbcClubNews(club: string): Promise<Headline[]> {
  const url = `https://feeds.bbci.co.uk/sport/football/teams/${bbcSlug(club)}/rss.xml`;
  return cached(`news:${url}`, 20 * MINUTE, async () => parseRss(await fetchText(url), "bbc", "BBC Sport"));
}

/** Google News search for team news and injuries from the last week. */
export function getGoogleClubNews(club: string): Promise<Headline[]> {
  const q = `"${club}" football (injury OR injured OR "team news" OR suspended OR lineup OR squad) when:7d`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-GB&gl=GB&ceid=GB:en`;
  return cached(`news:${url}`, 20 * MINUTE, async () => parseRss(await fetchText(url), "google-news", "Google News"));
}

/** Newest first, near-duplicate titles removed. */
export function mergeHeadlines(lists: Headline[][], limit = 10): Headline[] {
  const seen = new Set<string>();
  return lists
    .flat()
    .sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""))
    .filter((h) => {
      const key = normalize(h.title).split(" ").slice(0, 8).join(" ");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/** Headlines that look like availability news (injuries, suspensions, fitness). */
export const AVAILABILITY_RE = /injur|fitness|doubt|ruled out|sidelined|suspend|ban\b|return|hamstring|knee|ankle|muscle|setback|miss(es)? /i;

/** Position of the first mention of a club in a headline (-1 if absent). Knows nicknames: "Inter", "Spurs", "Man Utd". */
export function mentionIndex(title: string, club: string): number {
  // Possessives ("Brazil's friendlies") must still count as a mention of "Brazil".
  const t = ` ${normalize(title.replace(/['’]s\b/gi, ""))} `;
  const full = canonical(club);
  const names = new Set([normalize(club), full, ...Object.keys(TEAM_ALIASES).filter((k) => TEAM_ALIASES[k] === full && k.length >= 3)]);
  // A distinctive single word is enough ("Villarreal", "Arsenal"), but not generic ones ("City", "United").
  for (const w of full.split(" ")) if (w.length >= 5 && !["united", "city", "athletic", "sporting", "real"].includes(w)) names.add(w);
  let best = -1;
  for (const n of names) {
    const i = t.indexOf(` ${n} `);
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  return best;
}

/** Other sports and women's teams share names with men's football teams ("England", "Arsenal"). */
const NOT_THIS_TEAM_RE = /\b(cricket|wicket|wicketkeeper|t20|odi|test series|tri-series|rugby|tennis|netball|women|womens|lionesses|wsl|nwsl)\b/i;

/**
 * Keep only headlines that name `club`, and name it before the opponent (search results often match only the article
 * body), and aren't about another sport or the women's team.
 */
export function aboutClub(headlines: Headline[], club: string, opponent: string): Headline[] {
  return headlines.filter((h) => {
    if (NOT_THIS_TEAM_RE.test(h.title) && !/women/i.test(club)) return false;
    const own = mentionIndex(h.title, club);
    const opp = mentionIndex(h.title, opponent);
    return own >= 0 && (opp < 0 || own <= opp);
  });
}

/** A headline saying someone can't play. */
const OUT_RE = /ruled out|withdr[ae]w|injur|\bmiss(es|ing)?\b|doubt|suspend|\bban(ned)?\b|setback|sidelined|absen(ce|t)|surgery|\bblow\b|\bout of\b/i;
/** …unless it's (also) about someone coming in: then who is out vs in is ambiguous, so it isn't used. */
const IN_RE = /\breturns?\b|\breturn to\b|called up|call-?up|\bcall\b|replac|recalled|back in\b|\bearns?\b|relief|boost|fit again|all clear|in (the )?squad|named in|included/i;

/**
 * Squad players that injury headlines say may not play. A headline counts only if it reports an absence and isn't
 * about someone returning or replacing. A player matches by full name, or by a surname (5+ letters) no one else in the
 * squad shares and that isn't preceded by a different first name ("Joan García" never matches "Eric García").
 * Returns name → first matching headline. Misses some; never guesses.
 */
export function playersInHeadlines(names: string[], headlines: Headline[]): Map<string, Headline> {
  const tokens = (n: string) => normalize(n).split(" ").filter(Boolean);
  const surname = (n: string) => tokens(n).at(-1) ?? "";
  const counts = new Map<string, number>();
  for (const n of names) counts.set(surname(n), (counts.get(surname(n)) ?? 0) + 1);
  const out = new Map<string, Headline>();
  for (const h of headlines) {
    if (!OUT_RE.test(h.title) || IN_RE.test(h.title)) continue;
    const raw = h.title.replace(/['’]s\b/gi, "");
    const t = ` ${normalize(raw)} `;
    for (const n of names) {
      if (out.has(n)) continue;
      if (t.includes(` ${normalize(n)} `)) {
        out.set(n, h);
        continue;
      }
      const sn = surname(n);
      if (sn.length < 5 || counts.get(sn) !== 1 || !t.includes(` ${sn} `)) continue;
      // "Joan García": a different first name directly before the surname (just a space between) means another person.
      const first = tokens(n)[0];
      const before = [...raw.matchAll(/(\p{Lu}[\p{L}-]*) (\p{L}[\p{L}-]*)/gu)].filter((m) => normalize(m[2]) === sn).map((m) => normalize(m[1]));
      const ok = !before.length || before.some((b) => b === first);
      if (ok) out.set(n, h);
    }
  }
  return out;
}
