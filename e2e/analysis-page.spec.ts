import { test, expect } from '@playwright/test';

test.describe('Analysis Page - Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analysis.html');
  });

  test('should display the page title', async ({ page }) => {
    await expect(page).toHaveTitle('TaskScore - IGC Analysis');
  });

  test('should display the header with brand name', async ({ page }) => {
    const brand = page.getByRole('link', { name: 'TaskScore' });
    await expect(brand).toBeVisible();
  });

  test('should display the IGC Analysis subtitle', async ({ page }) => {
    const subtitle = page.locator('text=IGC Analysis');
    await expect(subtitle.first()).toBeVisible();
  });

  test('should have a menu button', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    await expect(menuButton).toBeVisible();
  });

  test('should have an Events panel toggle button', async ({ page }) => {
    const eventsButton = page.getByRole('button', { name: /Events|Toggle events/i });
    await expect(eventsButton).toBeVisible();
  });

  test('should display the status alert', async ({ page }) => {
    const statusAlert = page.locator('#status');
    await expect(statusAlert).toBeVisible();
  });

  test('should show ready message in status alert', async ({ page }) => {
    const statusMessage = page.locator('#status-message');
    await expect(statusMessage).toContainText('Ready');
  });

  test('should have the map container', async ({ page }) => {
    const mapContainer = page.locator('#map');
    await expect(mapContainer).toBeVisible();
  });

  test('should have the drop zone element', async ({ page }) => {
    const dropZone = page.locator('#drop-zone');
    await expect(dropZone).toBeAttached();
  });
});

test.describe('Analysis Page - Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analysis.html');
  });

  test('should toggle sidebar when clicking Events button', async ({ page }) => {
    const sidebar = page.locator('#waypoint-sidebar');
    const eventsButton = page.getByRole('button', { name: /Events/i });

    // Initially hidden (translated off-screen)
    await expect(sidebar).toHaveClass(/translate-x-full/);

    // Click to open
    await eventsButton.click();

    // Should become visible (no translate class or translate-x-0)
    await expect(sidebar).not.toHaveClass(/translate-x-full/);
  });

  test('should have the event panel container', async ({ page }) => {
    const eventPanelContainer = page.locator('#event-panel-container');
    await expect(eventPanelContainer).toBeAttached();
  });
});
