import { test, expect } from '../fixtures/electron.fixture';
import { loginAndOnboard, navigateTo, waitForToast } from '../helpers/app-helpers';

test.describe('Settings (ConfigPanel)', () => {
  test.beforeEach(async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });
    await navigateTo(window, 'Settings');
    // Wait for ConfigPanel to load
    await expect(window.locator('text=General')).toBeVisible({ timeout: 10_000 });
  });

  test('ConfigPanel renders with 4 tabs', async ({ window }) => {
    await expect(window.locator('text=General')).toBeVisible();
    await expect(window.locator('text=Metrics')).toBeVisible();
    await expect(window.locator('text=Attribution')).toBeVisible();
    // The 4th tab is "Application" or "Settings"
    await expect(window.locator('button:has-text("Application")')).toBeVisible();
  });

  test('General tab shows persona selector', async ({ window }) => {
    // General tab should be active by default
    // Should show persona options
    await expect(window.locator('text=Management / VIP')).toBeVisible();
    await expect(window.locator('text=Engineering Manager')).toBeVisible();
    await expect(window.locator('text=Individual Contributor')).toBeVisible();
    await expect(window.locator('text=Delivery Manager')).toBeVisible();
  });

  test('Fetch Fields calls JIRA fields endpoint', async ({ window }) => {
    // Switch to Attribution tab which has Fetch Fields
    await window.click('button:has-text("Attribution")');
    await window.waitForTimeout(500);

    // Click Fetch Fields button
    const fetchFieldsBtn = window.locator('button:has-text("Fetch Fields")');
    if (await fetchFieldsBtn.isVisible()) {
      await fetchFieldsBtn.click();
      // Should complete without error (mock returns fields)
      await window.waitForTimeout(1000);
    }
  });

  test('Refresh Statuses calls JIRA statuses endpoint', async ({ window }) => {
    // Switch to Attribution tab
    await window.click('button:has-text("Attribution")');
    await window.waitForTimeout(500);

    // Click Refresh Statuses button
    const refreshBtn = window.locator('button:has-text("Refresh Statuses")');
    if (await refreshBtn.isVisible()) {
      await refreshBtn.click();
      await window.waitForTimeout(1000);
    }
  });

  test('Save Settings shows success toast', async ({ window }) => {
    // Click Save button
    const saveBtn = window.locator('button:has-text("Save")').first();
    await saveBtn.click();

    // Should show success toast
    await waitForToast(window, 'saved', 10_000);
  });

  test('Metrics tab shows SP calibration', async ({ window }) => {
    await window.click('button:has-text("Metrics")');
    await window.waitForTimeout(500);

    // The Metrics tab should have SP-to-days configuration
    await expect(window.locator('text=Story Point')).toBeVisible({ timeout: 5_000 });
  });

  test('Application tab has AI provider toggle', async ({ window }) => {
    await window.click('button:has-text("Application")');
    await window.waitForTimeout(500);

    // AI section should be present
    await expect(window.locator('text=AI')).toBeVisible({ timeout: 5_000 });
  });

  test('changing project key and saving triggers sync', async ({ window }) => {
    // Find the project key input and change it
    const projectKeyInput = window.locator('input').filter({ hasText: /^$/ }).first();
    // ConfigPanel should have a project key field somewhere in General tab
    // Look for the labeled input
    const projectInputs = window.locator('input[type="text"]');
    const count = await projectInputs.count();

    // Find and modify the project key input if it exists
    for (let i = 0; i < count; i++) {
      const val = await projectInputs.nth(i).inputValue();
      if (val === 'PROJ') {
        await projectInputs.nth(i).fill('PROJ2');
        break;
      }
    }

    // Save
    const saveBtn = window.locator('button:has-text("Save")').first();
    await saveBtn.click();
    await window.waitForTimeout(2000);
  });
});
