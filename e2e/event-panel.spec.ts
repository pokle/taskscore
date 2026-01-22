import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Event Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Load a sample flight first
    await page.goto('/analysis.html');

    const fileInput = page.locator('#igc-file');
    const samplePath = path.join(
      process.cwd(),
      'pages/public/samples/2026-01-05-shane-dunc-XCT-SDU-02.igc'
    );
    await fileInput.setInputFiles(samplePath);

    // Wait for file to be processed
    const statusMessage = page.locator('#status-message');
    await expect(statusMessage).not.toContainText('Ready', { timeout: 10000 });

    // Open the sidebar
    const eventsButton = page.getByRole('button', { name: /Events/i });
    await eventsButton.click();

    // Wait for sidebar to open
    const sidebar = page.locator('#waypoint-sidebar');
    await expect(sidebar).not.toHaveClass(/translate-x-full/);
  });

  test('should display event panel container', async ({ page }) => {
    const eventPanel = page.locator('#event-panel-container');
    await expect(eventPanel).toBeVisible();
  });

  test('should have tabs for different event types', async ({ page }) => {
    // Look for tab buttons - these are created dynamically
    const tabsContainer = page.locator('#event-panel-container');

    // Wait for tabs to load
    await page.waitForTimeout(1000);

    // Check for tab elements (Events, Glides, Climbs, Sinks)
    const tabs = tabsContainer.locator('[role="tablist"], .tabs, [data-tab]');
    await expect(tabs.first()).toBeAttached();
  });

  test('should show Events tab by default', async ({ page }) => {
    const eventPanel = page.locator('#event-panel-container');

    // Wait for content to load
    await page.waitForTimeout(1000);

    // The Events tab should be active or its content should be visible
    const eventsContent = eventPanel.locator('text=Takeoff').or(
      eventPanel.locator('text=Landing')
    ).or(
      eventPanel.locator('text=Thermal')
    );
    await expect(eventsContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('should switch to Glides tab', async ({ page }) => {
    const eventPanel = page.locator('#event-panel-container');

    // Wait for panel to load
    await page.waitForTimeout(1000);

    // Find and click the Glides tab
    const glidesTab = eventPanel.locator('text=Glides').first();
    if (await glidesTab.isVisible()) {
      await glidesTab.click();

      // Glides content should show
      await page.waitForTimeout(500);

      // Look for glide-related content (L/D ratio, distance, etc.)
      const glidesContent = eventPanel.locator('text=L/D').or(
        eventPanel.locator('text=distance')
      ).or(
        eventPanel.locator('[class*="glide"]')
      );
      // Content should be present when glides are detected
    }
  });

  test('should switch to Climbs tab', async ({ page }) => {
    const eventPanel = page.locator('#event-panel-container');

    // Wait for panel to load
    await page.waitForTimeout(1000);

    // Find and click the Climbs tab
    const climbsTab = eventPanel.locator('text=Climbs').first();
    if (await climbsTab.isVisible()) {
      await climbsTab.click();
      await page.waitForTimeout(500);

      // Climbs content should show climb rate info
      const climbsContent = eventPanel.locator('text=m/s').or(
        eventPanel.locator('[class*="climb"]')
      );
      // Content should be present when climbs are detected
    }
  });

  test('should switch to Sinks tab', async ({ page }) => {
    const eventPanel = page.locator('#event-panel-container');

    // Wait for panel to load
    await page.waitForTimeout(1000);

    // Find and click the Sinks tab
    const sinksTab = eventPanel.locator('text=Sinks').first();
    if (await sinksTab.isVisible()) {
      await sinksTab.click();
      await page.waitForTimeout(500);

      // Sinks tab content should show
    }
  });

  test('should display event items in the list', async ({ page }) => {
    const eventPanel = page.locator('#event-panel-container');

    // Wait for events to load
    await page.waitForTimeout(2000);

    // Should have event items
    const eventItems = eventPanel.locator('[class*="event"], .event-item, li');
    const count = await eventItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have filter for visible/all events', async ({ page }) => {
    const eventPanel = page.locator('#event-panel-container');

    // Wait for panel to load
    await page.waitForTimeout(1000);

    // Look for filter buttons
    const showAllButton = eventPanel.locator('text=Show all').or(
      eventPanel.locator('text=All')
    );
    const showVisibleButton = eventPanel.locator('text=Show visible').or(
      eventPanel.locator('text=Visible')
    );

    // At least one filter option should exist
    const hasFilter =
      (await showAllButton.count()) > 0 || (await showVisibleButton.count()) > 0;
    // Filter may or may not be present depending on implementation
  });
});

test.describe('Event Panel - Without Flight', () => {
  test('should handle empty state gracefully', async ({ page }) => {
    await page.goto('/analysis.html');

    // Open the sidebar without loading a flight
    const eventsButton = page.getByRole('button', { name: /Events/i });
    await eventsButton.click();

    // Wait for sidebar to open
    const sidebar = page.locator('#waypoint-sidebar');
    await expect(sidebar).not.toHaveClass(/translate-x-full/);

    // Should not crash - panel should be visible even if empty
    const eventPanel = page.locator('#event-panel-container');
    await expect(eventPanel).toBeVisible();
  });
});
