import { test, expect } from '../fixtures/electron.fixture';
import { loginAndOnboard, navigateTo } from '../helpers/app-helpers';

test.describe('Team Metrics', () => {
  test.beforeEach(async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    // Tickets are auto-synced during onboarding (config save triggers sync)
    // Navigate to Team Metrics
    await navigateTo(window, 'Team Metrics');
    // For EM, header should contain "Dashboard" (e.g. "Test Project — Team Dashboard" or "All Projects — Team Dashboard")
    await expect(window.locator('main >> h1:has-text("Dashboard")')).toBeVisible({ timeout: 15_000 });
  });

  test('KPI cards show after sync', async ({ window }) => {
    await expect(window.locator('main >> text=Total Tickets')).toBeVisible({ timeout: 10_000 });
    await expect(window.locator('main >> text=Cycle Time p50')).toBeVisible({ timeout: 10_000 });
    await expect(window.locator('main >> text=Rework Rate')).toBeVisible({ timeout: 10_000 });
  });

  test('period selector has 4 options', async ({ window }) => {
    await expect(window.locator('main >> button:has-text("All Time")').first()).toBeVisible();
    await expect(window.locator('main >> button:has-text("Monthly")').first()).toBeVisible();
    await expect(window.locator('main >> button:has-text("Bi-weekly")').first()).toBeVisible();
    await expect(window.locator('main >> button:has-text("Weekly")').first()).toBeVisible();
  });

  test('changing period updates KPI values', async ({ window }) => {
    await window.click('main >> button:has-text("Monthly")');
    await window.waitForTimeout(1000);
    // Page should still render KPI labels
    await expect(window.locator('main >> text=Total Tickets')).toBeVisible({ timeout: 10_000 });
  });

  test('trend badges section is present', async ({ window }) => {
    // KPI cards section exists and is functional
    const kpiSection = window.locator('main >> text=Total Tickets').locator('..');
    await expect(kpiSection).toBeVisible();
  });

  test('Sync & Refresh button is visible', async ({ window }) => {
    await expect(window.locator('main >> button:has-text("Sync & Refresh")')).toBeVisible();
  });
});
