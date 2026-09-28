# What the average football bettor needs, and what SlipCheck should add

*Written 2026-09-28. SlipCheck is the canvas, not the painter: it gathers facts and the bettor (or their own AI) decides. Nothing below adds tips or predictions.*

## Who we're building for

The average football bettor is not a professional trader. They:
- **bet on matches they already follow**, often as accumulators (several matches on one slip), usually on the weekend;
- **bet the popular markets**: match result, both teams to score, over/under goals, and increasingly **corners, cards** and **anytime goalscorer** (bet builders);
- **decide in the last hours before kick-off**, on a phone, often from memory and gut feel;
- **lose most often to a few avoidable things**: missing late team news, backing a team that is about to rotate, not knowing what the odds actually imply, and overrating one recent result.

## What they need, and where SlipCheck stands

| Need | Why it matters | SlipCheck today |
|---|---|---|
| **Who's playing**: injuries, suspensions, likely XI | The single biggest swing factor, and the one people check too late | ✅ Premier League official list + likely XI; elsewhere squads + injury headlines; national withdrawals |
| **Form in context**: home/away, league vs cups vs Europe | One result against a strong team misleads | ✅ Grouped by League / Europe / Cups, home and away named |
| **Rest and fixture congestion** | Tired or rotated teams underperform | ◑ Rest days before the match. **Missing: what comes next** (a Champions League game 3 days later means rotation risk) |
| **What the odds imply** | Most bettors can't turn 6/4 into a probability, so they can't compare it with anything | ❌ **Missing.** The slip's odds are read but not explained |
| **Accumulator reality** | Six "safe" 80% picks together win only about 26% of the time | ❌ **Missing** |
| **Stakes in the table**: title race, top four, relegation | Motivation shows up in results late in the season | ◑ The table position is shown. **Missing: the gap to the places that matter** |
| **Corners and cards markets** | Common in bet builders; the data already exists (football-data.co.uk) | ❌ **Missing as markets** (the report falls back to "Something else") |
| **Anytime goalscorer** | The most popular player bet | ◑ Premier League xG, penalty takers and "players to watch". Other leagues: no free player data |
| **Best price across bookmakers** | Same bet, different payout | ⏳ Phase 2 (odds comparison), already planned |
| **Referee tendencies** (cards) | Matters for card bets | ◑ England only (the only league where the free data names referees) |

## What to add next, in order

Each is small, uses data we already fetch, and stays factual:

1. **What your odds imply.** Next to each pick, show the probability the odds imply ("6/4 implies 40%"), the same count we already show (e.g. both teams scored in 3 of 5), and for accumulators the combined probability. No verdict: the bettor compares.
2. **Corners and cards as markets.** Add "corners" and "cards" bet types with the matching comparison table (per game, home/away, over the line), from the same results files.
3. **What's at stake in the table.** Points gap to first, to the Champions League places and to relegation. Plain counts ("3 points behind 4th with 33 games left").
4. **What comes next.** Each team's next match after this one, and in which competition ("Champions League away in 3 days"), so rotation risk is visible.

Deliberately not added:
- **Model predictions or "value" labels.** That's painting; the user's own AI can do that on top.
- **Stake or bankroll advice.** Removed by design; the slip no longer carries stakes.
