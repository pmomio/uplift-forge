import { existsSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

const APP_PATH = resolve(__dirname, '../out/Uplift Forge-darwin-arm64/Uplift Forge.app');
const SRC_DIR = resolve(__dirname, '../src');

function getNewestMtime(dir: string): number {
  try {
    // Use find to get the newest file mtime in src/
    const output = execSync(`find "${dir}" -type f -newer "${APP_PATH}" | head -1`, {
      encoding: 'utf-8',
      timeout: 10_000,
    }).trim();
    return output.length > 0 ? Date.now() : 0;
  } catch {
    return Date.now(); // If find fails, assume stale
  }
}

export default async function globalSetup() {
  const appExists = existsSync(APP_PATH);

  if (appExists) {
    // Check if any src file is newer than the app binary
    const srcNewer = getNewestMtime(SRC_DIR) > 0;
    if (!srcNewer) {
      console.log('[e2e] Packaged app is up-to-date, skipping build.');
      return;
    }
    console.log('[e2e] Source files changed since last package, rebuilding...');
  } else {
    console.log('[e2e] Packaged app not found, building...');
  }

  console.log('[e2e] Running: npx electron-forge package');
  execSync('npx electron-forge package', {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
    timeout: 300_000, // 5 min
  });

  if (!existsSync(APP_PATH)) {
    throw new Error(`[e2e] Build completed but app not found at: ${APP_PATH}`);
  }
  console.log('[e2e] Package complete.');
}
