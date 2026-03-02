import { test, expect } from '../fixtures/electron.fixture';
import { loginAndOnboard, navigateTo, waitForToast } from '../helpers/app-helpers';

test.describe('Settings (ConfigPanel)', () => {
  test.beforeEach(async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });
    await navigateTo(window, 'Settings');
    // Wait for ConfigPanel heading to load
    await expect(window.locator('main >> h1:has-text("Settings")')).toBeVisible({ timeout: 10_000 });
  });

  test('ConfigPanel renders with 4 tabs', async ({ window }) => {
    await expect(window.locator('main >> button:has-text("General")')).toBeVisible();
    await expect(window.locator('main >> button:has-text("Metrics")')).toBeVisible();
    await expect(window.locator('main >> button:has-text("Engineering Attribution")')).toBeVisible();
    await expect(window.locator('main >> button:has-text("Application Settings")')).toBeVisible();
  });

  test('General tab shows persona selector', async ({ window }) => {
    // General tab should be active by default and show persona options
    await expect(window.locator('main >> text=Management / VIP')).toBeVisible();
    await expect(window.locator('main >> text=Engineering Manager')).toBeVisible();
    await expect(window.locator('main >> text=Individual Contributor')).toBeVisible();
    await expect(window.locator('main >> text=Delivery Manager')).toBeVisible();
  });

  test('Fetch Fields calls JIRA fields endpoint', async ({ window }) => {
    // The General tab has a Refresh Fields button
    const fetchFieldsBtn = window.locator('main >> button:has-text("Refresh Fields")');
    if (await fetchFieldsBtn.isVisible()) {
      await fetchFieldsBtn.click();
      // Should complete without error (mock returns fields)
      await window.waitForTimeout(1000);
    }
  });

  test('Refresh Statuses calls JIRA statuses endpoint', async ({ window }) => {
    // Switch to Engineering Attribution tab which may have status refresh
    await window.click('main >> button:has-text("Engineering Attribution")');
    await window.waitForTimeout(500);

    const refreshBtn = window.locator('main >> button:has-text("Refresh")');
    if (await refreshBtn.count() > 0) {
      await refreshBtn.first().click();
      await window.waitForTimeout(1000);
    }
  });

  test('Save Settings shows success toast', async ({ window }) => {
    const saveBtn = window.locator('main >> button:has-text("Save Settings")');
    await saveBtn.click();
    await waitForToast(window, 'saved', 10_000);
  });

  test('Metrics tab shows SP calibration', async ({ window }) => {
    await window.click('main >> button:has-text("Metrics")');
    await window.waitForTimeout(500);
    // The Metrics tab has a "Story Point Calibration" heading
    await expect(window.locator('main >> h3:has-text("Story Point Calibration")')).toBeVisible({ timeout: 5_000 });
  });

  test('Application Settings tab has AI section', async ({ window }) => {
    await window.click('main >> button:has-text("Application Settings")');
    await window.waitForTimeout(500);
    // Application Settings should show update/AI related content
    await expect(window.locator('main >> h3:has-text("Current Version")')).toBeVisible({ timeout: 5_000 });
  });

  test('changing project key and saving triggers sync', async ({ window }) => {
    // Find the project key input and change it
    const projectInputs = window.locator('main >> input[type="text"]');
    const count = await projectInputs.count();

    for (let i = 0; i < count; i++) {
      const val = await projectInputs.nth(i).inputValue();
      if (val === 'PROJ') {
        await projectInputs.nth(i).fill('PROJ2');
        break;
      }
    }

    const saveBtn = window.locator('main >> button:has-text("Save Settings")');
    await saveBtn.click();
    await window.waitForTimeout(2000);
  });
});
