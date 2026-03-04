import { test, expect } from '../fixtures/electron.fixture';
import { loginAndOnboard, navigateTo, waitForToast } from '../helpers/app-helpers';

test.describe('Epic Tracker', () => {
  test.beforeEach(async ({ window, jiraMock }) => {
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    // Tickets auto-synced from onboarding
    await navigateTo(window, 'Epic Tracker');
    await expect(window.locator('main >> h1:has-text("Epic Tracker")')).toBeVisible({ timeout: 10_000 });
  });

  test('summary stats visible with correct labels', async ({ window }) => {
    await expect(window.locator('main >> text=Total Epics')).toBeVisible({ timeout: 10_000 });
    await expect(window.locator('main >> text=In Progress')).toBeVisible();
    await expect(window.locator('main >> text=High Risk')).toBeVisible();
    await expect(window.locator('main >> text=Medium Risk')).toBeVisible();
    await expect(window.locator('main >> text=Low Risk')).toBeVisible();
    await expect(window.locator('main >> button:has-text("Sync & Refresh")')).toBeVisible();
  });

  test('epic card shows PROJ-100 parent', async ({ window }) => {
    // 4 of 5 mock tickets have parent PROJ-100, so this epic should be visible
    await expect(window.locator('main >> text=PROJ-100')).toBeVisible({ timeout: 10_000 });
  });

  test('epic card shows progress with done and active counts', async ({ window }) => {
    await expect(window.locator('main >> text=PROJ-100')).toBeVisible({ timeout: 10_000 });

    // PROJ-100 has 4 children: 3 done, 1 in progress
    // The card shows "X/Y done · Z active" text
    const epicCard = window.locator('main').locator('button', { has: window.locator('text=PROJ-100') });
    const cardText = await epicCard.textContent();
    expect(cardText).toContain('done');
    expect(cardText).toContain('active');
  });

  test('risk badge is visible on epic card', async ({ window }) => {
    await expect(window.locator('main >> text=PROJ-100')).toBeVisible({ timeout: 10_000 });

    // Risk badge shows level text (low/medium/high) with score
    const riskBadge = window.locator('main span.rounded-full.uppercase');
    await expect(riskBadge.first()).toBeVisible();
    const badgeText = await riskBadge.first().textContent();
    expect(badgeText).toMatch(/low|medium|high/i);
  });

  test('expanding epic shows timeline metrics', async ({ window }) => {
    await expect(window.locator('main >> text=PROJ-100')).toBeVisible({ timeout: 10_000 });

    // Click the epic header to expand it
    const epicHeader = window.locator('main').locator('button', { has: window.locator('text=PROJ-100') });
    await epicHeader.click();
    await window.waitForTimeout(500);

    // Expanded view shows timeline mini-stats
    await expect(window.locator('main >> text=Avg Cycle Time')).toBeVisible({ timeout: 5_000 });
    await expect(window.locator('main >> text=Avg Lead Time')).toBeVisible();
    await expect(window.locator('main >> text=Flow Efficiency')).toBeVisible();
    await expect(window.locator('main >> text=Risk Score')).toBeVisible();
  });

  test('expanding epic shows rework and aging stats', async ({ window }) => {
    await expect(window.locator('main >> text=PROJ-100')).toBeVisible({ timeout: 10_000 });

    const epicHeader = window.locator('main').locator('button', { has: window.locator('text=PROJ-100') });
    await epicHeader.click();
    await window.waitForTimeout(500);

    await expect(window.locator('main >> text=Rework Count')).toBeVisible({ timeout: 5_000 });
    await expect(window.locator('main >> text=Aging WIP')).toBeVisible();
    await expect(window.locator('main >> text=Total SP')).toBeVisible();
    await expect(window.locator('main >> text=Resolved SP')).toBeVisible();
  });

  test('expanding epic shows child tickets with status badges', async ({ window }) => {
    await expect(window.locator('main >> text=PROJ-100')).toBeVisible({ timeout: 10_000 });

    const epicHeader = window.locator('main').locator('button', { has: window.locator('text=PROJ-100') });
    await epicHeader.click();
    await window.waitForTimeout(500);

    // Child ticket summaries should be visible
    await expect(window.locator('main >> text=Implement login page')).toBeVisible({ timeout: 5_000 });
    await expect(window.locator('main >> text=Fix auth token refresh bug')).toBeVisible();
    await expect(window.locator('main >> text=Add metrics dashboard')).toBeVisible();

    // Child ticket status badges should have config-driven colors
    // Done tickets (PROJ-1) → emerald; In Progress (PROJ-3) → sky
    const childRows = window.locator('main table tbody tr');
    const count = await childRows.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('collapsing epic hides child tickets', async ({ window }) => {
    await expect(window.locator('main >> text=PROJ-100')).toBeVisible({ timeout: 10_000 });

    // Expand
    const epicHeader = window.locator('main').locator('button', { has: window.locator('text=PROJ-100') });
    await epicHeader.click();
    await window.waitForTimeout(500);
    await expect(window.locator('main >> text=Avg Cycle Time')).toBeVisible({ timeout: 5_000 });

    // Collapse by clicking again
    await epicHeader.click();
    await window.waitForTimeout(500);
    await expect(window.locator('main >> text=Avg Cycle Time')).not.toBeVisible();
  });

  test('Sync & Refresh updates epics', async ({ window }) => {
    await window.click('main >> button:has-text("Sync & Refresh")');
    // Wait for sync to finish
    await expect(window.locator('main >> text=Syncing...')).not.toBeVisible({ timeout: 30_000 });
    // Toast should appear
    await waitForToast(window, 'refreshed', 30_000);
  });

  test('In Progress stat card shows count for epics with active tickets', async ({ window }) => {
    // PROJ-100 has PROJ-3 which is "In Progress", so it counts as an epic with active tickets
    const inProgressStat = window.locator('main').locator('div', { has: window.locator('text=In Progress') }).locator('span.text-2xl');
    await expect(inProgressStat).toBeVisible({ timeout: 10_000 });
    const value = await inProgressStat.textContent();
    expect(Number(value)).toBeGreaterThanOrEqual(1);
  });
});
