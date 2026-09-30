# Next phase: accounts to save your slips

*Draft for the owner's review, 2026-09-30 (revised: open source only, no paid tier). Nothing here is built yet.*

## Official statement

**SlipCheck is not gambling. It's information gathering.** It takes no bets, handles no money, and gives no tips or predictions. Use this wording wherever SlipCheck describes itself: ad applications, app stores, payment or hosting sign-ups, and the site itself.

## The one-paragraph version

SlipCheck stays **fully open source and free**. The next phase adds an optional **account** that does one thing: it saves the slips and accas you've researched, so you can log back in and see them. That's the whole feature. There's no paid plan and nothing is locked behind one.

The hosted website can carry **ads** (with gambling ads blocked) and a **donate** link to cover running costs. Anyone can still run SlipCheck on their own machine with no account and no ads.

---

## What an account gives you

- Sign in with an email link or Google. No passwords.
- **My slips:** every slip you've researched, newest first. Each shows the legs, your odds (2.5x), and when you checked it.
- Open an old slip to see the report **as it was when you ran it**, and research it again if the match hasn't started.
- Delete a slip, or delete your whole account.

**Not in this phase:** results filled in, alerts, a record by bet type. They're nice ideas, but each needs jobs running in the background. Add them only if people actually use saved slips.

## 1. Engineer

**What changes**
- **Hosting.** Put the app online (e.g. Vercel) with a Postgres database (Supabase or Neon). The local version keeps working exactly as now, with no account and nothing stored.
- **Sign-in.** Supabase Auth or Auth.js, with an email magic link plus Google. An 18+ confirmation at sign-up.
- **Data** (two tables):
  - `slips`: owner, created, the legs (teams, market, pick, line, odds)
  - `reports`: the text report for each leg at the time it was run, about 2,000 tokens of text each, which is small

  The slip photo is **not kept**. It's read, then thrown away.
- **Shared cache.** Hosted, many people will ask about the same match, so they must share **one** fetch from each free source. That keeps us polite and unblocked. The existing cache moves to a shared store, such as a Postgres table.
- **AI keys.** These stay in the browser, as now, and **are never stored on our server**. The saved-slips feature doesn't touch them.
- **Privacy (UK GDPR).** A short privacy notice, delete-my-account that really deletes, and export-my-data (a JSON download).

**Rough effort:** about 2–3 weeks with AI help. Sign-in and saved slips take about 1 week, hosting and the shared cache about 1 week, and privacy plus polish the rest.

## 2. Product

- **Goal:** find out whether people come back. Watch two numbers: users who save 2 or more slips, and users who return in a second week.
- **Keep it minimal:** one "My slips" list, no dashboards. The only motion is new picks arriving (the same rule as the start screen).
- **Seasonality:** football runs August to May, so expect quiet summers.

## 3. Paying for hosting: ads and donations

Hosting, the database and bandwidth should cost roughly **£0–25 a month** at small scale, on the free and hobby tiers.

**Donations:** GitHub Sponsors and a "Buy me a coffee" link. This fits an open-source project and has no conflict of interest.

**Ads:** possible on the hosted site, with care. See the next section.

## 4. Can we run ads? Yes, with caveats

- **Google AdSense.** Google restricts ads on pages that *let users gamble for real money*. SlipCheck isn't gambling, it's information gathering (see the official statement), so apply on that basis. Google makes the final call on review.
- **Block gambling ads.** AdSense lets a site block sensitive ad categories, including gambling. **We should block them.** Showing bookmaker ads beside an honest fact tool would pay us when users bet more, the same conflict as affiliate links.
- **It won't earn much at first.** Display ads typically earn a few pounds per 1,000 page views, so ads start to matter only at tens of thousands of visits a month. Until then, donations probably earn about the same.
- **Cookie consent.** Personalised ads in the UK need a consent banner (UK GDPR and PECR). Non-personalised ads avoid most of that but earn less.
- **Design cost.** Ads clash with the swift, minimal look. If we add them, use one quiet slot, never between your picks, and never in the match reports.
- **Local and self-hosted copies** have no ads, and that's fine.

## 5. Marketing (free channels only)

- **Where punters already are:** r/SoccerBetting and team subreddits, betting X/Twitter, and Discord groups.
- **What we share:** facts, never tips. For example, a shareable "your acca, fact-checked" card, or a weekend round-up ("5 of this weekend's 10 Premier League games have a team missing 2+ starters").
- **Open source as marketing:** make the repo public with a clear README, launch with "Show HN", and let people see exactly what it does.
- **Always:** 18+, BeGambleAware, and nothing that appeals to under-18s.

## Risks

1. **Data sources' terms.** Ads make the hosted site commercial, and some free sources allow only non-commercial use.
   - **Open-Meteo:** free for non-commercial use only.
   - **FPL, Premier League and UEFA:** unofficial feeds with no published reuse terms.
   - **football-data.co.uk and Google News:** check their terms.

   A site with no ads and only donations is the safest. **Check the terms before switching ads on.**
2. **Being blocked at scale.** This needs the shared cache and polite request rates. We already serve the last good copy when a source is down.
3. **Responsible gambling.** A saved history can show someone a pattern. Keep BeGambleAware and GamStop links visible on "My slips".

## Decisions needed from you

1. Host online with accounts that only save slips, keeping the local version account-free? (This plan assumes yes.)
2. Ads on the hosted site: yes, with gambling ads blocked, or donations only to start? (Recommended: donations only at launch. Add ads once traffic justifies it and the data terms are checked.)
3. ~~Open-source license~~ **Decided: AGPL-3.0** (2026-09-30), see [LICENSE](../LICENSE).
4. Keep slip photos? (Recommended: no. Read them, then delete.)
