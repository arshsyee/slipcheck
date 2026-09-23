import type { League, Leg } from "../types";
import { CUP_SLUGS, DOMESTIC_LEAGUES, LEAGUE_INFO, leagueInfo, seasonCode, seasonStart, type LeagueInfo } from "../leagues";
import { fromSource, type SourceId, type SourceResult } from "../sources/types";
import { getFixtures, getSeason, getSeasons, FD_SOURCE_URL, type FixtureRow, type MatchRow } from "../sources/footballData";
import {
  findTeam,
  findUpcomingEvent,
  getSchedule,
  getRecentResults,
  getStandings,
  getSummary,
  UEFA_SLUGS,
  type EspnEvent,
  type EspnSummary,
  type EspnTeam,
} from "../sources/espn";
import { findPlFixture, type PlFixture } from "../sources/premierLeague";
import { findUefaMatch, getEuropeResults, getUefaLineups, type UefaMatch } from "../sources/uefa";
import { geocodeCity, getKickoffWeather } from "../sources/weather";
import { getClubFacts } from "../sources/wikidata";
import { getClubProfile, getNextMatch, type NextMatch } from "../sources/sportsDb";
import { getFplTeam } from "../sources/fpl";
import { getFplSquad, getWikiSquad } from "../sources/squad";
import { getClubGoalProfile } from "../sources/openLigaDb";
import { aboutClub, AVAILABILITY_RE, playersInHeadlines, getBbcClubNews, getGoogleClubNews, mergeHeadlines, type Headline } from "../sources/news";
import { cached, HOUR, staleLog } from "../sources/cache";
import { averages, form, gamesFor, rates, resolveName } from "../stats/team";
import { headToHead, refereeStats, restDays, sameReferee } from "../stats/match";
import { buildPick } from "../stats/insights";
import { coachRecord, leagueSeason, otherCompetitions, sameStageLastSeason } from "../stats/season";
import { getCoach } from "../sources/coach";
import { computeTable } from "../stats/table";
import { bestTeamMatch, matchFixture, teamScore } from "../teams/match";
import { buildNationalDossier, nationalTeams } from "./national";
import type { FixtureInfo, Lineup, MatchDossier, Side, StatBlock, TeamSection, TeamStats } from "./types";

type Log = MatchDossier["sourceLog"];

