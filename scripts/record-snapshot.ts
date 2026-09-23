/**
 * Records a real, dated snapshot of source data for the offline tests (no hand-made data).
 *   npx tsx scripts/record-snapshot.ts
 * Writes tests/fixtures/snapshot/{E0,E1}.csv (football-data.co.uk) and {eng.1,eng.2}-standings.json (ESPN).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { seasonCode } from "../lib/leagues";

const OUT = "tests/fixtures/snapshot";
const UA = { "user-agent": "SlipCheck/0.2 (test snapshot)" };

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const [div, slug] of [["E0", "eng.1"], ["E1", "eng.2"]]) {
    const csv = await (await fetch(`https://www.football-data.co.uk/mmz4281/${seasonCode()}/${div}.csv`, { headers: UA })).text();
    writeFileSync(`${OUT}/${div}.csv`, csv);
    const standings = await (await fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`)).json();
    writeFileSync(`${OUT}/${slug}-standings.json`, JSON.stringify(standings));
  }
  writeFileSync(`${OUT}/RECORDED_AT`, new Date().toISOString() + "\n");
  console.log("snapshot written to", OUT);
}

main();
