import type { OddsFormat } from "../types";

export function americanToDecimal(american: number): number {
  if (american === 0) throw new Error("American odds cannot be 0");
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}

export function decimalToAmerican(decimal: number): number {
  if (decimal <= 1) throw new Error("Decimal odds must be > 1");
  return decimal >= 2 ? Math.round((decimal - 1) * 100) : Math.round(-100 / (decimal - 1));
}

export function fractionalToDecimal(num: number, den: number): number {
  return 1 + num / den;
}

// Fractions bookmakers actually quote; anything else falls back to the nearest simple fraction.
const LADDER: [number, number][] = [
  [1, 10], [1, 8], [1, 7], [1, 6], [1, 5], [2, 9], [1, 4], [2, 7], [3, 10], [1, 3], [4, 11], [2, 5], [4, 9], [1, 2],
  [8, 15], [4, 7], [8, 13], [4, 6], [8, 11], [4, 5], [5, 6], [10, 11], [1, 1], [21, 20], [11, 10], [6, 5], [5, 4],
  [11, 8], [7, 5], [6, 4], [8, 5], [13, 8], [7, 4], [9, 5], [15, 8], [2, 1], [85, 40], [11, 5], [9, 4], [12, 5],
  [5, 2], [11, 4], [3, 1], [10, 3], [7, 2], [4, 1], [9, 2], [5, 1], [11, 2], [6, 1], [13, 2], [7, 1], [15, 2],
  [8, 1], [17, 2], [9, 1], [10, 1], [11, 1], [12, 1], [14, 1], [16, 1], [18, 1], [20, 1], [25, 1], [33, 1],
  [40, 1], [50, 1], [66, 1], [80, 1], [100, 1],
];

export function decimalToFractional(decimal: number): string {
  const target = decimal - 1;
  for (const [n, d] of LADDER) if (Math.abs(n / d - target) < 0.005) return `${n}/${d}`;
  // Off-ladder price (e.g. an acca): simplest fraction within 1%.
  for (let d = 1; d <= 100; d++) {
    const n = Math.round(target * d);
    if (n > 0 && Math.abs(n / d - target) / target < 0.01) return `${n}/${d}`;
  }
  return `${Math.round(target * 100)}/100`;
}

/** Accepts "2.5", "6/4", "+150", "-200" and returns decimal odds, or null if unparseable. */
export function parseOdds(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  const frac = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) return Number(frac[2]) > 0 ? round(fractionalToDecimal(Number(frac[1]), Number(frac[2])), 4) : null;
  if (/^evens?$/i.test(s)) return 2;
  if (/^[+-]\d{3,}$/.test(s)) return round(americanToDecimal(Number(s)), 4);
  const n = Number(s);
  return Number.isFinite(n) && n > 1 ? n : null;
}

export function formatOdds(decimal: number | null | undefined, format: OddsFormat = "decimal"): string {
  if (decimal == null) return "—";
  if (format === "fractional") return decimal === 2 ? "Evens" : decimalToFractional(decimal);
  if (format === "american") {
    const a = decimalToAmerican(decimal);
    return a > 0 ? `+${a}` : `${a}`;
  }
  return decimal.toFixed(2);
}

export function accaDecimal(legs: number[]): number {
  return legs.reduce((acc, d) => acc * d, 1);
}

export function impliedProbability(decimal: number): number {
  return 1 / decimal;
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
