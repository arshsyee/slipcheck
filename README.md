# SlipCheck

Upload a screenshot of your **football bet slip** and get a match file for every selection, built from free public data:
- form and xG
- goal, BTTS and over/under rates
- head-to-head
- the referee's record
- league table and rest days
- injuries and team news
- lineups
- kick-off weather

The stats that matter for your particular pick are shown first.

- 🧾 **Reads your slip with AI** (Claude or ChatGPT, your own key). Understands fractional odds and bookmaker abbreviations. Or type the bet in by hand.
- ⚽ **22 European divisions + Champions League, Europa League and Conference League**
- 🆓 **Every data source is free and needs no key**
- 🔒 **Runs on your computer.** Your AI key only goes to the AI provider.

## Quick start

You need [Node.js 20+](https://nodejs.org).

```bash
git clone https://github.com/<you>/slipcheck.git
cd slipcheck
npm install
npm run dev
```

Open **http://localhost:3000**. Try a **sample slip** straight away; they're built from this week's real fixtures. To read your own screenshots, add a [Claude](https://console.anthropic.com/settings/keys) or [ChatGPT](https://platform.openai.com/api-keys) key in **Settings**, or put it in `.env.local` (see `.env.example`).

## What's in a match file

| Section | What you get | Source |
| --- | --- | --- |
| Header | Kick-off, venue, referee, weather at kick-off, table positions, last-5 form | ESPN, Premier League, UEFA, football-data.co.uk, Open-Meteo, Wikidata |
| **What matters for this pick** | 3–7 plain facts chosen for the bet type (e.g. Over 2.5 → over rates, total xG, first-half goals, head-to-head goals) | computed from the tabs below |
| Form | Last 5 / 10, home or away only, rest days (European games included) | football-data.co.uk, ESPN |
| Stats | Goals, **xG**, shots, corners, cards per game; BTTS, over 1.5/2.5/3.5, clean-sheet and failed-to-score rates; result margins | football-data.co.uk |
| Head-to-head | League meetings over the last 5 seasons | football-data.co.uk |
| Availability | **Premier League:** official injury and suspension flags with % chance of playing. **Other leagues:** injury and team-news headlines (labelled as news) | Fantasy Premier League, Google News, BBC Sport |
| Referee | Cards, fouls, home-win and over-2.5 rates this season and last | football-data.co.uk |
| Match centre | Lineups once announced; key attackers by xG+xA (EPL); top scorers and goal timing (Bundesliga) | ESPN, Premier League, UEFA, FPL, OpenLigaDB |
| News | Latest headlines for both clubs | Google News, BBC Sport, ESPN |
| Club | Founded, ground, capacity, profile | Wikidata, TheSportsDB |

Every section says where its data came from and when. If a source is down, that section says so and the rest still loads.

## Data sources

All free, all no-key:
- [football-data.co.uk](https://www.football-data.co.uk) (results, xG, match stats, referees)
- [ESPN](https://www.espn.com/soccer)
- [OpenLigaDB](https://www.openligadb.de)
- [Open-Meteo](https://open-meteo.com)
- [Wikidata](https://www.wikidata.org)
- [BBC Sport](https://www.bbc.co.uk/sport/football)
- [Google News](https://news.google.com)
- [TheSportsDB](https://www.thesportsdb.com)
- [Fantasy Premier League](https://fantasy.premierleague.com)
- [Premier League](https://www.premierleague.com)
- [UEFA](https://www.uefa.com)

ESPN, FPL, the Premier League and UEFA are the sites' own public data feeds rather than documented APIs, so they could change without notice. Every response is checked against a schema, so a change shows up as a clear error, not wrong numbers.

Check that every source is up and current:

```bash
npm run check-sources
```

## Covered competitions

England (Premier League, Championship, League One, League Two, National League) · Scotland (Premiership, Championship, League One, League Two) · Germany (Bundesliga, 2. Bundesliga) · Spain (La Liga, La Liga 2) · Italy (Serie A, Serie B) · France (Ligue 1, Ligue 2) · Netherlands · Belgium · Portugal · Turkey · Greece · UEFA Champions League, Europa League, Conference League

## Roadmap

- **Phase 2:** compare your slip's odds across bookmakers.
- **Phase 3:** optional free-key sources: official injury and suspension lists for every league, predicted lineups.
- **Phase 4:** one-command install (`npx` / Docker), desktop app, setup wizard.
- **Phase 5:** saved slips, history, alerts.

## Development

```bash
npm test               # stats, team-name matching across every source, offline dossier build
npm run lint
npm run check-sources  # live health + freshness of every data source
npm run fixtures       # render fake slip screenshots from this week's fixtures → tests/fixtures/slips/
npx tsx scripts/collect-team-names.ts   # re-record club names from every source for the matching tests
```

Code map: `lib/sources/*` (one module per data source) · `lib/teams/*` (matching club names across sources) · `lib/stats/*` (form, rates, head-to-head, referee, pick focus) · `lib/dossier/build.ts` (joins it all per leg) · `app/api/dossier` (streams one match file per leg) · `components/dossier/*` (UI).

---

Information only, not betting advice. 18+. Need help? [BeGambleAware.org](https://www.begambleaware.org) · National Gambling Helpline 0808 8020 133.
