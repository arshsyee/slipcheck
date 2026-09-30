# Next phase: accounts, saved slips, recurring revenue

*Draft for the owner's review, 2026-09-30. Nothing here is built yet. Each lens (engineer, product, sales, marketing) ends with the decisions it needs from you.*

## The one-paragraph version

Today SlipCheck is a tool you run on your own machine. Nothing is remembered, and nobody pays. The next phase puts it online with **accounts**, so your slips are saved and you can log back in and see them. That turns a one-off lookup into a habit: check the slip before kick-off, then see how it did afterwards.

Recurring revenue comes from the things only a hosted service can do: no-key slip reading, history with results filled in, and alerts when something changes before kick-off. The free, open-source core stays as it is. That is the "open core" model.

**The first blocker isn't code.** Most of our data sources are free to *use*, but several have not been checked for *commercial* use. That has to be settled before we charge anyone (see [Risks](#risks-that-could-stop-this)).

---

## What we'd sell (and what we won't)

We stay the canvas: facts with sources, never picks or predictions. That is both the product and our protection. We are not a tipster, and we never tell anyone what to bet.

| | **Free** (open source, or hosted with a sign-in) | **Pro**, about £5–8 a month or £40–60 a year |
|---|---|---|
| Research a slip, full match reports | ✓ | ✓ |
| Read the slip photo | Bring your own AI key | **Included, no key needed** |
| Saved slips and history | Last 5 slips | **Unlimited** |
| Results filled in after full time ("3 of 4 legs won") | ✓ | ✓ |
| Your record by bet type ("BTTS: 11 of 20 won") | | **✓** |
| Alerts before kick-off (a player on your slip ruled out, lineup announced, big weather change) | | **✓** |
| Your own AI reads your history (MCP / plugin) | | **✓** |

**Why these are worth paying for:** each one needs a server running when you're not there, such as watching lineups at 14:00 or settling results at 17:00. You can't get that from the free local version, so the split feels fair rather than crippled.

**We won't sell:** tips, "value bets", predicted scores, or bookmaker affiliate links. Affiliate money is the easy revenue in this industry, but it pays us when users lose. That breaks the honesty the product is built on. (This is your call; see Decisions.)

---

## 1. Engineer

