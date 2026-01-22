import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the page title', async ({ page }) => {
    await expect(page).toHaveTitle('TaskScore - Coming Soon');
  });

  test('should display the main heading', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toHaveText('TaskScore');
  });

  test('should display the tagline', async ({ page }) => {
    const tagline = page.locator('p.text-muted-foreground');
    await expect(tagline).toContainText('Competition track log analysis');
  });

  test('should have a link to the IGC Analysis Tool', async ({ page }) => {
    const link = page.getByRole('link', { name: /Try IGC Analysis Tool/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /\/analysis\.html/);
  });

  test('should display the "coming soon" badge', async ({ page }) => {
    const badge = page.locator('.badge');
    await expect(badge).toContainText('More features coming soon');
  });

  test('should navigate to analysis page when clicking the CTA button', async ({ page }) => {
    const link = page.getByRole('link', { name: /Try IGC Analysis Tool/i });
    await link.click();

    // Should navigate to analysis page with query params
    await expect(page).toHaveURL(/\/analysis\.html/);
    await expect(page).toHaveTitle('TaskScore - IGC Analysis');
  });
});
