# Intent

Daily News is a free, mobile-first website that shows the latest financial and AI headlines from around the world on one page, refreshed every hour. The long-term goal is a native mobile app that reads the same data.

The full requirements and design live in two Claude Docs (the source of truth when this file and they disagree):

- [Requirements](https://claude.ai/code/artifact/63baf2de-74b8-4f64-bcb7-ee1ca07d36c8)
- [Design and plan](https://claude.ai/code/artifact/77da7224-7c80-4469-9ac9-ba418c25c539)

## What it does (version 1)

- Collects stories from 10+ free public RSS feeds, tagged Finance or AI and by region.
- Shows the last 48 hours, newest first, with topic and region filters and search.
- Each card: headline, publisher, region, relative time, short snippet, link to the original.
- An AI-written "today in 5 bullets" summary per topic (Claude Haiku 5.5, twice a day, before the London open and after the close), every bullet citing its stories. Finance bullets add "why it matters" and "market impact", labelled as analysis.
- A Markets page with delayed daily moves for 25 instruments: indices, AI stocks, FX, commodities and rates, crypto.
- Publishes `news.json`, `summary.json` and `markets.json` under `/data/v1/` for the future app.

## Constraints

- $0 hosting: static site on GitHub Pages, rebuilt hourly by GitHub Actions. No server, no database.
- No cookies, trackers or third-party scripts.
- Fair use: headline, snippet and link only; always credit the publisher.
- Lighthouse mobile: Performance 90+, Accessibility 95+.
- A failed build never takes the site down; the last good deploy stays live.

## Out of scope for version 1

User accounts, push notifications, comments, live tickers, paywalled full text, the native app itself, non-English sources.

## Milestones

1. Repo setup
2. News pipeline
3. Today page
4. Markets
5. AI summary
6. Deploy and acceptance checks
