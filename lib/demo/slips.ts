import type { Slip } from "../types";

export interface SampleSlip {
  id: string;
  title: string;
  blurb: string;
  slip: Slip;
}

/** Made-up slips that exercise the main comparison scenarios against the demo odds feed. */
export const SAMPLE_SLIPS: SampleSlip[] = [
  {
    id: "single-ml",
    title: "Chiefs moneyline",
    blurb: "$50 single at DraftKings. Another book pays more.",
    slip: {
      sportsbook: "DraftKings",
      stake: 50,
      betType: "single",
      totalOddsAmerican: -135,
      potentialPayout: 87.04,
      legs: [
        { sport: "NFL", awayTeam: "Buffalo Bills", homeTeam: "Kansas City Chiefs", market: "moneyline", selection: "Kansas City Chiefs", line: null, oddsAmerican: -135 },
      ],
    },
  },
  {
    id: "nfl-3leg",
    title: "NFL 3-leg parlay",
    blurb: "$20 at FanDuel: spread + total + moneyline. Some books have different lines.",
    slip: {
      sportsbook: "FanDuel",
      stake: 20,
      betType: "parlay",
      totalOddsAmerican: null,
      potentialPayout: null,
      legs: [
        { sport: "NFL", awayTeam: "Buffalo Bills", homeTeam: "Kansas City Chiefs", market: "spread", selection: "Buffalo Bills", line: 2.5, oddsAmerican: -110 },
        { sport: "NFL", awayTeam: "Dallas Cowboys", homeTeam: "Philadelphia Eagles", market: "total", selection: "Over", line: 45.5, oddsAmerican: -110 },
        { sport: "NFL", awayTeam: "Detroit Lions", homeTeam: "Green Bay Packers", market: "moneyline", selection: "Detroit Lions", line: null, oddsAmerican: 122 },
      ],
    },
  },
  {
    id: "mlb-2leg",
    title: "MLB run line + under",
    blurb: "$25 at BetMGM. Hard Rock doesn't list these games.",
    slip: {
      sportsbook: "BetMGM",
      stake: 25,
      betType: "parlay",
      totalOddsAmerican: 340,
      potentialPayout: 110,
      legs: [
        { sport: "MLB", awayTeam: "New York Yankees", homeTeam: "Boston Red Sox", market: "spread", selection: "New York Yankees", line: -1.5, oddsAmerican: 140 },
        { sport: "MLB", awayTeam: "Los Angeles Dodgers", homeTeam: "San Diego Padres", market: "total", selection: "Under", line: 8.5, oddsAmerican: -120 },
      ],
    },
  },
  {
    id: "already-best",
    title: "Eagles -6.5",
    blurb: "$100 at Caesars. Your book is already tied for the best price.",
    slip: {
      sportsbook: "Caesars",
      stake: 100,
      betType: "single",
      totalOddsAmerican: -105,
      potentialPayout: 195.24,
      legs: [
        { sport: "NFL", awayTeam: "Dallas Cowboys", homeTeam: "Philadelphia Eagles", market: "spread", selection: "Philadelphia Eagles", line: -6.5, oddsAmerican: -105 },
      ],
    },
  },
  {
    id: "messy",
    title: "Messy parlay",
    blurb: "$10 at DraftKings with a player prop and a game that isn't listed.",
    slip: {
      sportsbook: "DraftKings",
      stake: 10,
      betType: "parlay",
      totalOddsAmerican: 1421,
      potentialPayout: 152.15,
      legs: [
        { sport: "NCAAF", awayTeam: "Georgia Bulldogs", homeTeam: "Alabama Crimson Tide", market: "moneyline", selection: "Georgia Bulldogs", line: null, oddsAmerican: 145 },
        { sport: "NFL", awayTeam: "Buffalo Bills", homeTeam: "Kansas City Chiefs", market: "player_prop", selection: "Patrick Mahomes Over 2.5 Passing TDs", line: 2.5, oddsAmerican: 130 },
        { sport: "NFL", awayTeam: "Seattle Seahawks", homeTeam: "San Francisco 49ers", market: "moneyline", selection: "Seattle Seahawks", line: null, oddsAmerican: 170 },
      ],
    },
  },
];