/** Everything public we can find about the match on one slip leg. Never throws: failed sources are reported per section. */
export async function buildDossier(leg: Leg, legIndex: number): Promise<MatchDossier> {
  const log: Log = [];
  // ponytail: builds running in parallel (API route) can see each other's stale entries; key by build if that matters.
  const staleFrom = staleLog.length;
  const call = async <T>(source: SourceId, run: () => Promise<T>, url?: string): Promise<SourceResult<T>> => {
    const r = await fromSource(source, run, url);
    log.push({ source, ok: r.ok, fetchedAt: r.fetchedAt, error: r.ok ? undefined : r.error, url });
    return r;
  };

  // --- Which competition, and which way round ---
  const fixtures = await call("football-data", getFixtures, "https://www.football-data.co.uk/fixtures.csv");
  // fixtures.csv can lag behind a round; only consider matches that haven't finished.
  const upcomingFd = fixtures.ok ? fixtures.data.filter((f) => new Date(f.kickoff).getTime() > Date.now() - 3 * HOUR) : [];
  const fdFixture = matchFixture(leg.homeTeam, leg.awayTeam, upcomingFd);
  let leagueId: League = leg.league;
  if (leagueId === "OTHER" && fdFixture) leagueId = leagueFromDiv(fdFixture.div) ?? "OTHER";
  if (leagueId === "OTHER" && leg.homeTeam && leg.awayTeam) {
    // Fixture list may lag; if both clubs play in the same division, that's the competition.
    const [h, a] = await Promise.all([findDomesticLeague(leg.homeTeam), findDomesticLeague(leg.awayTeam)]);
    if (h && h === a) leagueId = h;
  }
  // National teams (Nations League, qualifiers, friendlies) have their own sources.
  if (leagueId === "OTHER") {
    const national = await nationalTeams(leg);
    if (national) return buildNationalDossier(leg, legIndex, national);
  }
  const info = leagueInfo(leagueId);

  let homeName = leg.homeTeam ?? "";
  let awayName = leg.awayTeam ?? "";

  // The organisers' own fixture lists (Premier League, UEFA) don't need ESPN ids, so ask them first.
  const [plR, uefaR] = await Promise.all([
    leagueId === "EPL" ? call("premier-league", () => findPlFixture(homeName || null, awayName || null), "https://www.premierleague.com") : null,
    info?.uefaCompetitionId ? call("uefa", () => findUefaMatch(info.uefaCompetitionId!, homeName || null, awayName || null), "https://www.uefa.com") : null,
  ]);
  const pl = plR?.ok ? plR.data : null;
  const uefa = uefaR?.ok ? uefaR.data : null;
  // Between rounds football-data.co.uk lists nothing yet: ask TheSportsDB for the club's next match (La Liga, Serie A, …).
  const sdbR =
    !pl && !uefa && !fdFixture && (homeName || awayName)
      ? await call("thesportsdb", async () => {
          const m = await getNextMatch(homeName || awayName);
          return m && new Date(m.kickoff).getTime() > Date.now() ? matchFixture(homeName || null, awayName || null, [m]) : null;
        }, "https://www.thesportsdb.com")
      : null;
  const sdb = sdbR?.ok ? sdbR.data : null;

  // Put the teams the right way round, and fill in a missing opponent, from the best fixture we found.
  const known = pl ?? uefa ?? fdFixture ?? sdb;
  if (known) {
    const slipTeam = homeName || awayName;
    const slipIsHome = teamScore(slipTeam, known.home) >= teamScore(slipTeam, known.away);
    if (!homeName || !awayName) {
      [homeName, awayName] = slipIsHome ? [slipTeam, known.away] : [known.home, slipTeam];
    } else if (!slipIsHome) {
      [homeName, awayName] = [awayName, homeName]; // slip listed the teams the other way round
    }
  }

  // Domestic league per club (for UEFA matches, each club's own league supplies stats and table).
  const [homeDomestic, awayDomestic] = await Promise.all([
    info?.fd ? leagueId : findDomesticLeague(homeName),
    info?.fd ? leagueId : findDomesticLeague(awayName),
  ]);

  // --- ESPN identities + the ESPN event ---
  const espnSlugs = (domestic: League | null) => [
    ...(domestic ? countrySlugs(LEAGUE_INFO[domestic as keyof typeof LEAGUE_INFO].country) : []),
    ...(info && !info.fd ? [info.espn] : []),
  ];
  let [homeEspnR, awayEspnR] = await Promise.all([
    call("espn", () => findTeam(homeName, espnSlugs(homeDomestic))),
    call("espn", () => findTeam(awayName, espnSlugs(awayDomestic))),
  ]);

  // Still missing an opponent (e.g. La Liga slip with one team, fixture list not out yet): use the club's next ESPN fixture.
  if (info && (!homeName || !awayName)) {
    const one = homeEspnR.ok && homeEspnR.data ? homeEspnR.data : awayEspnR.ok && awayEspnR.data ? awayEspnR.data : null;
    const next = one ? (await getSchedule(info.espn, one.id, true).catch(() => [])).find((e) => !e.completed) : null;
    if (next) {
      homeName = next.home.name;
      awayName = next.away.name;
      [homeEspnR, awayEspnR] = await Promise.all([
        call("espn", () => findTeam(homeName, espnSlugs(homeDomestic ?? leagueId))),
        call("espn", () => findTeam(awayName, espnSlugs(awayDomestic ?? leagueId))),
      ]);
    }
  }
  const homeEspn = homeEspnR.ok ? homeEspnR.data : null;
  const awayEspn = awayEspnR.ok ? awayEspnR.data : null;

  const eventR = info && homeEspn && awayEspn ? await call("espn", () => findUpcomingEvent(info.espn, homeEspn.id, awayEspn.id)) : null;
  const event = eventR?.ok ? eventR.data : null;
  const summaryR = event && info ? await call("espn", () => getSummary(info.espn, event.id)) : null;
  const summary = summaryR?.ok ? summaryR.data : null;

  const fixture = mergeFixture(fdFixture, event?.date ?? null, summary, pl, uefa, sdb);
  const kickoff = fixture.kickoff ?? new Date().toISOString();

  // --- Teams, head-to-head, referee, weather, lineups: all in parallel ---
  const sameDivision = homeDomestic && homeDomestic === awayDomestic ? LEAGUE_INFO[homeDomestic as keyof typeof LEAGUE_INFO].fd : null;

  const [home, away, h2h, weather, lineups] = await Promise.all([
    buildTeam("home", homeName, homeEspn, homeDomestic, leagueId, kickoff, call),
    buildTeam("away", awayName, awayEspn, awayDomestic, leagueId, kickoff, call),
    sameDivision
      ? call("football-data", async () => {
          const rows = await getSeasons(sameDivision, 4);
          const h = resolveName(homeName, rows);
          const a = resolveName(awayName, rows);
          if (!h || !a) throw new Error("clubs not found in football-data.co.uk history");
          return headToHead(rows, h, a);
        }, FD_SOURCE_URL(sameDivision))
      : null,
    fixture.kickoff ? weatherFor(uefa, homeEspn?.name ?? homeName, homeDomestic, fixture, call) : null,
    lineupsFor(pl, uefa, summary, call, plR, uefaR, summaryR),
  ]);

  const referee =
    fixture.referee && sameDivision
      ? await call("football-data", async () => {
          const rows = [...(await getSeason(sameDivision)), ...(await getSeasons(sameDivision, 1).catch(() => [] as MatchRow[]))];
          const unique = [...new Map(rows.map((r) => [`${r.kickoff}${r.home}`, r])).values()];
          return refereeStats(unique, fixture.referee!);
        }, FD_SOURCE_URL(sameDivision))
      : null;

  // Match previews mention both clubs; keep each injury headline only on the side it's about.
  for (const [t, other] of [[home, away], [away, home]] as const) {
    if (t.availability.ok && t.availability.data.kind === "news") {
      t.availability.data.headlines = aboutClub(t.availability.data.headlines, t.name, other.name);
    }
  }
  for (const t of [home, away]) flagPlayersInNews(t);

  const matchNews = summaryR ? (summaryR.ok ? { ...summaryR, data: summaryR.data.news.map(toHeadline) } : summaryR) : null;

  return {
    legIndex,
    leg,
    league: { id: leagueId, label: info?.label ?? "Unknown competition", country: info?.country ?? "" },
    fixture,
    home,
    away,
    weather,
    h2h,
    referee,
    lineups,
    matchNews,
    pick: buildPick({ ...leg, homeTeam: home.name, awayTeam: away.name }, home, away, h2h?.ok ? h2h.data : null),
    sourceLog: log,
    stale: staleLog.slice(staleFrom).map((x) => ({ source: sourceOfKey(x.key), savedAt: x.savedAt, error: x.error })),
    builtAt: new Date().toISOString(),
  };
}

