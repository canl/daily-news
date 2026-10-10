import { expect, test } from '@playwright/test';

test.describe('Today in brief', () => {
  test('shows the labelled AI summary with source links for each topic', async ({ page }) => {
    await page.goto('./');
    const brief = page.getByRole('region', { name: 'Today in brief' });
    await expect(brief).toBeVisible();
    await expect(brief).toContainText('AI-generated summary');
    await expect(brief).toContainText('It can make mistakes');
    await expect(brief.getByRole('heading', { level: 3 })).toHaveText(['Finance', 'AI']);
    await expect(brief.locator('li')).toHaveCount(6);

    const first = brief.locator('li').first();
    await expect(first).toContainText('kept its key rate unchanged');
    const source = first.getByRole('link', { name: 'BBC News' });
    await expect(source).toHaveAttribute('href', /^https:\/\/example\.com\//);
    await expect(source).toHaveAttribute('target', '_blank');
    await expect(brief.locator('li').nth(1).getByRole('link')).toHaveCount(2);
  });

  test('follows the topic filter', async ({ page }) => {
    await page.goto('./?topic=ai');
    const brief = page.getByRole('region', { name: 'Today in brief' });
    await expect(brief.getByRole('heading', { level: 3, name: 'AI' })).toBeVisible();
    await expect(brief.getByRole('heading', { level: 3, name: 'Finance' })).toBeHidden();
    await page.getByRole('group', { name: 'Topic' }).getByRole('button', { name: 'All' }).click();
    await expect(brief.getByRole('heading', { level: 3, name: 'Finance' })).toBeVisible();
  });

  test('collapses, and its links are 44 px tall at 360 px wide', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('./');
    const brief = page.getByRole('region', { name: 'Today in brief' });
    for (const link of await brief.getByRole('link').all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await brief.getByText('Today in brief').click();
    await expect(brief.locator('li').first()).toBeHidden();
  });
});
