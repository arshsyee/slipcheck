# SlipCheck: for AI agents

SlipCheck gathers free, public football facts for the matches on a bet slip. It never predicts. The analysis is yours, and must be clearly yours.

## Using it

1. **Read the slip photo yourself.** For each match, note the teams (home first), the market, the pick, the line and the odds. Ask if anything is unreadable.
2. **Get the facts:**
   ```bash
   npm run research -- "Arsenal v Leeds" --odds 4/6 "Inter v Parma" --league SERIE_A --market btts --pick Yes
   ```
   The options after a match apply to that match:
   - `--league` `EPL|LA_LIGA|SERIE_A|BUNDESLIGA|LIGUE_1|UCL`; leave it out for national teams
   - `--market` `1x2|double_chance|draw_no_bet|total_goals|asian_handicap|btts|total_corners|total_cards`
   - `--pick`, `--line`, `--odds` (6/4, 2.5, evens)
3. **Read the text output, about 2,000 tokens per match.** Use `--json` (about 22,000 tokens per match) only if you need raw per-game data. Gathering the data uses no AI tokens.

## Rules when passing facts on

- **"N/A · no free source" means there's no data.** Say so; never estimate in its place.
- **Keep the report's facts and your opinion apart.**
- **Use counts, not percentages,** and name whose home or away games they are.
- **Likely XI is recent starts, not an official lineup.** Injury news outside the Premier League is headlines, not an official list.
- **Odds are only the user's own.** "Implies X%" includes the bookmaker's margin, and for an accumulator every pick has to win.
- **Pass on data dates:** "results up to…", "saved copy from…".
- **Information only, 18+.** Where it's needed, point to BeGambleAware.org or 0808 8020 133.

## Working on it

- **Use `/ponytail`:** the simplest change that works.
- **All checks must pass:** `npm test && npm run lint && npx tsc --noEmit`.
- **Free, no-key sources only.** Never get around a block, e.g. by rotating IPs or disguising the User-Agent.
- **Never guess:** missing data shows as red N/A, and a missed flag beats a false one.
- **Keep output deterministic:** the same command twice gives the same output.
- **Tests use real recorded data only.**
- **Git:** follow the workflow in CLAUDE.md (short-lived branches, tests are the gate, PRs only when review matters).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