// ---------------- teams ----------------

async function buildTeam(
  side: Side,
  slipName: string,
  espn: EspnTeam | null,
  domestic: League | null,
  competition: League,
  kickoff: string,
  call: <T>(s: SourceId, r: () => Promise<T>, url?: string) => Promise<SourceResult<T>>,
): Promise<TeamSection> {
  const name = espn?.name ?? slipName;
  const dInfo = domestic ? (LEAGUE_INFO[domestic as keyof typeof LEAGUE_INFO] as LeagueInfo) : null;
  const isEpl = domestic === "EPL";
  const uk = dInfo?.country === "England" || dInfo?.country === "Scotland";

  // Our club's id in merged match lists: ESPN's when we have it, else the name.
  const teamId = espn?.id ?? name;
  const [stats, standing, cups, europe, fpl, goalProfile, profile, news, squad] = await Promise.all([
    dInfo?.fd
      ? call("football-data", async () => {
          const rows = await getSeason(dInfo.fd!);
          const fdName = resolveName(name, rows) ?? resolveName(slipName, rows);
          return fdName ? teamStats(rows, fdName, dInfo.fd!, side) : null;
        }, FD_SOURCE_URL(dInfo.fd))
      : Promise.resolve({ ok: false as const, error: "No league data for this club", source: "football-data" as const, fetchedAt: new Date().toISOString() }),
    dInfo?.fd
      ? call("football-data", async () => {
          // Our own table from results: verified more reliable than ESPN's (see scripts/verify-core.ts).
          const rows = await getSeason(dInfo.fd!);
          const fdName = resolveName(name, rows) ?? resolveName(slipName, rows);
          const row = computeTable(rows, domestic ?? undefined, await deductionsFor(dInfo, rows)).find((r) => r.team === fdName) ?? null;
          return row ? { ...row, team: name } : null;
        }, FD_SOURCE_URL(dInfo.fd))
      : dInfo
        ? call("espn", async () => {
            const table = await getStandings(dInfo.espn);
            const hit = bestTeamMatch(name, table.map((r) => r.team));
            return table.find((r) => r.teamId === espn?.id) ?? table.find((r) => r.team === hit?.name) ?? null;
          })
        : null,
    // Domestic cups: ESPN is the only free source, so they're an optional extra.
    espn && dInfo && CUP_SLUGS[dInfo.country]?.length ? call("espn", () => getRecentResults(CUP_SLUGS[dInfo.country], espn.id)) : null,
    call("uefa", () => getEuropeResults(name, teamId), "https://www.uefa.com"),
    isEpl ? call("fpl", () => getFplTeam(name), "https://fantasy.premierleague.com") : null,
    dInfo?.openLigaDb ? call("openligadb", () => getClubGoalProfile(dInfo.openLigaDb!, name), "https://www.openligadb.de") : null,
    call("thesportsdb", async () => {
      const [sportsDb, wikidata] = await Promise.all([getClubProfile(name).catch(() => null), getClubFacts(name, dInfo?.country).catch(() => null)]);
      if (!sportsDb && !wikidata) throw new Error("club not found");
      return { sportsDb, wikidata };
    }),
    call("google-news", async () => {
      const results = await Promise.allSettled([getGoogleClubNews(name), ...(uk ? [getBbcClubNews(name)] : [])]);
      const lists = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      // Only a failure if every news feed failed; one working feed is enough.
      if (!lists.length) throw (results[0] as PromiseRejectedResult).reason;
      return mergeHeadlines(lists, 12);
    }),
    // Squad: FPL for the Premier League (has availability and starts); Wikipedia's squad list elsewhere.
    isEpl
      ? call("fpl", () => getFplSquad(name), "https://fantasy.premierleague.com")
      : dInfo
        ? call("wikipedia", async () => {
            const facts = await getClubFacts(name, dInfo.country);
            return facts?.wikipediaTitle ? getWikiSquad(facts.wikipediaTitle) : null;
          }, "https://en.wikipedia.org")
        : null,
  ]);

  // Every result this season: league (football-data.co.uk), Europe (UEFA), cups (ESPN, when up). One game per day at most.
  const leagueEvents: EspnEvent[] = (stats.ok ? (stats.data?.overall.allGames ?? []) : []).map((g) => ({
    id: `fd:${g.kickoff}`,
    date: g.kickoff,
    completed: true,
    competition: dInfo?.label ?? "League",
    slug: dInfo?.espn ?? "league",
    venue: null,
    home: g.venue === "home" ? { id: teamId, name, score: g.gf } : { id: g.opponent, name: g.opponent, score: g.ga },
    away: g.venue === "home" ? { id: g.opponent, name: g.opponent, score: g.ga } : { id: teamId, name, score: g.gf },
  }));
  const byDay = new Map<string, EspnEvent>();
  for (const e of [...leagueEvents, ...(europe.ok ? europe.data : []), ...(cups?.ok ? cups.data : [])]) {
    if (e.completed && !byDay.has(e.date.slice(0, 10))) byDay.set(e.date.slice(0, 10), e);
  }
  const events = [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date));

  const [season, coach] = await Promise.all([
    call("football-data", async () => {
      if (!dInfo?.fd) return null;
      const rows = await getSeason(dInfo.fd);
      const fdName = resolveName(name, rows) ?? resolveName(slipName, rows);
      if (!fdName) return null;
      const league = leagueSeason(rows, fdName, domestic!, await deductionsFor(dInfo, rows));
      // Same stage last season (same division; promoted clubs weren't in it).
      const lastRows = await getSeason(dInfo.fd, seasonCode(new Date(), 1)).catch(() => [] as MatchRow[]);
      const lastName = resolveName(name, lastRows);
      const lastSeasonSameStage = league && lastName ? sameStageLastSeason(lastRows, lastName, league.table.played, domestic!, dInfo.label) : null;
      return { league, lastSeasonSameStage, otherCompetitions: dInfo ? otherCompetitions(events, teamId, dInfo.espn) : [] };
    }, dInfo?.fd ? FD_SOURCE_URL(dInfo.fd) : undefined),
    call("wikidata", async () => {
      const facts = await getClubFacts(name, dInfo?.country);
      if (!facts) return null;
      const c = await getCoach(facts.qid, facts.wikipediaTitle, seasonStart());
      if (!c) return null;
      let record = null;
      // League form under the coach comes from football-data.co.uk, so it still works when ESPN (cups, Europe) is down.
      if (c.since) {
        const seasons = dInfo?.fd ? await getSeasons(dInfo.fd, 4) : [];
        const fdName = resolveName(name, seasons);
        record = coachRecord(c.since, events, teamId, fdName ? gamesFor(seasons, fdName) : [], seasonStart());
      }
      return { coach: c, record };
    }, "https://www.wikidata.org"),
  ]);

  // Without the club's league results we can't know its last game (a Europe-only view would overstate rest).
  const prev = leagueEvents.length ? events.find((e) => e.date < kickoff) : undefined;
  const lastMatch = prev
    ? {
        date: prev.date,
        competition: prev.competition,
        opponent: prev.home.id === teamId ? prev.away.name : prev.home.name,
        score: plainScore(prev.home.id === teamId ? prev.home.score : prev.away.score, prev.home.id === teamId ? prev.away.score : prev.home.score, prev.home.id === teamId ? "home" : "away"),
      }
    : null;

  const availability: TeamSection["availability"] =
    fpl?.ok && fpl.data
      ? { ...fpl, data: { kind: "official", players: fpl.data.availability } }
      : news.ok
        ? { ...news, data: { kind: "news", headlines: news.data.filter((h) => AVAILABILITY_RE.test(h.title)).slice(0, 6) } }
        : news;

  return {
    side,
    name,
    espn: espn ? { id: espn.id, logo: espn.logo, color: espn.color, abbreviation: espn.abbreviation } : null,
    badge: (profile.ok ? profile.data.sportsDb?.badge : null) ?? espn?.logo ?? null,
    standing,
    stats,
    restDays: restDays(lastMatch?.date, kickoff),
    lastMatch,
    availability,
    keyPlayers: fpl ? (fpl.ok ? { ...fpl, data: fpl.data?.keyPlayers ?? [] } : fpl) : null,
    goalProfile,
    profile,
    season,
    coach,
    news,
    squad,
  };
}

