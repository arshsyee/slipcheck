export const SLIP_PROMPT = `You are reading a screenshot of a sports betting slip from a US sportsbook.
Extract every leg exactly as shown. Rules:
- Use full official team names (e.g. "Kansas City Chiefs", not "KC").
- If only one team is visible for a leg, put it in the field that fits best and leave the other null.
- market: "moneyline" for straight win bets, "spread" for point/run/puck lines, "total" for over/under game totals, "player_prop" for any player stat bet, "other" for anything else (futures, team props, etc.).
- selection: the team picked for moneyline/spread, "Over" or "Under" for totals, or the prop text for player props.
- line: the spread or total number with its sign (e.g. -3.5, 47.5). null for moneylines.
- oddsAmerican: that leg's American odds as printed. Convert decimal odds to American if needed.
- betType is "parlay" if there is more than one leg combined into one wager, else "single".
- stake, totalOddsAmerican and potentialPayout come from the slip's summary; null if not shown.
If the image is not a betting slip, return an empty legs array.`;
