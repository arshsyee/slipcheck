import { LEAGUE_INFO } from "../leagues";

const leagueList = Object.entries(LEAGUE_INFO)
  .map(([id, l]) => `${id} = ${l.label} (${l.country})`)
  .join("; ");

export const SLIP_PROMPT = `You are reading a screenshot of a football (soccer) bet slip from a UK or European bookmaker
(e.g. Bet365, Sky Bet, Paddy Power, William Hill, Betfair, Unibet, Betway, Ladbrokes, Coral, Betano).
Extract every selection exactly as shown. Rules:
- homeTeam / awayTeam: full club names. Slips usually show "Home v Away" or "Home vs Away"; the first team is home.
  Expand abbreviations when you are sure (e.g. "Man Utd" → "Manchester United"). Leave a team null if it isn't shown.
- league: pick from this list, or OTHER if the competition isn't listed or can't be told from the slip:
  ${leagueList}.
- market:
  "1x2" = Match Result / Full Time Result / Match Betting / Win-Draw-Win;
  "double_chance"; "draw_no_bet";
  "total_goals" = Over/Under or Total Goals;
  "asian_handicap" = Asian Handicap or Handicap with a goal line;
  "btts" = Both Teams To Score;
  "total_corners" = Over/Under total match corners; "total_cards" = Over/Under total match cards (yellow and red);
  "other" = anything else (goalscorers, cards, corners, player props, bet builders, correct score, specials).
- selection: the team for 1x2 / draw_no_bet / asian_handicap (or "Draw"); "Home or Draw"-style picks as "<team> or Draw" /
  "<team> or <team>" for double chance; "Over"/"Under" for totals; "Yes"/"No" for BTTS; otherwise the text as shown.
- line: the goal line for totals (2.5) or the handicap on the picked team (-0.75, +1). Null otherwise.
- oddsDecimal: that selection's odds as DECIMAL. Convert fractional (6/4 → 2.5, 11/10 → 2.1, Evens → 2.0).
If the image is not a football bet slip, return an empty legs array.`;
