/**
 * Records a real, dated snapshot of source data for the offline tests (no hand-made data).
 *   npx tsx scripts/record-snapshot.ts
 * Writes tests/fixtures/snapshot/{E0,E1}.csv (football-data.co.uk). The {eng.1,eng.2}-standings.json files next to
 * them were recorded from ESPN on 2026-09-23; ESPN now blocks us, so they stay as recorded.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { seasonCode } from "../lib/leagues";

const OUT = "tests/fixtures/snapshot";
const UA = { "user-agent": "SlipCheck/0.2 (test snapshot)" };

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const div of ["E0", "E1"]) {
    const csv = await (await fetch(`https://www.football-data.co.uk/mmz4281/${seasonCode()}/${div}.csv`, { headers: UA })).text();
    writeFileSync(`${OUT}/${div}.csv`, csv);
  }
  writeFileSync(`${OUT}/RECORDED_AT`, new Date().toISOString() + "\n");
  console.log("snapshot written to", OUT);
}

main();
