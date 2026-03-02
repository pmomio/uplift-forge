import { test, expect } from '../fixtures/electron.fixture';
import { loginAndOnboard, navigateTo } from '../helpers/app-helpers';

test.describe('Individual Metrics', () => {
  test.beforeEach(async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    // Sync tickets first
    await navigateTo(window, 'Eng. Attribution');
    await expect(window.locator('text=Engineering Attribution')).toBeVisible({ timeout: 10_000 });
    await window.click('text=Sync Now');
    await expect(window.locator('text=Syncing...')).not.toBeVisible({ timeout: 30_000 });

    // Navigate to Individual Metrics
    await navigateTo(window, 'Individual Metrics');
    await window.waitForTimeout(1000);
  });

  test('per-engineer breakdown visible', async ({ window }) => {
    // Should show individual metrics page header
    await expect(window.locator('text=Individual Metrics')).toBeVisible({ timeout: 10_000 });
  });

  test('engineer KPI cards show values', async ({ window }) => {
    // After sync, should show at least some KPI labels relevant to individuals
    // The page shows per-engineer data with cards
    await expect(window.locator('text=Total Tickets')).toBeVisible({ timeout: 10_000 });
  });

  test('team average comparison row', async ({ window }) => {
    // Individual metrics page shows team averages for comparison
    await expect(window.locator('text=Team Average')).toBeVisible({ timeout: 10_000 });
  });

  test('period selector works', async ({ window }) => {
    // Individual metrics also has period selector
    await expect(window.locator('button:has-text("All Time")')).toBeVisible();

    // Click a different period
    await window.click('button:has-text("Monthly")');
    await window.waitForTimeout(1000);

    // Page should still render without error
    await expect(window.locator('text=Individual Metrics')).toBeVisible();
  });
});
