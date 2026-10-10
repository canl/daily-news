# Daily News

The latest financial and AI news from around the world, on one fast mobile page, refreshed every hour.

Live site: https://canl.github.io/daily-news/

Data for apps, refreshed hourly: [`news.json`](https://canl.github.io/daily-news/data/v1/news.json), [`markets.json`](https://canl.github.io/daily-news/data/v1/markets.json) and [`summary.json`](https://canl.github.io/daily-news/data/v1/summary.json) (twice a day: before the London open and after the close). Shapes are in `src/lib/types.ts`.

See [INTENT.md](INTENT.md) for goals and scope.

## Develop

Requires Node 22.

```sh
npm ci
npm run dev
```

Checks: `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` for browser tests (Playwright; builds from `tests/fixtures/news.sample.json`).

## How it updates

`.github/workflows/deploy.yml` runs every hour, and on every push to `main`:

1. Restores the live JSON files, so a source that fails keeps its last good data.
2. Fetches news and prices, and writes a new AI summary at the first run after 06:00 and 17:00 UTC, before the London open and after the close (uses the `ANTHROPIC_API_KEY` repository secret).
3. Runs the tests, builds and publishes to GitHub Pages. If any of this fails, nothing is published and the last good site stays up.

To refresh by hand, use Actions > Deploy > Run workflow; tick "Write a new AI summary now" to skip the 4-hour wait.
