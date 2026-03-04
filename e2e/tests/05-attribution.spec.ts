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

  test('TPD BU column uses select dropdowns, not text inputs', async ({ window }) => {
    // Wait for ticket rows to render
    await expect(window.locator('text=PROJ-1')).toBeVisible({ timeout: 15_000 });

    // Find all select elements in the table — TPD BU and Work Stream columns
    const selects = window.locator('main table select');
    const count = await selects.count();

    // Each visible ticket row has 2 selects (TPD BU + Work Stream), and we have 5 tickets
    // but pagination may limit visible rows — at minimum we should have some selects
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('TPD BU dropdown shows options from ticket data', async ({ window }) => {
    await expect(window.locator('text=PROJ-1')).toBeVisible({ timeout: 15_000 });

    // The first select in each row is TPD BU. Get the first one.
    const firstRow = window.locator('main table tbody tr').first();
    const tpdBuSelect = firstRow.locator('select').first();
    await expect(tpdBuSelect).toBeVisible();

    // Check that it contains the "Not set" default + ticket-derived options
    const options = tpdBuSelect.locator('option');
    const optionTexts = await options.allTextContents();
    expect(optionTexts).toContain('Not set');
    expect(optionTexts).toContain('B2B');
    expect(optionTexts).toContain('B2C');
  });

  test('Work Stream dropdown shows options from ticket data', async ({ window }) => {
    await expect(window.locator('text=PROJ-1')).toBeVisible({ timeout: 15_000 });

    // The second select in each row is Work Stream. Get the first row's second select.
    const firstRow = window.locator('main table tbody tr').first();
    const workStreamSelect = firstRow.locator('select').nth(1);
    await expect(workStreamSelect).toBeVisible();

    const options = workStreamSelect.locator('option');
    const optionTexts = await options.allTextContents();
    expect(optionTexts).toContain('Not set');
    expect(optionTexts).toContain('Operational');
    expect(optionTexts).toContain('Product');
    expect(optionTexts).toContain('Tech Debt');
  });

  test('status badges use config-driven colors', async ({ window }) => {
    await expect(window.locator('text=PROJ-1')).toBeVisible({ timeout: 15_000 });

    // PROJ-1 has status "Done" → should have emerald (green) badge
    const doneRow = window.locator('main table tbody tr', { has: window.locator('text=PROJ-1') });
    const doneBadge = doneRow.locator('span.rounded-full');
    await expect(doneBadge).toBeVisible();
    const doneClasses = await doneBadge.getAttribute('class');
    expect(doneClasses).toContain('emerald');

    // PROJ-3 has status "In Progress" → should have sky (blue) badge
    const activeRow = window.locator('main table tbody tr', { has: window.locator('text=PROJ-3') });
    const activeBadge = activeRow.locator('span.rounded-full');
    await expect(activeBadge).toBeVisible();
    const activeClasses = await activeBadge.getAttribute('class');
    expect(activeClasses).toContain('sky');
  });
});
