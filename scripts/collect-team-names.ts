/**
 * Records every club name per division from football-data.co.uk and ESPN into
 * tests/fixtures/team-names.json, so team matching is tested against real names offline.
 *   npx tsx scripts/collect-team-names.ts
 */
import { writeFileSync } from "node:fs";
import { DOMESTIC_LEAGUES, LEAGUE_INFO, seasonCode } from "../lib/leagues";

const UA = { "user-agent": "Mozilla/5.0 (SlipCheck)" };

async function fdNames(div: string): Promise<string[]> {
  const res = await fetch(`https://www.football-data.co.uk/mmz4281/${seasonCode()}/${div}.csv`, { headers: UA });
  const text = (await res.text()).replace(/^﻿/, "");
  const [header, ...rows] = text.split(/\r?\n/).filter(Boolean);
  const cols = header.split(",");
  const h = cols.indexOf("HomeTeam");
  const a = cols.indexOf("AwayTeam");
  const names = new Set<string>();
  for (const r of rows) {
    const c = r.split(",");
    if (c[h]) names.add(c[h]);
    if (c[a]) names.add(c[a]);
  }
  return [...names].sort();
}

async function espnNames(slug: string): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams?limit=1000`);
  const d = (await res.json()) as { sports: { leagues: { teams: { team: { id: string; displayName: string } }[] }[] }[] };
  return d.sports[0].leagues[0].teams.map((t) => ({ id: t.team.id, name: t.team.displayName })).sort((x, y) => x.name.localeCompare(y.name));
}

async function otherSources() {
  const json = async (url: string) => (await fetch(url, { headers: UA })).json();
  const season = new Date().getUTCMonth() >= 6 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1;
  const oldb = async (l: string) =>
    [...new Set(((await json(`https://api.openligadb.de/getmatchdata/${l}/${season}`)) as { team1: { teamName: string }; team2: { teamName: string } }[]).flatMap((m) => [m.team1.teamName, m.team2.teamName]))].sort();
  const fpl = ((await json("https://fantasy.premierleague.com/api/bootstrap-static/")) as { teams: { name: string }[] }).teams.map((t) => t.name).sort();
  const uefa = async (id: number) =>
    [...new Set(((await json(`https://match.uefa.com/v5/matches?competitionId=${id}&seasonYear=${season + 1}&limit=500&offset=0`)) as { homeTeam: { internationalName: string }; awayTeam: { internationalName: string } }[]).flatMap((m) => [m.homeTeam.internationalName, m.awayTeam.internationalName]))].sort();
  return {
    openligadb: { BUNDESLIGA: await oldb("bl1") },
    fpl: { EPL: fpl },
    uefa: { UCL: await uefa(1) },
  };
}

async function main() {
  const out: Record<string, { fd: string[]; espn: { id: string; name: string }[] }> = {};
  for (const league of DOMESTIC_LEAGUES) {
    const info = LEAGUE_INFO[league];
    const [fd, espn] = await Promise.all([fdNames(info.fd!), espnNames(info.espn)]);
    out[league] = { fd, espn };
    console.log(league.padEnd(16), `fd=${fd.length}`, `espn=${espn.length}`);
  }
  writeFileSync("tests/fixtures/team-names.json", JSON.stringify(out, null, 1));
  const other = await otherSources();
  writeFileSync("tests/fixtures/team-names-other.json", JSON.stringify(other, null, 1));
  console.log("other:", Object.entries(other).map(([k, v]) => `${k} ${Object.values(v).flat().length}`).join(", "));
}

main();
