# SlipCheck

Upload a screenshot of your bet slip and see which US sportsbook pays the most for the **exact same bet**. SlipCheck also shows public matchup info for each leg: records, recent results and injury reports.

- 🧾 **Reads your slip with AI.** Use Claude or ChatGPT with your own API key.
- 💸 **Compares payouts** across DraftKings, FanDuel, BetMGM, Caesars, ESPN BET, Fanatics and more, using [The Odds API](https://the-odds-api.com).
- 📊 **Matchup info** (records, last 5 results, injuries) from ESPN's public data.
- 🔒 **Runs on your computer.** Your keys go only to the providers you choose.

## Quick start

You need [Node.js 20+](https://nodejs.org).

```bash
git clone https://github.com/<you>/slipcheck.git
cd slipcheck
npm install
npm run dev
```

Open **http://localhost:3000**, go to **Settings**, and paste:

| Key | What it's for | Get one |
| --- | --- | --- |
| Claude **or** ChatGPT | Reads the slip screenshot | [Anthropic](https://console.anthropic.com/settings/keys) · [OpenAI](https://platform.openai.com/api-keys) |
| The Odds API | Live odds from US books (free: 500 requests/month) | [the-odds-api.com](https://the-odds-api.com/#get-access) |

Then drop in a slip screenshot, check the legs it read, and hit **Compare odds**.

> Prefer not to paste keys in the browser? Copy `.env.example` to `.env.local` and put them there.

## What's supported (MVP)

- **Leagues:** NFL, NBA, MLB, NHL, NCAAF, NCAAB
- **Markets:** moneyline, spread, game total. Singles and parlays.
- A book only counts as a match when it offers the **same line**. If it has a different line, the table shows it as *alt*.
- Parlay payouts multiply each leg's odds. Real books sometimes price same-game parlays differently.

## Roadmap

- **Phase 2:** player props, line-movement charts, no-vig fair odds / EV%, AI matchup summary
- **Phase 3:** one-command install (`npx` / Docker), desktop app, first-run setup wizard
- **Phase 4:** UK/EU/AU books, slip history, deep links into each sportsbook

## Try it without keys

On the home page, pick one of the **sample slips**. They're priced against built-in demo odds from 8 books (clearly labeled, not live), while the matchup info is still real ESPN data. The samples cover:

| Sample | What it tests |
| --- | --- |
| Chiefs moneyline | Single bet where another book pays more |
| NFL 3-leg parlay | Books with different lines ("alt") and missing games are skipped |
| MLB run line + under | Baseball run lines and totals; a book that doesn't list the games |
| Eagles -6.5 | Your book is already the best price |
| Messy parlay | Player prop + a game that isn't listed; explains what can't be priced |

## Development

```bash
npm test          # unit tests: odds math, team matching, and every sample slip scenario
npm run lint
npm run fixtures  # render sample slips as fake screenshots in tests/fixtures/slips/
```

The fixture images come with an `expected.json` listing what the AI should read from each one. Upload them to check the slip reader once you've added an AI key.

Code map: `lib/ai` (slip parsing), `lib/odds` (Odds API client, matching, comparison), `lib/info` (ESPN), `app/api/*` (local API routes), `components/*` (UI).

---

For information only. Odds move fast, so always confirm on the sportsbook. Must be 21+. Gambling problem? Call **1-800-GAMBLER**.