function teamStats(rows: MatchRow[], fdName: string, division: string, side: Side): TeamStats {
  const block = (venue: "all" | Side): StatBlock => {
    const games = gamesFor(rows, fdName, venue);
    return { allGames: games, form5: form(games, 5), form10: form(games, 10), averages: averages(games), rates: rates(games) };
  };
  return { fdName, division, period: "this season", overall: block("all"), venue: block(side) };
}

// ---------------- fixture ----------------

export function mergeFixture(fd: FixtureRow | null, espnDate: string | null, espn: EspnSummary | null, pl: PlFixture | null, uefa: UefaMatch | null, sdb: NextMatch | null = null): FixtureInfo {
  const sources: SourceId[] = [];
  if (sdb) sources.push("thesportsdb");
  if (fd) sources.push("football-data");
  if (espnDate) sources.push("espn");
  if (pl) sources.push("premier-league");
  if (uefa) sources.push("uefa");

  // Most authoritative first: the competition organiser, then ESPN, then football-data.co.uk.
  const kickoffs = [pl?.kickoff, uefa?.kickoff, espnDate, fd?.kickoff, sdb?.kickoff].filter(Boolean) as string[];
  const referees = [pl?.referee, uefa?.referee, espn?.referee, fd?.referee].filter(Boolean) as string[];
  const conflicts: string[] = [];
  if (kickoffs.length > 1 && kickoffs.some((k) => Math.abs(new Date(k).getTime() - new Date(kickoffs[0]).getTime()) > 30 * 60_000)) {
    conflicts.push("Sources list different kick-off times; showing the organiser's.");
  }
  if (referees.length > 1 && referees.some((r) => !sameReferee(r, referees[0]))) {
    conflicts.push(`Referee differs between sources (${[...new Set(referees)].join(" / ")}).`);
  }

  return {
    found: sources.length > 0,
    kickoff: kickoffs[0] ?? null,
    venue: pl?.ground ?? uefa?.stadium?.name ?? espn?.venue?.name ?? sdb?.venue ?? null,
    city: pl?.city ?? uefa?.stadium?.city ?? espn?.venue?.city ?? null,
    capacity: uefa?.stadium?.capacity ?? null,
    referee: referees[0] ?? null,
    round: uefa?.round ?? null,
    sources,
    conflicts,
  };
}

