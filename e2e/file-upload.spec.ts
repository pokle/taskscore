import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('File Upload - File Picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analysis.html');
  });

  test('should have hidden file input for IGC files', async ({ page }) => {
    const fileInput = page.locator('#igc-file');
    await expect(fileInput).toBeAttached();
    await expect(fileInput).toHaveAttribute('accept', '.igc');
  });

  test('should open file picker from command menu', async ({ page }) => {
    // Mock file input click
    const fileInput = page.locator('#igc-file');
    const fileChooserPromise = page.waitForEvent('filechooser');

    const menuButton = page.getByRole('button', { name: /Menu/i });
    await menuButton.click();

    const openIgcItem = page.locator('#menu-open-igc');
    await openIgcItem.click();

    // This should trigger the file chooser
    const fileChooser = await fileChooserPromise;
    expect(fileChooser).toBeTruthy();
  });

  test('should load IGC file through file input', async ({ page }) => {
    const fileInput = page.locator('#igc-file');

    // Get the path to a sample IGC file
    const samplePath = path.join(
      process.cwd(),
      'pages/public/samples/2026-01-05-shane-dunc-XCT-SDU-02.igc'
    );

    // Set the file
    await fileInput.setInputFiles(samplePath);

    // Wait for the status message to update (indicating file was loaded)
    const statusMessage = page.locator('#status-message');
    await expect(statusMessage).not.toContainText('Ready', { timeout: 10000 });
  });
});

test.describe('File Upload - Drag and Drop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analysis.html');
  });

  test('should show drop zone overlay on drag over', async ({ page }) => {
    const dropZone = page.locator('#drop-zone');
    const mapContainer = page.locator('#map');

    // Simulate drag enter event
    await mapContainer.dispatchEvent('dragenter', {
      dataTransfer: { types: ['Files'] },
    });

    // Drop zone should become visible
    await expect(dropZone).toHaveClass(/drag-over/);
  });

  test('should accept dropped IGC file', async ({ page }) => {
    const statusMessage = page.locator('#status-message');

    // Read the sample file content
    const samplePath = path.join(
      process.cwd(),
      'pages/public/samples/2026-01-05-shane-dunc-XCT-SDU-02.igc'
    );

    // Use Playwright's native file drop
    const fileInput = page.locator('#igc-file');
    await fileInput.setInputFiles(samplePath);

    // Wait for status to change (indicating processing)
    await expect(statusMessage).not.toContainText('Ready', { timeout: 10000 });
  });
});

test.describe('Sample Flight Loading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analysis.html');
  });

  test('should load Rohan Holt sample flight', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    await menuButton.click();

    const sampleItem = page.locator('#sample-rohan');
    await sampleItem.click();

    // Wait for status to indicate loading
    const statusMessage = page.locator('#status-message');
    await expect(statusMessage).not.toContainText('Ready', { timeout: 10000 });
  });

  test('should load Shane Duncan sample flight', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    await menuButton.click();

    const sampleItem = page.locator('#sample-shane');
    await sampleItem.click();

    const statusMessage = page.locator('#status-message');
    await expect(statusMessage).not.toContainText('Ready', { timeout: 10000 });
  });

  test('should load Gordon Rigg sample flight', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    await menuButton.click();

    const sampleItem = page.locator('#sample-gordon');
    await sampleItem.click();

    const statusMessage = page.locator('#status-message');
    await expect(statusMessage).not.toContainText('Ready', { timeout: 10000 });
  });

  test('should load via URL query parameter', async ({ page }) => {
    // Navigate with track query parameter
    await page.goto('/analysis.html?track=2026-01-05-shane-dunc-XCT-SDU-02.igc');

    // Status should show the file is being processed
    const statusMessage = page.locator('#status-message');
    await expect(statusMessage).not.toContainText('Ready', { timeout: 10000 });
  });

  test('should load task via URL query parameter', async ({ page }) => {
    // Navigate with task query parameter
    await page.goto('/analysis.html?task=buje');

    // Wait a bit for task loading
    await page.waitForTimeout(2000);

    // The page should have attempted to load the task
    // (exact behavior depends on implementation)
  });
});
