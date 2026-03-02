import { test, expect } from '../fixtures/electron.fixture';
import { loginAndOnboard, navigateTo, waitForToast } from '../helpers/app-helpers';

test.describe('Engineering Attribution', () => {
  test.beforeEach(async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });
    await navigateTo(window, 'Eng. Attribution');
    await expect(window.locator('text=Engineering Attribution')).toBeVisible({ timeout: 10_000 });
  });

  test('empty state with "No tickets" when cache empty', async ({ window }) => {
    // On a fresh app with no synced tickets, should show empty state
    await expect(window.locator('text=No tickets in cache')).toBeVisible({ timeout: 10_000 });
    await expect(window.locator('text=Sync Now')).toBeVisible();
  });

  test('Sync Now fetches tickets from JIRA mock', async ({ window }) => {
    await window.click('text=Sync Now');

    // Wait for syncing to complete (button shows "Syncing...")
    await expect(window.locator('text=Syncing...')).toBeVisible({ timeout: 5_000 });

    // Wait for sync completion
    await expect(window.locator('text=Syncing...')).not.toBeVisible({ timeout: 30_000 });
  });

  test('after sync, table shows ticket rows', async ({ window }) => {
    await window.click('text=Sync Now');

    // Wait for sync to complete and table to render
    await expect(window.locator('text=Syncing...')).not.toBeVisible({ timeout: 30_000 });

    // Should see at least one mock ticket key
    await expect(window.locator('text=PROJ-1')).toBeVisible({ timeout: 10_000 });
  });

  test('success toast with ticket count', async ({ window }) => {
    await window.click('text=Sync Now');

    // Should show a success toast with "Synced X tickets"
    await waitForToast(window, 'Synced', 30_000);
  });

  test('sync failure shows error toast', async ({ window, jiraMock }) => {
    // Make the search endpoint return an error
    jiraMock.mockRoute('/rest/api/3/search', 500, { errorMessages: ['Server Error'] });

    await window.click('text=Sync Now');

    // Should show error toast
    await waitForToast(window, 'Sync failed', 30_000);
  });

  test('last synced timestamp updates', async ({ window }) => {
    await window.click('text=Sync Now');

    // Wait for sync to finish
    await expect(window.locator('text=Syncing...')).not.toBeVisible({ timeout: 30_000 });

    // Should show "Last synced at" timestamp
    await expect(window.locator('text=Last synced at')).toBeVisible({ timeout: 10_000 });
  });
});
