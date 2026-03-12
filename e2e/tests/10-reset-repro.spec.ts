import { test, expect, _electron } from '@playwright/test';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { JiraMockServer } from '../fixtures/jira-mock-server';
import { loginAndOnboard } from '../helpers/app-helpers';

const APP_EXECUTABLE = process.platform === 'darwin'
  ? join(__dirname, '../../out/Uplift Forge-darwin-arm64/Uplift Forge.app/Contents/MacOS/uplift-forge')
  : join(__dirname, '../../out/uplift-forge-linux-x64/uplift-forge');

test.describe('Reset & Demo Mode Repro', () => {
  let userDataDir: string;
  let jiraMock: JiraMockServer;

  test.beforeEach(async () => {
    userDataDir = mkdtempSync(join(tmpdir(), 'uplift-reset-e2e-'));
    jiraMock = new JiraMockServer();
    await jiraMock.start();
  });

  test.afterEach(async () => {
    await jiraMock.stop();
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  });

  test('Reset App -> Restart should show login screen with Demo button', async () => {
    const electronApp = await _electron.launch({
      executablePath: APP_EXECUTABLE,
      args: [`--user-data-dir=${userDataDir}`, '--headless'],
    });
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // 1. Setup initial state (Persona: EM)
    await loginAndOnboard(window, jiraMock.baseUrl, 'engineering_manager');
    await expect(window.locator('aside')).toBeVisible({ timeout: 15_000 });

    // 2. Click Reset App
    const resetBtn = window.locator('aside >> text=Reset App');
    await resetBtn.click();

    // 3. App should exit. Wait for it to close.
    await window.waitForTimeout(2000);
    await electronApp.close().catch(() => {});

    // 4. Manually reopen the app with the SAME userDataDir
    const newApp = await _electron.launch({
      executablePath: APP_EXECUTABLE,
      args: [`--user-data-dir=${userDataDir}`, '--headless'],
    });

    const newWindow = await newApp.firstWindow();
    await newWindow.waitForLoadState('domcontentloaded');

    // 5. Verify it shows the login screen with "Try Demo Mode" button
    await expect(newWindow.locator('text=Connect & Continue')).toBeVisible({ timeout: 15_000 });
    await expect(newWindow.locator('text=Try Demo Mode')).toBeVisible();
    await expect(newWindow.locator('aside')).not.toBeVisible();
    
    await newApp.close();
  });

  test('Reset -> Demo Mode -> Onboarding should be required', async () => {
    const electronApp = await _electron.launch({
      executablePath: APP_EXECUTABLE,
      args: [`--user-data-dir=${userDataDir}`, '--headless'],
    });
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // 1. Setup initial state as Individual persona
    await loginAndOnboard(window, jiraMock.baseUrl, 'individual');
    await expect(window.locator('aside >> text=Individual Metrics')).toBeVisible();

    // 2. Click Reset App
    await window.locator('aside >> text=Reset App').click();
    
    // 3. Wait for app to close
    await electronApp.close().catch(() => {});

    // 4. Reopen app
    const newApp = await _electron.launch({
      executablePath: APP_EXECUTABLE,
      args: [`--user-data-dir=${userDataDir}`, '--headless'],
    });

    const newWindow = await newApp.firstWindow();
    await newWindow.waitForLoadState('domcontentloaded');

    // 5. Click "Try Demo Mode"
    await newWindow.click('text=Try Demo Mode');

    // 6. Verify it takes us to Onboarding (Welcome step), NOT directly to dashboard
    await expect(newWindow.locator('text=Welcome to Uplift Forge')).toBeVisible({ timeout: 15_000 });
    
    await newApp.close();
  });
});
