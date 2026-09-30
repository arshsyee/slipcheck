import type { Leg } from "../types";
import type { SourceId, SourceResult } from "../sources/types";
import { getInternationalResults, getNationalTeamInfo, INTL_RESULTS_URL, resolveNationalTeam, type IntlRow } from "../sources/international";
import { findUefaMatch } from "../sources/uefa";
import { getClubProfile, getNextMatch } from "../sources/sportsDb";
import { getVenueCoords } from "../sources/wikidata";
import { getWikiSquad } from "../sources/squad";
import { geocodeCity, getKickoffWeather } from "../sources/weather";
import { aboutClub, AVAILABILITY_RE, getGoogleClubNews } from "../sources/news";
import { DAY } from "../sources/cache";
import { averages, form, gamesFor, rates } from "../stats/team";
import { headToHead, restDays } from "../stats/match";
import { buildPick } from "../stats/insights";
import { matchFixture, teamScore } from "../teams/match";
import { flagPlayersInNews, lineupsFor, mergeFixture, nextAfter } from "./build";
import { getUpcomingMatches } from "../sources/upcoming";
import type { MatchDossier, Side, StatBlock, TeamSection, TeamStats } from "./types";

/** UEFA's id for the Nations League in its match API. */
const NATIONS_LEAGUE = 2014;
/** Stats window: national teams play ~10 games a year, so a season is too few. */
const WINDOW_DAYS = 2 * 365;
const PERIOD = "in the last 2 years";

/** Both sides are national teams (and not clubs we cover): the dataset's names, else null. */
export async function nationalTeams(leg: Leg): Promise<[string, string] | null> {
  if (!leg.homeTeam || !leg.awayTeam) return null;
  const [h, a] = await Promise.all([resolveNationalTeam(leg.homeTeam), resolveNationalTeam(leg.awayTeam)]).catch(() => [null, null]);
  return h && a ? [h, a] : null;
}

/** The match data for two national teams; buildDossier adds the source log. */
export async function buildNationalDossier(
  leg: Leg,
  legIndex: number,
  names: [string, string],
  call: <T>(s: SourceId, r: () => Promise<T>, url?: string) => Promise<SourceResult<T>>,
): Promise<Omit<MatchDossier, "sourceLog" | "stale" | "builtAt">> {
  // Fixture: UEFA for the Nations League, else TheSportsDB (friendlies, other confederations).
  const [uefaR, sdbR] = await Promise.all([
    call("uefa", () => findUefaMatch(NATIONS_LEAGUE, leg.homeTeam, leg.awayTeam), "https://www.uefa.com"),
    call("thesportsdb", async () => {
      for (const t of [leg.homeTeam!, leg.awayTeam!]) {
        const m = await getNextMatch(t).catch(() => null);
        const hit = m && new Date(m.kickoff).getTime() > Date.now() ? matchFixture(leg.homeTeam, leg.awayTeam, [m]) : null;
        if (hit) return hit;
      }
      return null;
    }, "https://www.thesportsdb.com"),
  ]);
  const uefa = uefaR.ok ? uefaR.data : null;
  const sdb = sdbR.ok ? sdbR.data : null;
  const fixture = mergeFixture(null, null, uefa, sdb);

  // Orientation from the fixture list when the slip had it the other way round.
  let [home, away] = names;
  const known = uefa ?? sdb;
  if (known && teamScore(leg.homeTeam!, known.away) > teamScore(leg.homeTeam!, known.home)) [home, away] = [away, home];
  const kickoff = fixture.kickoff ?? new Date().toISOString();

  const resultsR = await call("international-results", getInternationalResults, INTL_RESULTS_URL);
  const rows = resultsR.ok ? resultsR.data.filter((r) => r.kickoff < kickoff) : [];

  const [homeT, awayT, weather, lineups] = await Promise.all([
    team("home", home, rows, resultsR, kickoff, call),
    team("away", away, rows, resultsR, kickoff, call),
    fixture.kickoff
      ? call("open-meteo", async () => {
          const coords =
            (uefa?.stadium?.lat != null ? { lat: uefa.stadium.lat, lon: uefa.stadium.lon! } : null) ??
            (fixture.venue ? await getVenueCoords(fixture.venue) : null) ??
            (fixture.city ? await geocodeCity(fixture.city) : null);
          if (!coords) throw new Error("stadium location unknown");
          return getKickoffWeather(coords.lat, coords.lon, fixture.kickoff!);
        }, "https://open-meteo.com")
      : null,
    lineupsFor(null, uefa, call, null, uefa ? uefaR : null),
  ]);

  const h2h = resultsR.ok ? { ...resultsR, data: headToHead(rows, home, away) } : null;
  for (const [t, other] of [[homeT, awayT], [awayT, homeT]] as const) {
    if (t.availability.ok && t.availability.data.kind === "news") t.availability.data.headlines = aboutClub(t.availability.data.headlines, t.name, other.name);
  }
  for (const t of [homeT, awayT]) flagPlayersInNews(t);
  const competition = uefa ? "UEFA Nations League" : (sdb?.league ?? "International");

  return {
    legIndex,
    leg,
    league: { id: "OTHER", label: competition, country: "International" },
    fixture,
    home: homeT,
    away: awayT,
    weather,
    h2h,
    referee: null,
    lineups,
    pick: buildPick({ ...leg, homeTeam: home, awayTeam: away }, homeT, awayT, h2h?.ok ? h2h.data : null),
  };
}

