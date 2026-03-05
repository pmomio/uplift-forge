import { test, expect } from '../fixtures/electron.fixture';
import { loginAndOnboard, navigateTo } from '../helpers/app-helpers';

test.describe('Navigation & Sidebar', () => {
  test('Engineering Manager sees all 6 tabs', async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');

    // Wait for sidebar to be visible
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    await expect(window.locator('aside >> text=Home')).toBeVisible();
    await expect(window.locator('aside >> text=Eng. Attribution')).toBeVisible();
    await expect(window.locator('aside >> text=Team Metrics')).toBeVisible();
    await expect(window.locator('aside >> text=Individual Metrics')).toBeVisible();
    await expect(window.locator('aside >> text=Epic Tracker')).toBeVisible();
    await expect(window.locator('aside >> text=Settings')).toBeVisible();
  });

  test('Individual Contributor sees only 3 tabs', async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'individual');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    await expect(window.locator('aside >> text=Home')).toBeVisible();
    await expect(window.locator('aside >> text=Individual Metrics')).toBeVisible();
    await expect(window.locator('aside >> text=Settings')).toBeVisible();

    // These should NOT be visible
    await expect(window.locator('aside >> text=Eng. Attribution')).not.toBeVisible();
    await expect(window.locator('aside >> text=Team Metrics')).not.toBeVisible();
    await expect(window.locator('aside >> text=Epic Tracker')).not.toBeVisible();
  });

  test('Management sees 5 tabs', async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'management');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    await expect(window.locator('aside >> text=Home')).toBeVisible();
    await expect(window.locator('aside >> text=Eng. Attribution')).toBeVisible();
    await expect(window.locator('aside >> text=Team Metrics')).toBeVisible();
    await expect(window.locator('aside >> text=Epic Tracker')).toBeVisible();
    await expect(window.locator('aside >> text=Settings')).toBeVisible();

    // These should NOT be visible
    await expect(window.locator('aside >> text=Individual Metrics')).not.toBeVisible();
  });

  test('Delivery Manager sees 5 tabs', async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'delivery_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    await expect(window.locator('aside >> text=Home')).toBeVisible();
    await expect(window.locator('aside >> text=Team Metrics')).toBeVisible();
    await expect(window.locator('aside >> text=Epic Tracker')).toBeVisible();
    await expect(window.locator('aside >> text=Eng. Attribution')).toBeVisible();
    await expect(window.locator('aside >> text=Settings')).toBeVisible();

    // This should NOT be visible
    await expect(window.locator('aside >> text=Individual Metrics')).not.toBeVisible();
  });

  test('clicking a tab switches active content', async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    // Navigate to Settings
    await navigateTo(window, 'Settings');
    // ConfigPanel should be visible (it has tabs like General, Metrics, etc.)
    await expect(window.locator('text=General')).toBeVisible({ timeout: 10_000 });

    // Navigate to Eng. Attribution
    await navigateTo(window, 'Eng. Attribution');
    await expect(window.locator('text=Engineering Attribution')).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar shows project name and user email', async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    // Project name from mock
    await expect(window.locator('aside >> text=Test Project')).toBeVisible({ timeout: 10_000 });

    // User email from login
    await expect(window.locator('aside >> text=test@example.com')).toBeVisible();
  });
});
