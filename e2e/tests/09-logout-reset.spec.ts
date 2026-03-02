import { test, expect } from '../fixtures/electron.fixture';
import { loginAndOnboard, loginViaUI } from '../helpers/app-helpers';

test.describe('Logout & Reset', () => {
  test('logout returns to login page', async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    // Click the logout button (LogOut icon in sidebar)
    const logoutBtn = window.locator('aside >> button[title="Sign out"]');
    await logoutBtn.click();

    // Should return to login page
    await expect(window.locator('text=Connect & Continue')).toBeVisible({ timeout: 15_000 });
  });

  test('auth cleared after logout', async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    // Logout
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

    // Click "Reset App" link in sidebar
    const resetBtn = window.locator('aside >> text=Reset App');
    await resetBtn.click();

    // Should return to login page
    await expect(window.locator('text=Connect & Continue')).toBeVisible({ timeout: 15_000 });
  });

  test('config cleared after reset — onboarding shows on next login', async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    // Reset app
    const resetBtn = window.locator('aside >> text=Reset App');
    await resetBtn.click();
    await expect(window.locator('text=Connect & Continue')).toBeVisible({ timeout: 15_000 });

    // Login again
    await loginViaUI(window, { baseUrl: jiraMock.baseUrl });

    // Should show onboarding wizard (persona was cleared by reset)
    await expect(window.locator('text=Welcome to Uplift Forge')).toBeVisible({ timeout: 15_000 });
  });
});