async function team(
  side: Side,
  name: string,
  rows: IntlRow[],
  resultsR: SourceResult<IntlRow[]>,
  kickoff: string,
  call: <T>(s: SourceId, r: () => Promise<T>, url?: string) => Promise<SourceResult<T>>,
): Promise<TeamSection> {
  const recent = rows.filter((r) => r.kickoff >= new Date(new Date(kickoff).getTime() - WINDOW_DAYS * DAY).toISOString());
  // "At home" means a real home game: neutral-ground matches only count in "all games".
  const block = (games: ReturnType<typeof gamesFor>): StatBlock => ({ allGames: games, form5: form(games, 5), form10: form(games, 10), averages: averages(games), rates: rates(games) });
  const stats: SourceResult<TeamStats | null> = resultsR.ok
    ? {
        ...resultsR,
        data: recent.some((r) => r.home === name || r.away === name)
          ? { fdName: name, division: "International", period: `${PERIOD} (results up to ${fmtDate(rows.at(-1)?.kickoff)})`, overall: block(gamesFor(recent, name)), venue: block(gamesFor(recent.filter((r) => !r.neutral), name, side)) }
          : null,
      }
    : resultsR;
  const last = [...rows].reverse().find((r) => r.home === name || r.away === name);
  const lastMatch = last
    ? (() => {
        const home = last.home === name;
        const gf = home ? last.fthg : last.ftag;
        const ga = home ? last.ftag : last.fthg;
        const where = last.neutral ? "neutral" : home ? "at home" : "away";
        return { date: last.kickoff, competition: last.div, opponent: home ? last.away : last.home, score: `${gf > ga ? "won" : gf < ga ? "lost" : "drew"} ${gf}-${ga} ${where}` };
      })()
    : null;

  const [info, profile, news] = await Promise.all([
    call("wikipedia", () => getNationalTeamInfo(name), "https://en.wikipedia.org"),
    call("thesportsdb", () => getClubProfile(name), "https://www.thesportsdb.com"),
    call("google-news", () => getGoogleClubNews(name)),
  ]);
  const wiki = info.ok ? info.data : null;
  const squad = wiki ? await call("wikipedia", () => getWikiSquad(wiki.wikipediaTitle), "https://en.wikipedia.org") : null;
  // National teams: Nations League fixtures only; friendlies aren't in any free list, so it's never "complete".
  const upcoming = await call("uefa", () => getUpcomingMatches(name, null, true), "https://www.uefa.com");

  return {
    side,
    name,
    badge: profile.ok ? (profile.data?.badge ?? null) : null,
    standing: null,
    stats,
    restDays: restDays(lastMatch?.date, kickoff),
    lastMatch,
    availability: news.ok ? { ...news, data: { kind: "news", headlines: news.data.filter((h) => AVAILABILITY_RE.test(h.title)).slice(0, 6) } } : news,
    goalProfile: null,
    profile: { ...profile, ok: true, data: { sportsDb: profile.ok ? profile.data : null, wikidata: null } } as TeamSection["profile"],
    season: { ...info, ok: true, data: null } as TeamSection["season"],
    ranking: info.ok ? { ...info, data: wiki ? { fifa: wiki.fifaRank, elo: wiki.eloRank, asOf: wiki.rankAsOf } : null } : info,
    coach: info.ok
      ? {
          ...info,
          data: wiki?.coach
            ? {
                coach: { name: wiki.coach, since: null, sinceYear: null, age: null, nationality: null, predecessor: null, agreement: "wikipedia-only", wikipediaName: wiki.coach, wikidataName: null },
                record: null,
              }
            : null,
        }
      : info,
    news,
    squad,
    after: nextAfter(upcoming.ok ? upcoming.data : [], kickoff, false),
  };
}

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "?");