async function weatherFor(
  uefa: UefaMatch | null,
  homeClub: string,
  homeDomestic: League | null,
  fixture: FixtureInfo,
  call: <T>(s: SourceId, r: () => Promise<T>, url?: string) => Promise<SourceResult<T>>,
) {
  return call("open-meteo", async () => {
    let coords = uefa?.stadium?.lat != null ? { lat: uefa.stadium.lat, lon: uefa.stadium.lon! } : null;
    if (!coords) {
      const country = homeDomestic ? LEAGUE_INFO[homeDomestic as keyof typeof LEAGUE_INFO].country : null;
      const facts = await getClubFacts(homeClub, country).catch(() => null);
      if (facts?.lat != null) coords = { lat: facts.lat, lon: facts.lon! };
    }
    if (!coords && fixture.city) coords = await geocodeCity(fixture.city);
    if (!coords) throw new Error("stadium location unknown");
    return getKickoffWeather(coords.lat, coords.lon, fixture.kickoff!);
  }, "https://open-meteo.com");
}

export async function lineupsFor(
  pl: PlFixture | null,
  uefa: UefaMatch | null,
  espn: EspnSummary | null,
  call: <T>(s: SourceId, r: () => Promise<T>, url?: string) => Promise<SourceResult<T>>,
  plR: SourceResult<unknown> | null,
  uefaR: SourceResult<unknown> | null,
  espnR: SourceResult<unknown> | null,
): Promise<SourceResult<Lineup[]> | null> {
  if (pl?.lineups.length && plR) return { ...plR, ok: true, data: pl.lineups } as SourceResult<Lineup[]>;
  if (uefa) {
    const r = await call("uefa", () => getUefaLineups(uefa.id), `https://www.uefa.com`);
    if (r.ok && r.data.length) return r;
  }
  if (espn?.lineups.length && espnR) return { ...espnR, ok: true, data: espn.lineups } as SourceResult<Lineup[]>;
  const any = plR ?? uefaR ?? espnR;
  // Nothing published yet is normal before ~1 hour to kick-off.
  return any ? { ok: true, data: [], source: any.source, fetchedAt: any.fetchedAt } : null;
}

