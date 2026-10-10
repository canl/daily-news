import { expect, test } from '@playwright/test';

test.describe('Today page', () => {
  test('lists stories newest first with publisher, tags and time', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1, name: 'Daily News' })).toBeVisible();
    const cards = page.locator('article.card:visible');
    await expect(cards).toHaveCount(8);
    await expect(cards.first().getByRole('heading')).toHaveText('Fed holds rates steady as inflation cools');
    await expect(cards.first()).toContainText('BBC News');
    await expect(cards.first()).toContainText('+2 more sources');
    await expect(cards.first()).toContainText('Europe');
    await expect(page.locator('.updated time')).toHaveAttribute('datetime', '2026-10-10T12:00:00Z');
  });

  test('story links open the publisher in a new tab', async ({ page }) => {
    await page.goto('./');
    const link = page.locator('article.card').first().getByRole('link');
    await expect(link).toHaveAttribute('href', /^https:\/\/example\.com\//);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('topic chips filter without a reload and update the URL', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('group', { name: 'Topic' }).getByRole('button', { name: 'AI' }).click();
    await expect(page.locator('article.card:visible')).toHaveCount(4);
    await expect(page.locator('article.card:visible[data-topic="finance"]')).toHaveCount(0);
    await expect(page).toHaveURL(/\?topic=ai$/);
    await expect(page.getByRole('group', { name: 'Topic' }).getByRole('button', { name: 'AI' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('region and topic filters combine, and the URL restores them', async ({ page }) => {
    await page.goto('./?topic=finance&region=americas');
    await expect(page.locator('article.card:visible')).toHaveCount(1);
    await expect(page.locator('article.card:visible')).toContainText('Wall Street closes at record high');
    await page.getByRole('group', { name: 'Region' }).getByRole('button', { name: 'All regions' }).click();
    await expect(page.locator('article.card:visible')).toHaveCount(4);
  });

  test('search filters headlines and shows an empty state', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Search headlines' }).click();
    const search = page.getByRole('searchbox', { name: 'Search headlines' });
    await search.fill('oil');
    await expect(page.locator('article.card:visible')).toHaveCount(1);
    await search.fill('zzzz no match');
    await expect(page.locator('article.card:visible')).toHaveCount(0);
    await expect(page.getByText('No stories match these filters.')).toBeVisible();
  });

  test('fits a 360 px screen with no horizontal scroll and 44 px tap targets', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('./');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const chip of await page.locator('.chip').all()) {
      const box = await chip.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
