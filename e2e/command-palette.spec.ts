import { test, expect } from '@playwright/test';

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analysis.html');
  });

  test('should open command dialog when clicking menu button', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    const commandDialog = page.locator('#command-dialog');

    // Dialog should be closed initially
    await expect(commandDialog).not.toHaveAttribute('open');

    // Click menu button
    await menuButton.click();

    // Dialog should be open
    await expect(commandDialog).toHaveAttribute('open');
  });

  test('should open command dialog with keyboard shortcut Cmd+K', async ({ page }) => {
    const commandDialog = page.locator('#command-dialog');

    // Press Cmd+K (Meta+K)
    await page.keyboard.press('Meta+k');

    // Dialog should be open
    await expect(commandDialog).toHaveAttribute('open');
  });

  test('should have search input in command dialog', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    await menuButton.click();

    const searchInput = page.locator('#command-dialog input[type="text"]');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', /Search options/i);
  });

  test('should display File section with menu items', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    await menuButton.click();

    // Check File section heading
    const fileHeading = page.locator('#file-heading');
    await expect(fileHeading).toHaveText('File');

    // Check menu items
    const openIgcItem = page.locator('#menu-open-igc');
    await expect(openIgcItem).toContainText('Open IGC file');

    const importTaskItem = page.locator('#menu-import-task');
    await expect(importTaskItem).toContainText('Import XContest task');
  });

  test('should display Display Options section', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    await menuButton.click();

    const displayHeading = page.locator('#display-options-heading');
    await expect(displayHeading).toHaveText('Display Options');

    // Theme options
    await expect(page.locator('#menu-theme-light')).toContainText('Light Theme');
    await expect(page.locator('#menu-theme-dark')).toContainText('Dark Theme');
    await expect(page.locator('#menu-theme-system')).toContainText('System Theme');

    // Display toggles
    await expect(page.locator('#menu-altitude-colors')).toContainText('Toggle Altitude Colors');
    await expect(page.locator('#menu-3d-track')).toContainText('Toggle 3D Track');
    await expect(page.locator('#menu-toggle-task')).toContainText('Toggle Task');
    await expect(page.locator('#menu-toggle-track')).toContainText('Toggle Track');
  });

  test('should display Sample Flights section', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    await menuButton.click();

    const samplesHeading = page.locator('#samples-heading');
    await expect(samplesHeading).toHaveText('Sample Flights');

    // Sample flight options
    await expect(page.locator('#sample-rohan')).toContainText('Rohan Holt');
    await expect(page.locator('#sample-shane')).toContainText('Shane Duncan');
    await expect(page.locator('#sample-gordon')).toContainText('Gordon Rigg');
    await expect(page.locator('#sample-burkitt')).toContainText('Burkitt');
    await expect(page.locator('#sample-durand')).toContainText('Durand');
    await expect(page.locator('#sample-holtkamp')).toContainText('Holtkamp');
  });

  test('should filter menu items when typing in search', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    await menuButton.click();

    const searchInput = page.locator('#command-dialog input[type="text"]');
    await searchInput.fill('dark');

    // The dark theme option should still be visible
    const darkThemeItem = page.locator('#menu-theme-dark');
    await expect(darkThemeItem).toBeVisible();
  });

  test('should close dialog when clicking outside', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    const commandDialog = page.locator('#command-dialog');

    await menuButton.click();
    await expect(commandDialog).toHaveAttribute('open');

    // Click the dialog backdrop (the dialog element itself)
    await commandDialog.click({ position: { x: 10, y: 10 } });

    // Dialog should close
    await expect(commandDialog).not.toHaveAttribute('open');
  });

  test('should close dialog when pressing Escape', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    const commandDialog = page.locator('#command-dialog');

    await menuButton.click();
    await expect(commandDialog).toHaveAttribute('open');

    await page.keyboard.press('Escape');

    await expect(commandDialog).not.toHaveAttribute('open');
  });
});

test.describe('Import Task Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analysis.html');
  });

  test('should open import task dialog from command menu', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    await menuButton.click();

    const importTaskItem = page.locator('#menu-import-task');
    await importTaskItem.click();

    const importDialog = page.locator('#import-task-dialog');
    await expect(importDialog).toHaveAttribute('open');
  });

  test('should have task code input field', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Menu/i });
    await menuButton.click();

    const importTaskItem = page.locator('#menu-import-task');
    await importTaskItem.click();

    const taskInput = page.locator('#import-task-input');
    await expect(taskInput).toBeVisible();
    await expect(taskInput).toHaveAttribute('placeholder', /Enter task code/i);
  });
});
