import { test, expect } from '../fixtures/electron.fixture';

test.describe('Login Page', () => {
  test('fresh app shows login page', async ({ window }) => {
    await window.waitForSelector('text=Uplift Forge', { timeout: 15_000 });
    await expect(window.locator('text=Connect & Continue')).toBeVisible();
    await expect(window.locator('input[placeholder*="your-org.atlassian.net"]')).toBeVisible();
    await expect(window.locator('input[placeholder*="you@example.com"]')).toBeVisible();
    await expect(window.locator('input[placeholder*="API token"]')).toBeVisible();
  });

  test('submit with empty fields shows error', async ({ window }) => {
    await window.waitForSelector('text=Connect & Continue', { timeout: 15_000 });

    // Check consent first so the button is clickable
    const consentBtn = window.locator('button').filter({ has: window.locator('svg.lucide-check') }).first();
    await consentBtn.click();

    await window.click('text=Connect & Continue');
    await expect(window.locator('text=All fields are required')).toBeVisible();
  });

  test('consent checkbox required — button disabled without it', async ({ window }) => {
    await window.waitForSelector('text=Connect & Continue', { timeout: 15_000 });

    // Without consent, button should have disabled styling (cursor-not-allowed class)
    const connectBtn = window.locator('button', { hasText: 'Connect & Continue' });
    await expect(connectBtn).toBeDisabled();
  });

  test('Privacy Policy modal opens and closes', async ({ window }) => {
    await window.waitForSelector('text=Connect & Continue', { timeout: 15_000 });

    await window.click('text=Privacy Policy');
    await expect(window.locator('h2:has-text("Privacy Policy")')).toBeVisible();
    await expect(window.locator('text=Data Collection & Local Storage')).toBeVisible();

    await window.click('text=Close & Return');
    await expect(window.locator('h2:has-text("Privacy Policy")')).not.toBeVisible();
  });

  test('Terms of Service modal opens and closes', async ({ window }) => {
    await window.waitForSelector('text=Connect & Continue', { timeout: 15_000 });

    await window.click('text=Terms of Service');
    await expect(window.locator('h2:has-text("Terms of Service")')).toBeVisible();
    await expect(window.locator('text=Acceptance')).toBeVisible();

    await window.click('text=Close & Return');
    await expect(window.locator('h2:has-text("Terms of Service")')).not.toBeVisible();
  });

  test('successful login navigates to onboarding wizard', async ({ window, jiraMock }) => {
    await window.waitForSelector('text=Connect & Continue', { timeout: 15_000 });

    // Fill login form
    await window.fill('input[placeholder*="your-org.atlassian.net"]', jiraMock.baseUrl);
    await window.fill('input[placeholder*="you@example.com"]', 'test@example.com');
    await window.fill('input[placeholder*="API token"]', 'fake-token');

    // Toggle consent
    const consentBtn = window.locator('button').filter({ has: window.locator('svg.lucide-check') }).first();
    await consentBtn.click();

    // Submit
    await window.click('text=Connect & Continue');

    // Should navigate to onboarding wizard
    await expect(window.locator('text=Welcome to Uplift Forge')).toBeVisible({ timeout: 15_000 });
  });

  test('invalid JIRA credentials show error', async ({ window, jiraMock }) => {
    await window.waitForSelector('text=Connect & Continue', { timeout: 15_000 });

    // Mock 401 for /myself
    jiraMock.mockRoute('/rest/api/3/myself', 401, { errorMessages: ['Unauthorized'] });

    // Fill login form
    await window.fill('input[placeholder*="your-org.atlassian.net"]', jiraMock.baseUrl);
    await window.fill('input[placeholder*="you@example.com"]', 'bad@example.com');
    await window.fill('input[placeholder*="API token"]', 'bad-token');

    // Toggle consent
    const consentBtn = window.locator('button').filter({ has: window.locator('svg.lucide-check') }).first();
    await consentBtn.click();

    // Submit
    await window.click('text=Connect & Continue');

    // Should show error message
    await expect(window.locator('text=JIRA API error 401')).toBeVisible({ timeout: 15_000 });
    // Should NOT navigate to onboarding
    await expect(window.locator('text=Welcome to Uplift Forge')).not.toBeVisible();
  });

  test('Enter key submits form when consent is checked', async ({ window, jiraMock }) => {
    await window.waitForSelector('text=Connect & Continue', { timeout: 15_000 });

    await window.fill('input[placeholder*="your-org.atlassian.net"]', jiraMock.baseUrl);
    await window.fill('input[placeholder*="you@example.com"]', 'test@example.com');
    await window.fill('input[placeholder*="API token"]', 'fake-token');

    // Toggle consent
    const consentBtn = window.locator('button').filter({ has: window.locator('svg.lucide-check') }).first();
    await consentBtn.click();

    // Press Enter in the token field
    await window.press('input[placeholder*="API token"]', 'Enter');

    // Should navigate to onboarding
    await expect(window.locator('text=Welcome to Uplift Forge')).toBeVisible({ timeout: 15_000 });
  });
});
