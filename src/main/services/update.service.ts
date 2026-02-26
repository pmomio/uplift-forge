import { app, BrowserWindow, shell } from 'electron';
import { gt, valid } from 'semver';
import { Channels } from '../../shared/channels.js';
import type { UpdateInfo } from '../../shared/types.js';

const REPO_OWNER = 'parijatmukherjee';
const REPO_NAME = 'uplift-forge';
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const INITIAL_DELAY_MS = 30 * 1000; // 30 seconds after app ready

const PLATFORM_EXTENSIONS: Record<string, string[]> = {
  darwin: ['.dmg', '.zip'],
  win32: ['.exe', '.nupkg'],
  linux: ['.AppImage', '.deb', '.zip'],
};

let cachedInfo: UpdateInfo | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let timeoutId: ReturnType<typeof setTimeout> | null = null;

function emitUpdateStatus(info: UpdateInfo): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(Channels.UPDATE_STATUS, info);
  }
}

function pickAsset(assets: Array<{ name: string; browser_download_url: string }>): string | null {
  const extensions = PLATFORM_EXTENSIONS[process.platform] ?? [];
  for (const ext of extensions) {
    const match = assets.find((a) => a.name.endsWith(ext));
    if (match) return match.browser_download_url;
  }
  return null;
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = app.getVersion();
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      { headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': `uplift-forge/${currentVersion}` } },
    );

    if (!res.ok) {
      cachedInfo = { currentVersion, latestVersion: null, updateAvailable: false, releaseUrl: null, releaseNotes: null, downloadUrl: null };
      return cachedInfo;
    }

    const data = (await res.json()) as {
      tag_name: string;
      html_url: string;
      body: string | null;
      assets: Array<{ name: string; browser_download_url: string }>;
    };

    const tagVersion = data.tag_name.replace(/^v/, '');
    const latestVersion = valid(tagVersion);

    if (!latestVersion) {
      cachedInfo = { currentVersion, latestVersion: null, updateAvailable: false, releaseUrl: data.html_url, releaseNotes: data.body, downloadUrl: null };
      return cachedInfo;
    }

    const updateAvailable = gt(latestVersion, currentVersion);
    const downloadUrl = pickAsset(data.assets);

    cachedInfo = { currentVersion, latestVersion, updateAvailable, releaseUrl: data.html_url, releaseNotes: data.body, downloadUrl };

    if (updateAvailable) {
      emitUpdateStatus(cachedInfo);
    }

    return cachedInfo;
  } catch {
    cachedInfo = { currentVersion, latestVersion: null, updateAvailable: false, releaseUrl: null, releaseNotes: null, downloadUrl: null };
    return cachedInfo;
  }
}

export function getCachedUpdateInfo(): UpdateInfo | null {
  return cachedInfo;
}

export async function downloadUpdate(): Promise<void> {
  const url = cachedInfo?.downloadUrl ?? cachedInfo?.releaseUrl;
  if (!url) throw new Error('No download URL available');
  await shell.openExternal(url);
}

export function startPeriodicCheck(): void {
  if (intervalId) return;
  timeoutId = setTimeout(() => {
    checkForUpdates();
    intervalId = setInterval(checkForUpdates, CHECK_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}

export function stopPeriodicCheck(): void {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
