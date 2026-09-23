import type { OddsBookmaker, OddsEvent } from "../odds/client";

/**
 * Made-up but realistic odds for demo mode and tests. Nothing here is live.
 * Each book row: [awayML, homeML, homeSpread, awaySpreadPrice, homeSpreadPrice, total, overPrice, underPrice]
 */
type Row = [number, number, number, number, number, number, number, number];

export const DEMO_BOOKS: Record<string, string> = {
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  williamhill_us: "Caesars",
  espnbet: "ESPN BET",
  fanatics: "Fanatics",
  betrivers: "BetRivers",
  hardrockbet: "Hard Rock Bet",
};

interface Game {
  id: string;
  sport: "NFL" | "MLB" | "NCAAF";
  sportKey: string;
  away: string;
  home: string;
  /** Days from "now" and local hour the game starts. */
  inDays: number;
  hour: number;
  books: Partial<Record<keyof typeof DEMO_BOOKS, Row>>;
}

const GAMES: Game[] = [
  {
    id: "demo-nfl-buf-kc",
    sport: "NFL",
    sportKey: "americanfootball_nfl",
    away: "Buffalo Bills",
    home: "Kansas City Chiefs",
    inDays: 5,
    hour: 16,
    books: {
      draftkings: [115, -135, -2.5, -110, -110, 47.5, -110, -110],
      fanduel: [110, -130, -2.5, -110, -110, 47.5, -108, -112],
      betmgm: [120, -140, -3, -105, -115, 47.5, -110, -110],
      williamhill_us: [115, -135, -3, -105, -115, 48, -110, -110],
      espnbet: [105, -125, -2.5, -115, -105, 47.5, -105, -115],
      fanatics: [110, -130, -2.5, -108, -112, 47.5, -110, -110],
      betrivers: [118, -138, -2.5, -112, -108, 47.5, -112, -108],
      hardrockbet: [108, -128, -2.5, -105, -115, 47.5, -110, -110],
    },
  },
  {
    id: "demo-nfl-dal-phi",
    sport: "NFL",
    sportKey: "americanfootball_nfl",
    away: "Dallas Cowboys",
    home: "Philadelphia Eagles",
    inDays: 5,
    hour: 20,
    books: {
      draftkings: [230, -280, -6.5, -110, -110, 45.5, -110, -110],
      fanduel: [225, -275, -6.5, -112, -108, 45.5, -110, -110],
      betmgm: [240, -300, -6.5, -115, -105, 46, -110, -110],
      williamhill_us: [235, -290, -6.5, -115, -105, 45.5, -105, -115],
      espnbet: [230, -285, -7, -120, 100, 45.5, -112, -108],
      fanatics: [220, -270, -6.5, -110, -110, 45.5, -108, -112],
      betrivers: [235, -290, -6.5, -108, -112, 45.5, -115, -105],
      hardrockbet: [225, -275, -6.5, -110, -110, 45.5, -110, -110],
    },
  },
  {
    id: "demo-nfl-det-gb",
    sport: "NFL",
    sportKey: "americanfootball_nfl",
    away: "Detroit Lions",
    home: "Green Bay Packers",
    inDays: 5,
    hour: 13,
    books: {
      draftkings: [120, -142, -2.5, -108, -112, 50.5, -110, -110],
      fanduel: [122, -144, -2.5, -110, -110, 50.5, -110, -110],
      betmgm: [115, -135, -3, -110, -110, 50.5, -105, -115],
      williamhill_us: [125, -150, -2.5, -110, -110, 50.5, -110, -110],
      espnbet: [118, -140, -2.5, -110, -110, 51, -110, -110],
      fanatics: [130, -155, -2.5, -105, -115, 50.5, -110, -110],
      betrivers: [120, -145, -2.5, -110, -110, 50.5, -110, -110],
    },
  },
  {
    id: "demo-mlb-nyy-bos",
    sport: "MLB",
    sportKey: "baseball_mlb",
    away: "New York Yankees",
    home: "Boston Red Sox",
    inDays: 1,
    hour: 19,
    books: {
      draftkings: [-120, 102, 1.5, 145, -175, 8.5, -110, -110],
      fanduel: [-118, 100, 1.5, 150, -180, 8.5, -105, -115],
      betmgm: [-125, 105, 1.5, 140, -160, 8.5, -110, -110],
      williamhill_us: [-120, 100, 1.5, 145, -170, 9, -110, -110],
      espnbet: [-122, 104, 1.5, 142, -165, 8.5, -108, -112],
      fanatics: [-115, -105, 1.5, 150, -178, 8.5, -110, -110],
      betrivers: [-120, 100, 1.5, 145, -155, 8.5, -115, -105],
    },
  },
  {
    id: "demo-mlb-lad-sd",
    sport: "MLB",
    sportKey: "baseball_mlb",
    away: "Los Angeles Dodgers",
    home: "San Diego Padres",
    inDays: 1,
    hour: 22,
    books: {
      draftkings: [-135, 115, 1.5, 130, -155, 8.5, -105, -115],
      fanduel: [-132, 112, 1.5, 128, -152, 8.5, -110, -110],
      betmgm: [-140, 118, 1.5, 125, -150, 8.5, 100, -120],
      williamhill_us: [-135, 115, 1.5, 130, -155, 8, -110, -110],
      espnbet: [-130, 110, 1.5, 132, -158, 8.5, -108, -112],
      fanatics: [-138, 116, 1.5, 128, -150, 8.5, -112, -108],
      betrivers: [-135, 114, 1.5, 130, -155, 8.5, -105, -115],
    },
  },
  {
    id: "demo-ncaaf-uga-bama",
    sport: "NCAAF",
    sportKey: "americanfootball_ncaaf",
    away: "Georgia Bulldogs",
    home: "Alabama Crimson Tide",
    inDays: 4,
    hour: 19,
    books: {
      draftkings: [145, -175, -3.5, -110, -110, 52.5, -110, -110],
      fanduel: [150, -180, -3.5, -108, -112, 52.5, -110, -110],
      betmgm: [140, -165, -3.5, -110, -110, 52.5, -110, -110],
      williamhill_us: [155, -185, -4, -110, -110, 52.5, -110, -110],
      espnbet: [148, -178, -3.5, -112, -108, 53, -110, -110],
      fanatics: [145, -175, -3.5, -110, -110, 52.5, -105, -115],
    },
  },
];