**What changes**
- **Hosting.** Move from "runs on your laptop" to a hosted Next.js app (e.g. Vercel), with a Postgres database (Supabase or Neon) and a small scheduled-jobs runner.
- **Sign-in.** Email magic link plus Google, using Auth.js or Supabase Auth. No passwords to store. Add an 18+ confirmation at sign-up.
- **Data model** (small):
  - `users`
  - `slips` (who, when, the photo if the user keeps it, total odds)
  - `legs` (teams, market, pick, line, odds, kick-off, **result once settled**)
  - `reports` (the text report at the time it was run, so history shows what you *saw*, not today's data)
- **Shared cache.** Today each machine fetches from the sources itself. Hosted, every user asking about Arsenal v Leeds must share **one** fetch. That keeps us polite to free sources and keeps us from getting blocked. The existing cache becomes a shared store, such as a Postgres table or Redis.
- **Result settling.** A job runs every 30 minutes on match days. It finds legs whose match has finished, reads the result from sources we already use (football-data.co.uk, UEFA, OpenLigaDB), and marks each leg won, lost or void. Most markets settle mechanically. Anything unclear stays **"not settled"** rather than being guessed, the same rule as our red N/A.
- **Alerts.** Starting 2 hours before a saved leg kicks off, re-check availability and lineups (FPL, Premier League, UEFA). If a player named on the slip, or a likely starter, drops out, send an email or web push. The same "missed flag beats false flag" rule applies.
- **AI keys.**
  - Bring-your-own keys stay in the browser, as now. **We never store them on our server.**
  - Pro slip reading uses our own key. At roughly 4,000 tokens per slip, that's about 1–3p a slip (see [token costs](token-costs.md)).
- **Payments.** A "merchant of record" such as Paddle or Lemon Squeezy handles VAT for us. Stripe works too, but we must first confirm it accepts a *betting-related* product. Their rules treat gambling and tipping services differently from stats tools, so that needs checking with them, not assuming.
- **Privacy.** UK GDPR applies: a privacy notice, an export-my-data button, and delete-my-account that really deletes. Slip photos are kept only if the user ticks "keep photo".

**Rough effort** (one developer with AI help):

| Step | Time |
|---|---|
| Accounts, saved slips and history | 1–2 weeks |
| Settling results | 1 week |
| Alerts | 1–2 weeks |
| Payments and plan limits | 1 week |
| Hosting and shared cache | 1 week |

Total: about **6–8 weeks** to a paid beta.

**Decisions for you:** hosting (Vercel + Supabase is the simplest), sign-in methods, and whether to keep slip photos at all.

## 2. Product manager

**Phases, each shipped and measured before the next:**

1. **Accounts and history, free** (weeks 1–3): sign in, slips saved, results filled in. *Goal: learn whether people come back.*
2. **Pricing test, before building payments** (week 3): a pricing page with "Join Pro, £6/month" that collects emails. *If fewer than about 3% of active users click, rethink before building billing.*
3. **Pro beta** (weeks 4–8): no-key reading, alerts, bet-type record. Invite the waitlist and offer founding members a discount.
4. **MCP / plugin for Pro** (after): your own AI reads your saved slips and history.

**Numbers to watch** (defined now, so we don't fool ourselves):
- **Activation:** new users who research one slip in their first visit.
- **Weekly return:** users who research a slip in 2 separate weeks.
- **4-week retention:** the real test of a habit product.
- **Free → Pro conversion,** and **monthly churn.**
- **Settling accuracy:** settled legs we got wrong. Target zero, and checked by hand at first.

**Seasonality:** football runs August to May, so June and July will lose subscribers. Answers: annual plans (two months free), a "pause for summer" button instead of cancel, and summer tournaments (Euro 2028, World Cup 2030) as the off-season hook.

**Decisions for you:** go or no-go on the pricing test before building payments.

## 3. Sales

**Who pays:**
- **Primary: the regular recreational punter.** Bets most weekends, builds 3–6 leg accas, already checks form in 3 or 4 apps. They pay to save time and to see their own record honestly.
- **Secondary, later: communities.** Betting Discords, Telegram groups and content creators who discuss slips. A **team plan** (say £30 a month for 10 seats) or a creator plan (share a public slip report page). Only once solo Pro works.
- **Not a customer:** bookmakers. Selling to them puts us on the other side of the user.

**The pitch in one line:** "Every fact about every match on your slip, in one place, and an honest record of how your bets actually do."

**Objections and answers:**

| Objection | Answer |
|---|---|
| "FotMob and SofaScore are free." | They show one match at a time. We read your whole slip and answer *your* bet type, and you don't have to hunt. |
| "Will it make me win?" | No, and we say so. It saves time and shows your real record. Anyone promising wins is selling tips. |
| "£6 is a lot." | That's less than one small stake a month. The free version stays useful forever. |

**Decisions for you:** price point, and whether to offer the team/creator plan at all in year one.

## 4. Marketing

**Where punters already are:** r/SoccerBetting and team subreddits, betting X/Twitter, TikTok and Instagram slip culture, and Discord groups.

**What we post** is facts people want to share, never tips:
- "Your acca, fact-checked": a shareable card for one slip.
- Weekend round-ups ("5 of the 10 Premier League games this weekend have a team missing 2+ starters").
- Honest-record screenshots ("my BTTS record: 11 of 20").

**Search:** a public page per upcoming fixture ("Arsenal v Leeds: form, head-to-head, team news") built from the data we already gather. It pulls in people searching before kick-off, and each page ends with "check your whole slip". Only facts go on these pages, and we check the sources' terms first (see Risks).

**Open source as marketing:** a public GitHub repo, a "Show HN" launch, and a clear README. It builds trust ("you can see exactly what it does") and developer word of mouth. The repo is private and has **no license file** yet, so picking one (e.g. MIT or AGPL) comes first.

**Rules we must follow:**
- Gambling-related ads are restricted on Google and Meta and by the UK ad rules (CAP code). Check before running any paid ads.
- Nothing may appeal to under-18s.
- Always show 18+ and BeGambleAware.
- Start with organic channels, not paid ads.

**Decisions for you:** brand voice (plain and honest, as now), and which one channel to go deep on first. The suggestion is Reddit plus the shareable slip card.

---

## Risks that could stop this

1. **Data sources' terms for commercial use (the big one).** Before charging, each source needs a check:
   - **football-data.co.uk:** check its terms.
   - **FPL, Premier League and UEFA:** these are unofficial feeds with no published terms for reuse. Commercial use may not be allowed, and they could block us at any time.
   - **Wikipedia and Wikidata:** fine with attribution. Wikipedia text is CC BY-SA and Wikidata is CC0.
   - **martj42 results:** CC0, fine.
   - **Open-Meteo:** free for non-commercial use only. Commercial use needs its paid plan.
   - **Google News RSS:** check its terms.
   - **TheSportsDB:** has paid tiers for heavier use.

   Where a source doesn't allow it, the options are a paid licence (e.g. Open-Meteo's commercial plan, or a football data API), dropping that section for hosted users, or keeping it in the free local version only. **This decides what Pro can include and what it costs us.**
2. **Being blocked at scale.** Free sources were fine for one laptop. Thousands of users need the shared cache, polite request rates, and a fallback for each source. We already serve the last good copy when a source is down, which helps.
3. **Payment provider refusal** of gambling-adjacent products. Confirm before building billing.
4. **Settling wrongly.** A wrong "you won" destroys trust. Unclear results stay unsettled, and the first month is checked by hand.
5. **Responsible gambling.** A history of your bets can show someone a pattern they should see. Add an honest spend and results view, links to GamStop and BeGambleAware, and never nudge anyone to bet more.

## Decisions needed from you

1. OK to host SlipCheck online with accounts, keeping the local open-source version?
2. Free / Pro split as above, and the price: £5, £6 or £8 a month?
3. No bookmaker affiliate links, ever? (Recommended: yes, never.)
4. Run the data-source terms check first, before any building? (Recommended: yes.)
5. Keep slip photos, or delete them after reading?
6. Open-source license: MIT (anyone can reuse, even commercially) or AGPL (anyone hosting it must share their changes)?
7. The first marketing channel to go deep on.
