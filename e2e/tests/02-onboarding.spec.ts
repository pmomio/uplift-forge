import { test, expect } from '../fixtures/electron.fixture';
import { loginViaUI } from '../helpers/app-helpers';

test.describe('Onboarding Wizard', () => {
  test.beforeEach(async ({ window, jiraMock }) => {
    await loginViaUI(window, { baseUrl: jiraMock.baseUrl });
    await window.waitForSelector('text=Welcome to Uplift Forge', { timeout: 15_000 });
  });

  test('welcome step shows app intro and Continue is enabled', async ({ window }) => {
    await expect(window.locator('text=Welcome to Uplift Forge')).toBeVisible();
    await expect(window.locator('text=Engineering performance platform')).toBeVisible();

    const continueBtn = window.locator('button', { hasText: 'Continue' });
    await expect(continueBtn).toBeEnabled();
  });

  test('persona step shows 4 persona cards', async ({ window }) => {
    await window.click('text=Continue');
    await window.waitForSelector('text=What\'s your role?', { timeout: 10_000 });

    await expect(window.locator('text=Management / VIP')).toBeVisible();
    await expect(window.locator('text=Engineering Manager / VP')).toBeVisible();
    await expect(window.locator('text=Individual Contributor')).toBeVisible();
    await expect(window.locator('text=Delivery Manager')).toBeVisible();
  });

  test('cannot proceed without selecting a persona', async ({ window }) => {
    await window.click('text=Continue');
    await window.waitForSelector('text=What\'s your role?', { timeout: 10_000 });

    // Continue button should be disabled without persona selection
    const continueBtn = window.locator('button', { hasText: 'Continue' });
    await expect(continueBtn).toBeDisabled();
  });

  test('selecting persona enables Continue', async ({ window }) => {
    await window.click('text=Continue');
    await window.waitForSelector('text=What\'s your role?', { timeout: 10_000 });

    await window.click('text=Engineering Manager / VP');

    const continueBtn = window.locator('button', { hasText: 'Continue' });
    await expect(continueBtn).toBeEnabled();
  });

  test('project step appears for new users', async ({ window }) => {
    // Welcome → Continue
    await window.click('text=Continue');
    await window.waitForSelector('text=What\'s your role?', { timeout: 10_000 });

    // Select persona → Continue
    await window.click('text=Engineering Manager / VP');
    await window.click('text=Continue');

    // Project step
    await expect(window.locator('text=Connect your JIRA project')).toBeVisible({ timeout: 10_000 });
    await expect(window.locator('input[placeholder*="PROJ"]')).toBeVisible();
  });

  test('project key auto-uppercases input', async ({ window }) => {
    await window.click('text=Continue');
    await window.waitForSelector('text=What\'s your role?', { timeout: 10_000 });
    await window.click('text=Engineering Manager / VP');
    await window.click('text=Continue');

    await window.waitForSelector('text=Connect your JIRA project', { timeout: 10_000 });
    const input = window.locator('input[placeholder*="PROJ"]');
    await input.fill('myproject');

    // Value should be uppercased
    await expect(input).toHaveValue('MYPROJECT');
  });

  test('final step saves config and shows main app', async ({ window }) => {
    // Welcome → Continue
    await window.click('text=Continue');
    // Persona → select + Continue
    await window.waitForSelector('text=What\'s your role?', { timeout: 10_000 });
    await window.click('text=Engineering Manager / VP');
    await window.click('text=Continue');
    // Project → fill + Continue
    await window.waitForSelector('text=Connect your JIRA project', { timeout: 10_000 });
    await window.locator('input[placeholder*="PROJ"]').fill('PROJ');
    await window.click('text=Continue');
    // Final step
    await window.waitForSelector('text=You\'re all set!', { timeout: 10_000 });
    await expect(window.locator('text=Engineering Manager / VP')).toBeVisible();

    await window.click('text=Start Using Uplift Forge');

    // Should now show main app with sidebar
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });
    await expect(window.locator('aside >> text=Home')).toBeVisible();
  });

  test('back navigation works through all steps', async ({ window }) => {
    // Welcome → Continue
    await window.click('text=Continue');
    await window.waitForSelector('text=What\'s your role?', { timeout: 10_000 });

    // Back to Welcome
    await window.click('text=Back');
    await expect(window.locator('text=Welcome to Uplift Forge')).toBeVisible();

    // Forward again: Welcome → Persona
    await window.click('text=Continue');
    await window.waitForSelector('text=What\'s your role?', { timeout: 10_000 });

    // Select persona + Continue
    await window.click('text=Engineering Manager / VP');
    await window.click('text=Continue');

    // Now on Project step
    await window.waitForSelector('text=Connect your JIRA project', { timeout: 10_000 });

    // Back to Persona
    await window.click('text=Back');
    await expect(window.locator('text=What\'s your role?')).toBeVisible();
  });
});