function toBookmaker(key: string, [aML, hML, hSp, aSpP, hSpP, tot, oP, uP]: Row, g: Game, at: string): OddsBookmaker {
  return {
    key,
    title: DEMO_BOOKS[key],
    last_update: at,
    markets: [
      { key: "h2h", outcomes: [{ name: g.away, price: aML }, { name: g.home, price: hML }] },
      {
        key: "spreads",
        outcomes: [
          { name: g.away, price: aSpP, point: -hSp },
          { name: g.home, price: hSpP, point: hSp },
        ],
      },
      {
        key: "totals",
        outcomes: [
          { name: "Over", price: oP, point: tot },
          { name: "Under", price: uP, point: tot },
        ],
      },
    ],
  };
}

/** Demo feed grouped by our sport labels (same shape the compare route builds from the live API). */
export function demoEventsBySport(now = new Date()): Record<string, OddsEvent[]> {
  const out: Record<string, OddsEvent[]> = {};
  const updated = new Date(now.getTime() - 2 * 60_000).toISOString();
  for (const g of GAMES) {
    const start = new Date(now);
    start.setDate(start.getDate() + g.inDays);
    start.setHours(g.hour, 0, 0, 0);
    (out[g.sport] ??= []).push({
      id: g.id,
      sport_key: g.sportKey,
      commence_time: start.toISOString(),
      home_team: g.home,
      away_team: g.away,
      bookmakers: Object.entries(g.books).map(([k, row]) => toBookmaker(k, row as Row, g, updated)),
    });
  }
  return out;
}
