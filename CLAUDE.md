# CLAUDE.md

Read `INTENT.md` first: it says what this project is for and what it must not do.

## Stack

- Node 22, TypeScript (strict), Astro 7 with static output.
- Vitest for unit and contract tests in `tests/`; Playwright browser tests in `e2e/`.
- In this cloud sandbox, run Playwright with `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- Hosted on GitHub Pages under the base path `/daily-news`; always build URLs from `import.meta.env.BASE_URL`.

## Commands

```sh
npm ci            # install
npm run dev       # local dev server
npm run typecheck # astro sync + tsc
npm test          # vitest
npm run build     # static site into dist/
npm run fetch:news    # real feeds into public/data/v1/news.json
npm run fetch:markets # real delayed prices into public/data/v1/markets.json
npm run fetch:summary # AI brief from news.json into summary.json (needs ANTHROPIC_API_KEY)
npm run test:e2e  # Playwright at phone size, built from tests/fixtures/news.sample.json
```

Run typecheck, test and build before every commit; CI runs the same three.

## Conventions

- Data contracts live in `src/lib/types.ts`. They are a public API for the future mobile app: never make a breaking change in place; add `/data/v2/` instead.
- Tests never call real feeds, market endpoints or the Claude API. Use saved fixtures in `tests/fixtures/` and stub clients.
- Keep client-side JavaScript minimal. Prefer static HTML and CSS; add small scripts only for filtering and search.
- Mobile first: design for 360 px wide, tap targets at least 44 px, no horizontal scroll.
- No new third-party scripts, cookies or analytics.
- One milestone per pull request; describe the change as Before / After / How.
