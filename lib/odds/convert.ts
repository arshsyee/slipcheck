/** Accepts "2.5x", "2.5", "6/4" or "evens" (slips print any of these) and returns the multiplier, or null if unparseable. */
export function parseOdds(input: string): number | null {
  const s = input.trim().replace(/x$/i, "").trim();
  if (!s) return null;
  const frac = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) return Number(frac[2]) > 0 ? round(1 + Number(frac[1]) / Number(frac[2]), 4) : null;
  if (/^evens?$/i.test(s)) return 2;
  const n = Number(s);
  return Number.isFinite(n) && n > 1 ? n : null;
}

/** Odds as a payout multiplier, like Kalshi: 2.5 → "2.5x" (a 10 stake returns 25). */
export function formatOdds(decimal: number | null | undefined): string {
  return decimal == null ? "—" : `${round(decimal, 2)}x`;
}

export function accaDecimal(legs: number[]): number {
  return legs.reduce((acc, d) => acc * d, 1);
}

export function impliedProbability(decimal: number): number {
  return 1 / decimal;
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
