import { defineConfig, devices } from '@playwright/test';

const port = 4321;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}/daily-news/`,
    // A phone-sized viewport: the site is designed for 360-430 px wide screens first.
    ...devices['Pixel 7'],
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    // Builds from a fixed sample so the tests never depend on live feeds.
    command: `npm run build && npx astro preview --port ${port} --ignore-lock`,
    env: { NEWS_JSON: 'tests/fixtures/news.sample.json', MARKETS_JSON: 'tests/fixtures/markets.sample.json', SUMMARY_JSON: 'tests/fixtures/summary.sample.json' },
    url: `http://localhost:${port}/daily-news/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
