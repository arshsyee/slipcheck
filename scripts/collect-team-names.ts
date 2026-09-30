/**
 * Records every club name per division from football-data.co.uk into tests/fixtures/team-names.json, so team
 * matching is tested against real names offline. The ESPN names alongside were recorded on 2026-09-23 (ESPN now
 * blocks us) and are kept as recorded: they're the everyday spellings people type on slips.
 *   npx tsx scripts/collect-team-names.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
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
  type Names = Record<string, { fd: string[]; espn: { id: string; name: string }[] }>;
  const recorded: Names = JSON.parse(readFileSync("tests/fixtures/team-names.json", "utf8"));
  const out: Names = {};
  for (const league of DOMESTIC_LEAGUES) {
    const fd = await fdNames(LEAGUE_INFO[league].fd!);
    out[league] = { fd, espn: recorded[league]?.espn ?? [] };
    console.log(league.padEnd(16), `fd=${fd.length}`);
  }
  writeFileSync("tests/fixtures/team-names.json", JSON.stringify(out, null, 1));
  const other = await otherSources();
  writeFileSync("tests/fixtures/team-names-other.json", JSON.stringify(other, null, 1));
  console.log("other:", Object.entries(other).map(([k, v]) => `${k} ${Object.values(v).flat().length}`).join(", "));
}

main();
