/**
 * Renders the sample slips as phone-style screenshots in tests/fixtures/slips/.
 * Use them to test the AI slip reader end to end:  npm run fixtures
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SAMPLE_SLIPS } from "../lib/demo/slips";
import { americanToDecimal, decimalToAmerican, formatAmerican } from "../lib/odds/convert";
import type { Leg, Slip } from "../lib/types";

const OUT = join(process.cwd(), "tests/fixtures/slips");
const W = 390;
const THEMES: Record<string, { bg: string; card: string; accent: string; text: string; muted: string }> = {
  DraftKings: { bg: "#0b0b0b", card: "#1c1c1c", accent: "#53d337", text: "#ffffff", muted: "#9a9a9a" },
  FanDuel: { bg: "#f2f5f8", card: "#ffffff", accent: "#1493ff", text: "#0a1f33", muted: "#6b7c8f" },
  BetMGM: { bg: "#111111", card: "#1e1e1e", accent: "#c8a55a", text: "#f5f5f5", muted: "#a0a0a0" },
  Caesars: { bg: "#0d2a24", card: "#123a32", accent: "#d4b46a", text: "#ffffff", muted: "#9bb5ad" },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (n: number) => `$${n.toFixed(2)}`;

function legLabel(l: Leg) {
  if (l.market === "moneyline") return { pick: l.selection, sub: "Moneyline" };
  if (l.market === "spread") return { pick: `${l.selection} ${l.line! > 0 ? "+" : ""}${l.line}`, sub: "Spread" };
  if (l.market === "total") return { pick: `${l.selection} ${l.line}`, sub: "Total Points" };
  return wrap(l.selection, "Player Prop");
}

/** Long picks (props) overflow into the subtitle line so they don't collide with the odds. */
function wrap(pick: string, sub: string, max = 24) {
  if (pick.length <= max) return { pick, sub };
  const words = pick.split(" ");
  let first = "";
  while (words.length && (first + " " + words[0]).trim().length <= max) first = (first + " " + words.shift()).trim();
  return { pick: first, sub: `${words.join(" ")} · ${sub}` };
}

function render(slip: Slip) {
  const t = THEMES[slip.sportsbook ?? ""] ?? THEMES.DraftKings;
  const legH = 92;
  const top = 120;
  const H = top + slip.legs.length * legH + 170;
  const dec = slip.totalOddsAmerican
    ? americanToDecimal(slip.totalOddsAmerican)
    : slip.legs.reduce((a, l) => a * americanToDecimal(l.oddsAmerican!), 1);
  const stake = slip.stake ?? 10;

  const legs = slip.legs
    .map((l, i) => {
      const y = top + i * legH;
      const { pick, sub } = legLabel(l);
      return `
      <rect x="16" y="${y}" width="${W - 32}" height="${legH - 10}" rx="12" fill="${t.card}"/>
      <circle cx="36" cy="${y + 26}" r="6" fill="none" stroke="${t.accent}" stroke-width="2"/>
      <text x="52" y="${y + 31}" font-size="16" font-weight="700" fill="${t.text}">${esc(pick)}</text>
      <text x="${W - 30}" y="${y + 31}" font-size="16" font-weight="700" fill="${t.text}" text-anchor="end">${formatAmerican(l.oddsAmerican)}</text>
      <text x="52" y="${y + 52}" font-size="13" fill="${t.muted}">${sub}</text>
      <text x="52" y="${y + 71}" font-size="12" fill="${t.muted}">${esc(`${l.awayTeam ?? ""} @ ${l.homeTeam ?? ""}`)}</text>`;
    })
    .join("");

  const fy = top + slip.legs.length * legH + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif">
    <rect width="100%" height="100%" fill="${t.bg}"/>
    <text x="20" y="44" font-size="22" font-weight="800" fill="${t.accent}">${esc(slip.sportsbook ?? "Sportsbook")}</text>
    <text x="20" y="84" font-size="18" font-weight="700" fill="${t.text}">Bet Slip</text>
    <text x="${W - 20}" y="84" font-size="14" fill="${t.muted}" text-anchor="end">${slip.legs.length > 1 ? `${slip.legs.length} Leg Parlay` : "Single"}</text>
    ${legs}
    <line x1="16" x2="${W - 16}" y1="${fy}" y2="${fy}" stroke="${t.muted}" stroke-opacity="0.3"/>
    <text x="20" y="${fy + 34}" font-size="14" fill="${t.muted}">Odds</text>
    <text x="${W - 20}" y="${fy + 34}" font-size="15" font-weight="700" fill="${t.text}" text-anchor="end">${formatAmerican(slip.totalOddsAmerican ?? decimalToAmerican(dec))}</text>
    <text x="20" y="${fy + 62}" font-size="14" fill="${t.muted}">Wager</text>
    <text x="${W - 20}" y="${fy + 62}" font-size="15" font-weight="700" fill="${t.text}" text-anchor="end">${money(stake)}</text>
    <rect x="16" y="${fy + 84}" width="${W - 32}" height="52" rx="26" fill="${t.accent}"/>
    <text x="${W / 2}" y="${fy + 116}" font-size="16" font-weight="800" fill="${t.bg}" text-anchor="middle">Place Bet · To Pay ${money(stake * dec)}</text>
  </svg>`;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const manifest: Record<string, Slip> = {};
  for (const s of SAMPLE_SLIPS) {
    const file = `${s.id}.png`;
    await sharp(Buffer.from(render(s.slip)), { density: 144 }).png().toFile(join(OUT, file));
    manifest[file] = s.slip;
    console.log("wrote", join("tests/fixtures/slips", file));
  }
  // Expected parse results, for checking what the AI reads from each image.
  writeFileSync(join(OUT, "expected.json"), JSON.stringify(manifest, null, 2));
}

main();
