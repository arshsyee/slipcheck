# How many AI tokens does SlipCheck use?

*Measured 2026-09-30 on 9 real upcoming matches. An estimate to plan with, not an exact bill.*

## The short answer

**Gathering the data costs zero tokens.** Every search (results, xG, table, squads, injuries, weather, news, fixtures) is a plain web request made by SlipCheck's own code to free public sources. No AI is involved.

Tokens are spent in only two places:

| Step | When | Tokens (roughly) |
|---|---|---|
| **1. Reading the slip photo** | Once per slip | **~2,500 to 5,000 in, ~150 out** |
| **2. Your own AI reading the report** (optional; e.g. via a future MCP server or plugin) | Once per match you ask it about | **~2,000 in per match**, plus whatever it writes back |

So a typical 4-match accumulator is about **4,000 tokens to read the slip**, plus about **8,000 if you hand all four reports to an AI** to discuss.

## 1. Reading the slip photo

One AI call per slip: the image, our instructions, and a required answer format go in; the list of bets comes out.

| Part | Tokens |
|---|---|
| Our instructions (`lib/ai/prompt.ts`) | ~520 |
| Answer format (the slip schema) | ~390 |
| The image: see below | 1,450 to 4,800 |
| The answer (a 3-match slip) | ~130 out |

**Image tokens** follow Anthropic's documented rule: `⌈width ÷ 28⌉ × ⌈height ÷ 28⌉`, capped at **4,784** on Claude 4.7 and later (including the default, Claude Sonnet 5) and **1,568** on older models ([Anthropic vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)).

| Screenshot | Claude 4.7+ (default) | Older Claude models |
|---|---|---|
| Cropped slip, 923 × 2000 | 2,376 | 1,456 |
| Android, 1080 × 2400 | 3,354 | 1,456 |
| iPhone, 1170 × 2532 | 3,822 | 1,456 |
| iPhone Pro Max, 1290 × 2796 | 3,956 | 1,456 |

**Tip for users:** crop the screenshot to the slip itself. A tight crop costs about 40% fewer tokens than a full-screen capture (2,376 vs 3,956 above), with no loss for reading the bets.

## 2. An AI reading the report

This is the "painter" step: the user's own AI reads what SlipCheck gathered and helps them think. What it costs depends on **which format it reads**:

| Match | Report (text) | Full data (JSON, compact) |
|---|---|---|
| Premier League, result | 2,281 | 22,066 |
| Premier League, both teams score | 2,524 | 23,819 |
| La Liga, goals | 2,130 | 22,968 |
| Serie A, cards | 1,897 | 20,636 |
| Bundesliga, corners | 1,860 | 19,041 |
| Ligue 1, result | 2,143 | 19,981 |
| Champions League | 1,861 | 21,596 |
| National team, Nations League | 2,015 | 60,072 |
| National team, friendly | 1,581 | 60,677 |
| **Median** | **~2,000** | **~22,000** |

**Use the text report for AI, not the full JSON.** The JSON is 10 to 30 times bigger because it repeats the raw game lists behind every number (all games, last 5, last 10, home, away), and national teams carry two years of matches. The text report already holds every figure a person or an AI needs. When we build the MCP server or plugin, it should serve the text report (or a trimmed JSON), and only send the raw data if the AI explicitly asks.

## Putting a price on it

Multiply the tokens by your model's price per token ([claude.com/pricing](https://claude.com/pricing)). For scale, Anthropic's own docs quote $1 per million input tokens for Claude Haiku 4.5 and $5 per million for Claude Opus 5. At those rates, reading one slip (~4,000 tokens) costs about **$0.004 on Haiku** or **$0.02 on Opus**, and an AI reading a 4-match report (~8,000 tokens) about **$0.008** or **$0.04**. Output tokens are priced higher than input, but there are few of them here.

Because each user brings their own key, **running SlipCheck as an open-source project costs the maintainers nothing in tokens.** Each user pays their own provider for their own slips.

## How this was measured, and how sure we are

- **Reports:** `npm run research` on 9 real upcoming matches covering every league we support, the Champions League, national teams, and every bet type, in both text and `--json`.
- **Counting:** with an openly available tokenizer (OpenAI's `o200k_base`, via `tiktoken`). Claude's tokenizer isn't published for offline use and counts somewhat differently, so treat every figure as **approximate**. For an exact Claude count, send the same text to Anthropic's free token-counting endpoint (`/v1/messages/count_tokens`) with your key.
- **Image tokens:** Anthropic's published formula, so those are exact for Claude.
- **Reports grow and shrink** with the match: more injury news, a longer head-to-head or a bigger squad list adds a few hundred tokens.
