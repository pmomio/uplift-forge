/**
 * Reusable helper functions for common e2e operations.
 */
import type { Page } from '@playwright/test';

interface LoginOptions {
  baseUrl: string;
  email?: string;
  apiToken?: string;
}

/**
 * Fill and submit the login form via the UI.
 * The baseUrl should point to the JIRA mock server.
 */
export async function loginViaUI(
  window: Page,
  { baseUrl, email = 'test@example.com', apiToken = 'fake-api-token' }: LoginOptions,
): Promise<void> {
  // Wait for the login page to be visible
  await window.waitForSelector('text=Connect & Continue', { timeout: 15_000 });

  // Fill fields
  await window.fill('input[placeholder*="your-org.atlassian.net"]', baseUrl);
  await window.fill('input[placeholder*="you@example.com"]', email);
  await window.fill('input[placeholder*="API token"]', apiToken);

  // Toggle consent checkbox
  const consentBtn = window.locator('button').filter({ has: window.locator('svg.lucide-check') }).first();
  await consentBtn.click();

  // Click Connect
  await window.click('text=Connect & Continue');
}

interface OnboardingOptions {
  persona?: 'management' | 'engineering_manager' | 'individual' | 'delivery_manager';
  projectKey?: string;
}

/**
 * Complete the onboarding wizard from the Welcome step through to the final step.
 */
export async function completeOnboardingViaUI(
  window: Page,
  { persona = 'engineering_manager', projectKey = 'PROJ' }: OnboardingOptions = {},
): Promise<void> {
  // Step 0: Welcome — click Continue
  await window.waitForSelector('text=Welcome to Uplift Forge', { timeout: 15_000 });
  await window.click('text=Continue');

  // Step 1: Persona selection
  await window.waitForSelector('text=What\'s your role?', { timeout: 10_000 });

  const personaLabels: Record<string, string> = {
    management: 'Management / VIP',
    engineering_manager: 'Engineering Manager / VP',
    individual: 'Individual Contributor',
    delivery_manager: 'Delivery Manager',
  };
  await window.click(`text=${personaLabels[persona]}`);
  await window.click('text=Continue');

  // Step 2: Project setup (may be skipped if existing project)
  // Try to detect if the project step appears
  try {
    await window.waitForSelector('text=Connect your JIRA project', { timeout: 3_000 });
    // Clear and fill project key
    const projectInput = window.locator('input[placeholder*="PROJ"]');
    await projectInput.fill(projectKey);
    await window.click('text=Continue');
  } catch {
    // Project step skipped (existing user path) — no action needed
  }

  // Final step: "Start Using Uplift Forge"
  await window.waitForSelector('text=You\'re all set!', { timeout: 10_000 });
  await window.click('text=Start Using Uplift Forge');
}

/**
 * Login + complete onboarding in one call.
 */
export async function loginAndOnboard(
  window: Page,
  jiraMockBaseUrl: string,
  persona: OnboardingOptions['persona'] = 'engineering_manager',
): Promise<void> {
  await loginViaUI(window, { baseUrl: jiraMockBaseUrl });

  // Wait for navigation past login
  await window.waitForSelector('text=Welcome to Uplift Forge', { timeout: 15_000 });

  await completeOnboardingViaUI(window, { persona });
}

/**
 * Click a sidebar tab by its label text.
 */
export async function navigateTo(window: Page, tabLabel: string): Promise<void> {
  await window.click(`aside >> text=${tabLabel}`);
  // Small delay for page transition animation
  await window.waitForTimeout(300);
}

/**
 * Wait for a react-hot-toast notification containing the given text.
 */
export async function waitForToast(window: Page, text: string, timeout = 10_000): Promise<void> {
  await window.waitForSelector(`text=${text}`, { timeout });
}
