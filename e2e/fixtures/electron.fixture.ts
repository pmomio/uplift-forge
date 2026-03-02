/**
 * Playwright test fixture that launches the real Electron app
 * with an isolated user-data directory and a JIRA mock server.
 */
import { test as base, type ElectronApplication, type Page } from '@playwright/test';
import { _electron } from '@playwright/test';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { JiraMockServer } from './jira-mock-server';

const APP_EXECUTABLE = join(
  __dirname,
  '../../out/Uplift Forge-darwin-arm64/Uplift Forge.app/Contents/MacOS/uplift-forge',
);

export interface TestFixtures {
  userDataDir: string;
  jiraMock: JiraMockServer;
  electronApp: ElectronApplication;
  window: Page;
}

export const test = base.extend<TestFixtures>({
  // Isolated temp directory for electron-store data
  userDataDir: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'uplift-e2e-'));
    await use(dir);
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  },

  // JIRA mock HTTP server
  jiraMock: async ({}, use) => {
    const mock = new JiraMockServer();
    await mock.start();
    await use(mock);
    await mock.stop();
  },

  // Electron app instance
  electronApp: async ({ userDataDir }, use) => {
    const app = await _electron.launch({
      executablePath: APP_EXECUTABLE,
      args: [`--user-data-dir=${userDataDir}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });
    await use(app);
    await app.close();
  },

  // First browser window with DOM loaded
  window: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await use(window);
  },
});

export { expect } from '@playwright/test';
