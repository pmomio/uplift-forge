import { test, expect } from '../fixtures/electron.fixture';
import { loginAndOnboard, navigateTo } from '../helpers/app-helpers';

test.describe('Individual Metrics', () => {
  test.beforeEach(async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    // Tickets auto-synced from onboarding
    await navigateTo(window, 'Individual Metrics');
    await expect(window.locator('main >> h1:has-text("Individual Metrics")')).toBeVisible({ timeout: 10_000 });
  });

  test('page renders with heading', async ({ window }) => {
    await expect(window.locator('main >> h1:has-text("Individual Metrics")')).toBeVisible();
  });

  test('empty state when no tracked engineers configured', async ({ window }) => {
    // Without tracked engineers in config, should show empty state
    await expect(window.locator('main >> text=No tracked engineers configured')).toBeVisible({ timeout: 10_000 });
    await expect(window.locator('main >> text=Settings')).toBeVisible();
  });

  test('period selector is present', async ({ window }) => {
    await expect(window.locator('main >> button:has-text("All Time")').first()).toBeVisible();
    await expect(window.locator('main >> button:has-text("Monthly")').first()).toBeVisible();
  });

  test('period selector works', async ({ window }) => {
    await window.click('main >> button:has-text("Monthly")');
    await window.waitForTimeout(1000);
    // Page should still render without error
    await expect(window.locator('main >> h1:has-text("Individual Metrics")')).toBeVisible();
  });
});
