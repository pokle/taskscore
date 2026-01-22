import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Map Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analysis.html');
  });

  test('should render the map container', async ({ page }) => {
    const mapContainer = page.locator('#map');
    await expect(mapContainer).toBeVisible();
  });

  test('should initialize MapBox GL map', async ({ page }) => {
    // Wait for map to initialize
    await page.waitForTimeout(2000);

    // Check for MapBox canvas element
    const mapCanvas = page.locator('#map canvas, .mapboxgl-canvas');
    await expect(mapCanvas).toBeAttached();
  });

  test('should display flight track on map after loading IGC', async ({ page }) => {
    const fileInput = page.locator('#igc-file');
    const samplePath = path.join(
      process.cwd(),
      'pages/public/samples/2026-01-05-shane-dunc-XCT-SDU-02.igc'
    );
    await fileInput.setInputFiles(samplePath);

    // Wait for processing
    await page.waitForTimeout(3000);

    // Map should have layers added (checking for canvas is a basic check)
    const mapCanvas = page.locator('#map canvas, .mapboxgl-canvas');
    await expect(mapCanvas).toBeVisible();
  });
});

test.describe('Map Display Options', () => {
  test.beforeEach(async ({ page }) => {
    // Load a sample flight
    await page.goto('/analysis.html');

    const fileInput = page.locator('#igc-file');
    const samplePath = path.join(
      process.cwd(),
      'pages/public/samples/2026-01-05-shane-dunc-XCT-SDU-02.igc'
    );
    await fileInput.setInputFiles(samplePath);

    // Wait for file to be processed
    await page.waitForTimeout(3000);
  });

  test('should toggle altitude colors', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    await menuButton.click();

    const altitudeColorsItem = page.locator('#menu-altitude-colors');
    const statusSpan = page.locator('#altitude-colors-status');

    // Get initial state
    const initialStatus = await statusSpan.textContent();

    // Click to toggle
    await altitudeColorsItem.click();

    // Reopen menu to check status
    await menuButton.click();
    const newStatus = await statusSpan.textContent();

    // Status should have changed
    expect(newStatus).not.toBe(initialStatus);
  });

  test('should toggle 3D track', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    await menuButton.click();

    const trackItem = page.locator('#menu-3d-track');
    const statusSpan = page.locator('#3d-track-status');

    // Get initial state
    const initialStatus = await statusSpan.textContent();

    // Click to toggle
    await trackItem.click();

    // Reopen menu to check status
    await menuButton.click();
    const newStatus = await statusSpan.textContent();

    // Status should have changed
    expect(newStatus).not.toBe(initialStatus);
  });

  test('should toggle track visibility', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    await menuButton.click();

    const toggleTrackItem = page.locator('#menu-toggle-track');
    const statusSpan = page.locator('#track-visibility-status');

    // Get initial state (should be "on")
    const initialStatus = await statusSpan.textContent();
    expect(initialStatus).toContain('on');

    // Click to toggle off
    await toggleTrackItem.click();

    // Reopen menu to check status
    await menuButton.click();
    const newStatus = await statusSpan.textContent();
    expect(newStatus).toContain('off');

    // Toggle back on
    await toggleTrackItem.click();
    await menuButton.click();
    const finalStatus = await page.locator('#track-visibility-status').textContent();
    expect(finalStatus).toContain('on');
  });

  test('should toggle task visibility', async ({ page }) => {
    // First load a task
    await page.goto('/analysis.html?task=buje');
    await page.waitForTimeout(3000);

    const menuButton = page.getByRole('button', { name: /Menu/i });
    await menuButton.click();

    const toggleTaskItem = page.locator('#menu-toggle-task');
    const statusSpan = page.locator('#task-visibility-status');

    // Get initial state
    const initialStatus = await statusSpan.textContent();

    // Click to toggle
    await toggleTaskItem.click();

    // Reopen menu to check status
    await menuButton.click();
    const newStatus = await statusSpan.textContent();

    // Status should have changed
    expect(newStatus).not.toBe(initialStatus);
  });
});

test.describe('Map Interactions', () => {
  test('should support zoom via mouse wheel', async ({ page }) => {
    await page.goto('/analysis.html');
    await page.waitForTimeout(2000);

    const mapContainer = page.locator('#map');

    // Get initial state
    await mapContainer.hover();

    // Zoom in with mouse wheel
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(500);

    // Map should still be visible (basic interaction test)
    await expect(mapContainer).toBeVisible();
  });

  test('should support pan via mouse drag', async ({ page }) => {
    await page.goto('/analysis.html');
    await page.waitForTimeout(2000);

    const mapContainer = page.locator('#map');
    const box = await mapContainer.boundingBox();

    if (box) {
      // Start drag
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100);
      await page.mouse.up();
    }

    // Map should still be visible
    await expect(mapContainer).toBeVisible();
  });
});
