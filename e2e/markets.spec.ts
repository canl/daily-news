import { expect, test } from '@playwright/test';

test.describe('Markets page', () => {
  test('shows all five groups with prices, changes and sparklines', async ({ page }) => {
    await page.goto('./markets/');
    await expect(page.getByRole('heading', { level: 1, name: 'Markets' })).toBeVisible();
    for (const group of ['Stock indices', 'AI bellwethers', 'Currencies', 'Commodities and rates', 'Crypto']) {
      await expect(page.getByRole('heading', { level: 2, name: group })).toBeVisible();
    }
    await expect(page.locator('details.row')).toHaveCount(25);
    const spx = page.locator('details.row[data-symbol="^GSPC"]');
    await expect(spx).toContainText('S&P 500');
    await expect(spx.locator('.change')).toHaveText(/[▲▼■] [+−]?[\d,.]+ \([+−]?[\d.]+%\)/);
    await expect(spx.getByRole('img', { name: 'S&P 500, last 30 days' })).toBeVisible();
    await expect(page.locator('.updated')).toHaveText(/^Delayed · Oct 10, 18:00 UTC$/);
  });

  test('tapping a row opens its 30-day chart', async ({ page }) => {
    await page.goto('./markets/');
    const nvda = page.locator('details.row[data-symbol="NVDA"]');
    await nvda.locator('summary').click();
    await expect(nvda.getByRole('img', { name: /Nvidia, daily closes over the last 30 sessions/ })).toBeVisible();
    await expect(nvda).toContainText('30-session range');
  });

  test('the tab bar moves between Today and Markets', async ({ page }) => {
    await page.goto('./');
    const tabs = page.getByRole('navigation', { name: 'Sections' });
    await expect(tabs.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    await tabs.getByRole('link', { name: 'Markets' }).click();
    await expect(page).toHaveURL(/\/daily-news\/markets\/$/);
    await expect(tabs.getByRole('link', { name: 'Markets' })).toHaveAttribute('aria-current', 'page');
  });

  test('the Today page shows a strip of four indices that links to Markets', async ({ page }) => {
    await page.goto('./');
    const strip = page.getByRole('link', { name: /Market moves/ });
    await expect(strip.locator('.tile')).toHaveCount(4);
    await expect(strip).toContainText('S&P 500');
    await strip.click();
    await expect(page).toHaveURL(/\/markets\/$/);
  });

  test('fits a 360 px screen with no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('./markets/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