// ---------------- helpers ----------------

/** Points deductions from ESPN's table, keyed by football-data.co.uk club name. */
export async function deductionsFor(info: LeagueInfo, rows: MatchRow[]): Promise<Map<string, number>> {
  const table = await getStandings(info.espn).catch(() => []);
  const out = new Map<string, number>();
  for (const t of table) {
    if (!t.deductions) continue;
    const fdName = resolveName(t.team, rows);
    if (fdName) out.set(fdName, t.deductions);
  }
  return out;
}

function leagueFromDiv(div: string): League | null {
  const hit = DOMESTIC_LEAGUES.find((l) => LEAGUE_INFO[l].fd === div);
  return hit ?? null;
}

function countrySlugs(country: string): string[] {
  return DOMESTIC_LEAGUES.filter((l) => LEAGUE_INFO[l].country === country).map((l) => LEAGUE_INFO[l].espn);
}

/** For UEFA matches: which domestic division a club plays in, by searching every football-data.co.uk file. */
export function findDomesticLeague(club: string): Promise<League | null> {
  if (!club) return Promise.resolve(null);
  return cached(`domestic:${club}`, 12 * HOUR, async () => {
    const lists = await Promise.all(
      DOMESTIC_LEAGUES.map(async (l) => ({ l, rows: await getSeason(LEAGUE_INFO[l].fd!).catch(() => [] as MatchRow[]) })),
    );
    let best: { l: League; score: number } | null = null;
    for (const { l, rows } of lists) {
      const names = [...new Set(rows.flatMap((r) => [r.home, r.away]))];
      const hit = bestTeamMatch(club, names, 0.85);
      if (hit && hit.score > (best?.score ?? 0)) best = { l, score: hit.score };
    }
    return best?.l ?? null;
  });
}

