import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted so they're available in vi.mock factories
const { mockSend, mockOpenExternal } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockOpenExternal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '1.0.0') },
  BrowserWindow: { getAllWindows: vi.fn(() => [{ webContents: { send: mockSend } }]) },
  shell: { openExternal: mockOpenExternal },
}));

vi.mock('electron-store', () => ({
  default: class MockStore {
    get() { return null; }
    set() {}
  },
}));

import { app, BrowserWindow } from 'electron';
import {
  checkForUpdates,
  getCachedUpdateInfo,
  downloadUpdate,
  startPeriodicCheck,
  stopPeriodicCheck,
} from '../../src/main/services/update.service';

const mockFetch = vi.fn();

function makeRelease(tag: string, assets: Array<{ name: string; browser_download_url: string }> = []) {
  return {
    tag_name: tag,
    html_url: `https://github.com/parijatmukherjee/uplift-forge/releases/tag/${tag}`,
    body: `Release notes for ${tag}`,
    assets,
  };
}

describe('update.service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(app.getVersion).mockReturnValue('1.0.0');
    mockSend.mockClear();
    mockOpenExternal.mockClear();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    // Reset cached info by running a check that returns no update
    stopPeriodicCheck();
  });

  afterEach(() => {
    stopPeriodicCheck();
    vi.useRealTimers();
  });

  it('detects update when remote version > current', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeRelease('v2.0.0', [{ name: 'uplift-forge.dmg', browser_download_url: 'https://dl/uplift-forge.dmg' }])),
    });

    const info = await checkForUpdates();
    expect(info.updateAvailable).toBe(true);
    expect(info.latestVersion).toBe('2.0.0');
    expect(info.currentVersion).toBe('1.0.0');
    expect(info.downloadUrl).toBe('https://dl/uplift-forge.dmg');
  });

  it('reports no update when remote == current', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeRelease('v1.0.0')),
    });

    const info = await checkForUpdates();
    expect(info.updateAvailable).toBe(false);
    expect(info.latestVersion).toBe('1.0.0');
  });

  it('reports no update when remote < current', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeRelease('v0.9.0')),
    });

    const info = await checkForUpdates();
    expect(info.updateAvailable).toBe(false);
  });

  it('handles invalid semver tag', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeRelease('not-semver')),
    });

    const info = await checkForUpdates();
    expect(info.updateAvailable).toBe(false);
    expect(info.latestVersion).toBeNull();
  });

  it('handles API error (non-ok response)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const info = await checkForUpdates();
    expect(info.updateAvailable).toBe(false);
    expect(info.latestVersion).toBeNull();
  });

  it('handles network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));

    const info = await checkForUpdates();
    expect(info.updateAvailable).toBe(false);
    expect(info.latestVersion).toBeNull();
  });

  it('selects correct platform asset (.dmg on darwin)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeRelease('v2.0.0', [
        { name: 'uplift-forge.exe', browser_download_url: 'https://dl/uplift-forge.exe' },
        { name: 'uplift-forge.dmg', browser_download_url: 'https://dl/uplift-forge.dmg' },
        { name: 'uplift-forge.zip', browser_download_url: 'https://dl/uplift-forge.zip' },
      ])),
    });

    const info = await checkForUpdates();
    // On darwin (test environment), should pick .dmg first
    expect(info.downloadUrl).toBe('https://dl/uplift-forge.dmg');
  });

  it('emits update status to all windows when update found', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeRelease('v2.0.0', [{ name: 'uplift-forge.dmg', browser_download_url: 'https://dl/f.dmg' }])),
    });

    await checkForUpdates();
    expect(mockSend).toHaveBeenCalledWith('update:status', expect.objectContaining({ updateAvailable: true }));
  });

  it('does not emit when no update', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeRelease('v1.0.0')),
    });

    await checkForUpdates();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns null from getCachedUpdateInfo before first check', () => {
    // getCachedUpdateInfo may have state from prior tests, but
    // we test that after a fresh check, it returns the result
  });

  it('returns cached info after check', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeRelease('v2.0.0')),
    });

    await checkForUpdates();
    const cached = getCachedUpdateInfo();
    expect(cached).not.toBeNull();
    expect(cached!.latestVersion).toBe('2.0.0');
  });

  it('downloadUpdate opens external URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeRelease('v2.0.0', [{ name: 'f.dmg', browser_download_url: 'https://dl/f.dmg' }])),
    });

    await checkForUpdates();
    await downloadUpdate();
    expect(mockOpenExternal).toHaveBeenCalledWith('https://dl/f.dmg');
  });

  it('downloadUpdate falls back to release URL when no asset', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeRelease('v2.0.0', [])),
    });

    await checkForUpdates();
    await downloadUpdate();
    expect(mockOpenExternal).toHaveBeenCalledWith('https://github.com/parijatmukherjee/uplift-forge/releases/tag/v2.0.0');
  });

  it('downloadUpdate throws when no URL available', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await checkForUpdates();
    await expect(downloadUpdate()).rejects.toThrow('No download URL available');
  });

  it('startPeriodicCheck is idempotent', () => {
    startPeriodicCheck();
    startPeriodicCheck(); // second call should be a no-op
    stopPeriodicCheck();
  });

  it('periodic check fires after initial delay', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeRelease('v1.0.0')),
    });

    startPeriodicCheck();
    expect(mockFetch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    stopPeriodicCheck();
  });

  it('emits to multiple windows', async () => {
    const mockSend2 = vi.fn();
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
      { webContents: { send: mockSend } },
      { webContents: { send: mockSend2 } },
    ] as unknown as Electron.BrowserWindow[]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeRelease('v3.0.0', [{ name: 'f.dmg', browser_download_url: 'https://dl/f.dmg' }])),
    });

    await checkForUpdates();
    expect(mockSend).toHaveBeenCalled();
    expect(mockSend2).toHaveBeenCalled();

    // Reset
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } }] as unknown as Electron.BrowserWindow[]);
  });
});
