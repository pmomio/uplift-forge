import { test, expect } from '../fixtures/electron.fixture';
import { loginAndOnboard, navigateTo, waitForToast } from '../helpers/app-helpers';

test.describe('Engineering Attribution', () => {
  test.beforeEach(async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });
    await navigateTo(window, 'Eng. Attribution');
    await expect(window.locator('main >> h1:has-text("Engineering Attribution")')).toBeVisible({ timeout: 10_000 });
  });

  test('page shows ticket table after auto-sync from onboarding', async ({ window }) => {
    // Config save during onboarding auto-triggers a JIRA sync,
    // so tickets are already in the cache when we navigate here
    await expect(window.locator('text=PROJ-1')).toBeVisible({ timeout: 15_000 });
    await expect(window.locator('main >> text=Sync Now')).toBeVisible();
  });

  test('Sync Now re-fetches tickets from JIRA mock', async ({ window }) => {
    await window.click('main >> text=Sync Now');
    // Wait for sync completion
    await expect(window.locator('main >> text=Syncing...')).not.toBeVisible({ timeout: 30_000 });
    // Tickets should still be displayed
    await expect(window.locator('text=PROJ-1')).toBeVisible({ timeout: 10_000 });
  });

  test('after sync, table shows ticket rows', async ({ window }) => {
    // Tickets already loaded from auto-sync — verify multiple rows
    await expect(window.locator('text=PROJ-1')).toBeVisible({ timeout: 10_000 });
    await expect(window.locator('text=PROJ-2')).toBeVisible();
    await expect(window.locator('text=Implement login page')).toBeVisible();
    await expect(window.locator('text=Fix auth token refresh bug')).toBeVisible();
  });

  test('success toast with ticket count after sync', async ({ window }) => {
    await window.click('main >> text=Sync Now');
    await waitForToast(window, 'Synced', 30_000);
  });

  test('last synced timestamp updates after sync', async ({ window }) => {
    await window.click('main >> text=Sync Now');
    // Wait for sync to finish
    await expect(window.locator('main >> text=Syncing...')).not.toBeVisible({ timeout: 30_000 });
    // Should show "Last synced at" timestamp
    await expect(window.locator('text=Last synced at')).toBeVisible({ timeout: 10_000 });
  });

  test('ticket summary stats are shown', async ({ window }) => {
    // The TicketSummary component shows stats like Avg Hours, Fields Complete
    await expect(window.locator('main >> text=Avg Hours')).toBeVisible({ timeout: 10_000 });
    await expect(window.locator('main >> text=Fields Complete')).toBeVisible();
  });
});
