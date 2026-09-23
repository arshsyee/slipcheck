# SlipCheck

The canvas, not the painter: SlipCheck gathers **free, public football data** for every match on your bet slip and puts it in one place. It makes no predictions and gives no tips. Bring your own AI (Claude or ChatGPT key) to read slips and analyse the data.

For every match you get:
- a comparison table for your bet type
- form and the league table
- xG
- head-to-head
- the coach
- squad by position, with a likely XI and backups
- who's out and players to watch
- the referee
- kick-off weather
- team news

**Honest by design:**
- Anything no free source has is shown in red as **N/A · no free source**. Nothing is guessed or estimated.
- Every number is a plain count ("3 of 5"), and every section says which source it came from.
- If a source is down, you see its last saved copy with its age, not a gap.

## Covered

- **Clubs:** Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League.
- **National teams:** Nations League, qualifiers and friendlies.

## Quick start

You need [Node.js 20+](https://nodejs.org).

```bash
git clone https://github.com/arshsyee/slipcheck.git
cd slipcheck
npm install
```

Research matches in the terminal (no key needed):

```bash
npm run research -- "Arsenal v Leeds" "Inter v Parma" --league SERIE_A --market btts --pick Yes
```

Options per match: `--league EPL|LA_LIGA|SERIE_A|BUNDESLIGA|LIGUE_1|UCL`, `--market 1x2|double_chance|draw_no_bet|total_goals|asian_handicap|btts`, `--pick`, `--line`. Add `--json` for the full data.

Or use the web app: `npm run dev`, then open http://localhost:3000. Sample slips come from real upcoming fixtures. To read slip screenshots, add a Claude or ChatGPT key in Settings or in `.env.local` (see `.env.example`).

## What's in a report

| Section | Contents |
| --- | --- |
| 1. Your pick | A comparison table for the bet type, grouped by "home team at home · away team away" and "all games", plus facts that don't fit a table: head-to-head, a coach change, missing players, short rest |
| Match | Kick-off, venue, referee, weather |
| Season / Standing | Table, home and away record, xG and finishing, position game by game, same point last season. National teams: FIFA and Elo ranking |
| Form | Last 5, last 5 at home (named team) and away (named team), rest days, last game |
| Coach | Current coach, their record since arriving, the record before them if they arrived mid-season |
| Availability | Premier League: the official list with % chance of playing. Elsewhere: injury headlines, labelled as news |
| Matchup | Every head-to-head meeting counted, with the winner (and the competition for national teams) |
| Lineup & squad | Premier League: likely XI (most starts in the last 5 games, injured left out; not an official lineup), next in line per position, who's out, penalty and free-kick takers. Other clubs: squad by position. National teams: this window's squad with caps, and injured withdrawals by name. Players named in injury headlines are flagged, with the headline |

## Data sources

All free, no key:

| Source | Used for |
| --- | --- |
| [football-data.co.uk](https://www.football-data.co.uk) | Club results, xG, shots, cards, referees, fixtures |
| [International results](https://github.com/martj42/international_results) (CC0) | National-team results since 1872 |
| [Fantasy Premier League](https://fantasy.premierleague.com) | Premier League injuries, recent starts, set-piece takers, xG/xA |
| [Premier League](https://www.premierleague.com) · [UEFA](https://www.uefa.com) | Fixtures, referees, lineups, European results, Nations League |
| [Wikipedia](https://en.wikipedia.org) · [Wikidata](https://www.wikidata.org) | Coaches, squads, national-team rankings and withdrawals, stadium locations |
| [TheSportsDB](https://www.thesportsdb.com) | Badges, next fixture when other lists don't have it yet |
| [OpenLigaDB](https://www.openligadb.de) | Bundesliga goal times |
| [Open-Meteo](https://open-meteo.com) | Kick-off weather |
| [Google News](https://news.google.com) · [BBC Sport](https://www.bbc.co.uk/sport/football) | Team and injury news |
| [ESPN](https://www.espn.com/soccer) (optional) | Domestic cup results only; everything else works without it |

Every response is checked against a schema, so a changed feed shows up as a clear error rather than wrong numbers. Every source is saved on disk (`.cache/`); if one goes down, the last good copy (up to 14 days old) is used and labelled with its age.

```bash
npm run check-sources   # asks every source live, then shows each data item and where it came from
```

## Development

```bash
npm test          # offline, on real recorded data (tests/fixtures/snapshot)
npm run lint
npx tsc --noEmit
npm run verify -- accuracy|goals|referees|xg|coverage   # cross-check sources against each other (live)
```

Code map:
- `lib/sources/*`: one module per data source.
- `lib/teams/*`: matching team names across sources.
- `lib/stats/*`: form, rates, head-to-head, season, lineup, the pick table.
- `lib/dossier/build.ts` (clubs) and `lib/dossier/national.ts` (national teams): join everything per match.
- `scripts/research.ts`: the terminal report.
- `components/dossier/*`: the web UI.

## Roadmap

- **Phase 2:** compare your slip's odds across bookmakers.
- **Phase 3:** optional free-key sources, such as official injury lists for every league and predicted lineups.
- **Phase 4:** an MCP server or plugin, so your own AI can read SlipCheck directly.
- **Phase 5:** saved slips and history.

---

Information only, not betting advice. 18+. Need help? [BeGambleAware.org](https://www.begambleaware.org) · National Gambling Helpline 0808 8020 133.
