import { test, expect } from '../fixtures/electron.fixture';
import { loginAndOnboard, loginViaUI } from '../helpers/app-helpers';

test.describe('Logout & Reset', () => {
  test('logout returns to login page', async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    const logoutBtn = window.locator('aside >> button[title="Sign out"]');
    await logoutBtn.click();

    await expect(window.locator('text=Connect & Continue')).toBeVisible({ timeout: 15_000 });
  });

  test('auth cleared after logout', async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    const logoutBtn = window.locator('aside >> button[title="Sign out"]');
    await logoutBtn.click();
    await expect(window.locator('text=Connect & Continue')).toBeVisible({ timeout: 15_000 });

    // Input fields should be empty (credentials cleared)
    const baseUrlInput = window.locator('input[placeholder*="your-org.atlassian.net"]');
    await expect(baseUrlInput).toHaveValue('');
  });

  test('Reset App returns to login page', async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    const resetBtn = window.locator('aside >> text=Reset App');
    await resetBtn.click();

    await expect(window.locator('text=Connect & Continue')).toBeVisible({ timeout: 15_000 });
  });

  test('after reset and re-login, onboarding or app loads', async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    // Reset app
    const resetBtn = window.locator('aside >> text=Reset App');
    await resetBtn.click();
    await expect(window.locator('text=Connect & Continue')).toBeVisible({ timeout: 15_000 });

    // Login again
    await loginViaUI(window, { baseUrl: jiraMock.baseUrl });

    // After reset, should show either onboarding (if config cleared) or main app
    // Wait for either state to appear
    const onboarding = window.locator('text=Welcome to Uplift Forge');
    const mainApp = window.locator('aside');

    await expect(onboarding.or(mainApp)).toBeVisible({ timeout: 15_000 });
  });
});