function toHeadline(n: EspnSummary["news"][number]): Headline {
  return { title: n.headline, url: n.url ?? "https://www.espn.com/soccer", published: n.published, publisher: "ESPN", source: "espn" };
}

export { UEFA_SLUGS };

/** From the club's side: "won 3-0 at home", "lost 1-2 away". */
function plainScore(gf: number | null, ga: number | null, venue: "home" | "away") {
  if (gf == null || ga == null) return `score unknown (${venue})`;
  return `${gf > ga ? "won" : gf < ga ? "lost" : "drew"} ${gf}-${ga} ${venue === "home" ? "at home" : "away"}`;
}

/** Cache keys start with the source ("espn:…", "fd:…"). */
export function sourceOfKey(key: string): SourceId {
  const p = key.split(":")[0];
  const map: Record<string, SourceId> = { intl: key.startsWith("intl:wiki") ? "wikipedia" : "international-results", fd: "football-data", pl: "premier-league", sportsdb: "thesportsdb", weather: "open-meteo", geocode: "open-meteo", coach: key.startsWith("coach:wikipedia") ? "wikipedia" : "wikidata", news: key.includes("bbc") ? "bbc" : "google-news" };
  return map[p] ?? (p as SourceId);
}

/** Mark squad players named in this team's injury/team-news headlines (after they've been attributed to the right side). */
export function flagPlayersInNews(t: TeamSection) {
  const squad = t.squad?.ok ? t.squad.data : null;
  const heads = t.availability.ok && t.availability.data.kind === "news" ? t.availability.data.headlines : [];
  if (!squad || !heads.length) return;
  const hits = playersInHeadlines(squad.players.map((p) => p.name), heads);
  // Copy: squads come from the cache and are shared between reports.
  const players = squad.players.map((p) => {
    const h = hits.get(p.name);
    return { ...p, inNews: h ? { title: h.title, publisher: h.publisher } : null };
  });
  // A player to watch who is also in the injury news must say so on the same line.
  const flagged = players.filter((p) => p.inNews).map((p) => p.name);
  const watch = squad.watch.map((w) => (flagged.some((n) => w.startsWith(`${n}:`) || w.startsWith(`${n} `)) ? `${w} Named in injury news: may miss out.` : w));
  t.squad = { ...t.squad!, ok: true, data: { ...squad, players, watch } } as TeamSection["squad"];
}
