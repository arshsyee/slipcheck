import type { League, Leg } from "../types";
import type { SourceId, SourceResult } from "../sources/types";
import type { StandingRow } from "../stats/table";
import type { KickoffWeather } from "../sources/weather";
import type { Headline } from "../sources/news";
import type { ClubProfile } from "../sources/sportsDb";
import type { ClubFacts } from "../sources/wikidata";
import type { Averages, FormSummary, Rates, TeamGame } from "../stats/team";
import type { H2HMeeting, HeadToHead, RefereeStats } from "../stats/match";
import type { GoalTiming, ScorerLine } from "../sources/openLigaDb";
import type { Coach } from "../sources/coach";
import type { Squad } from "../sources/squad";
import type { AvailabilityEntry } from "../stats/lineup";
import type { CoachRecord, CompetitionRun, LeagueSeason, SameStageLastSeason } from "../stats/season";

export type Side = "home" | "away";

export interface StatBlock {
  /** Every league game this season in this scope, newest first. */
  allGames?: TeamGame[];
  form5: FormSummary;
  form10: FormSummary;
  averages: Averages;
  rates: Rates;
}

export interface TeamStats {
  /** Club name as spelled in the football-data.co.uk files. */
  fdName: string;
  /** The window the numbers cover, as a phrase: "this season", "in the last 2 years". */
  period: string;
  division: string;
  /** Whole season, all venues. */
  overall: StatBlock;
  /** Only home games for the home side / away games for the away side. */
  venue: StatBlock;
}

export interface TeamSection {
  side: Side;
  name: string;
  /** Club badge image (TheSportsDB). */
  badge: string | null;
  standing: SourceResult<StandingRow | null> | null;
  stats: SourceResult<TeamStats | null>;
  restDays: number | null;
  lastMatch: { date: string; competition: string; opponent: string; score: string } | null;
  /** Premier League: official FPL flags. Elsewhere: availability-related headlines. */
  availability: SourceResult<{ kind: "official"; players: AvailabilityEntry[] } | { kind: "news"; headlines: Headline[] }>;
  goalProfile: SourceResult<{ matches: number; topScorers: ScorerLine[]; timing: GoalTiming } | null> | null;
  profile: SourceResult<{ sportsDb: ClubProfile | null; wikidata: ClubFacts | null }>;
  /** How the club's season is going: league (from results) + Europe (UEFA) and cups (Wikipedia / OpenLigaDB). */
  season: SourceResult<{ league: LeagueSeason | null; lastSeasonSameStage: SameStageLastSeason | null; otherCompetitions: CompetitionRun[] } | null>;
  /** National teams only: FIFA and Elo world ranking (Wikipedia). */
  ranking?: SourceResult<{ fifa: number | null; elo: number | null; asOf: string | null } | null>;
  /** Current coach (Wikipedia + Wikidata) and form since they arrived. */
  coach: SourceResult<{ coach: Coach; record: CoachRecord | null } | null>;
  news: SourceResult<Headline[]>;
  /**
   * Rotation risk: the team's next match after this one. `complete` is false when a league's full fixture list isn't in
   * any free source (La Liga, Serie A, Ligue 1, national friendlies), so an unlisted game could come first.
   * Optional: older saved reports lack it.
   */
  after?: { date: string; competition: string; opponent: string; venue: "home" | "away"; daysAfter: number; complete: boolean } | null;
  /** Squad by position, who's out, likely XI (Premier League only), players to watch. */
  squad: SourceResult<Squad | null> | null;
}

export interface Lineup {
  team: string;
  formation: string | null;
  starters: { name: string; jersey: string | null; position: string | null }[];
  subs: { name: string; jersey: string | null; position: string | null }[];
}

export interface FixtureInfo {
  found: boolean;
  kickoff: string | null;
  venue: string | null;
  city: string | null;
  capacity: number | null;
  referee: string | null;
  round: string | null;
  /** Which sources agreed on/provided the fixture. */
  sources: SourceId[];
  /** e.g. UEFA and football-data.co.uk disagree on the referee. */
  conflicts: string[];
}

/** One row of the market-specific comparison shown with the pick. */
export interface PickStat {
  /** Which games the row covers, e.g. "Inter at home · Parma away" or "All games this season". */
  group: string;
  label: string;
  home: string;
  away: string;
}

export interface Pick {
  /** Which side the pick backs, for highlighting. */
  pickSide: Side | "draw" | "both" | null;
  title: string;
  bullets: string[];
  /** The numbers that matter for this bet type, home vs away. */
  stats: PickStat[];
}

export type DossierTab = "form" | "stats" | "h2h" | "availability" | "squad" | "referee" | "matchCentre" | "news" | "club";

export interface MatchDossier {
  legIndex: number;
  leg: Leg;
  league: { id: League; label: string; country: string };
  fixture: FixtureInfo;
  home: TeamSection;
  away: TeamSection;
  weather: SourceResult<KickoffWeather | null> | null;
  h2h: SourceResult<HeadToHead> | null;
  /** Meetings in UEFA competitions, last 5 seasons (null for national teams). Optional: older saved reports lack it. */
  h2hEurope?: SourceResult<H2HMeeting[]> | null;
  /** Meetings in domestic cups, last 5 seasons (only when both clubs are from the same country). */
  h2hCups?: SourceResult<H2HMeeting[]> | null;
  referee: SourceResult<RefereeStats | null> | null;
  lineups: SourceResult<Lineup[]> | null;
  /** First in the layout: the bet, key facts and the market-specific numbers. */
  pick: Pick;
  /** Every source call made for this match (for the sources footer). */
  sourceLog: { source: SourceId; ok: boolean; fetchedAt: string; error?: string; url?: string }[];
  /** Sources that were down, so their last saved copy was used instead (and how old it is). */
  stale: { source: SourceId; savedAt: string; error: string }[];
  builtAt: string;
}

