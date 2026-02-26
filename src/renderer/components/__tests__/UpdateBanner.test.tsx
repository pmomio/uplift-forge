import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UpdateBanner from '../UpdateBanner';
import type { UpdateInfo } from '../../../shared/types';

const noUpdate: UpdateInfo = {
  currentVersion: '1.0.0',
  latestVersion: '1.0.0',
  updateAvailable: false,
  releaseUrl: null,
  releaseNotes: null,
  downloadUrl: null,
};

const hasUpdate: UpdateInfo = {
  currentVersion: '1.0.0',
  latestVersion: '2.0.0',
  updateAvailable: true,
  releaseUrl: 'https://github.com/parijatmukherjee/uplift-forge/releases/tag/v2.0.0',
  releaseNotes: 'Bug fixes',
  downloadUrl: 'https://dl/uplift-forge.dmg',
};

let updateStatusCallback: ((info: unknown) => void) | null = null;

beforeEach(() => {
  updateStatusCallback = null;
  window.api = {
    checkForUpdates: vi.fn().mockResolvedValue(noUpdate),
    downloadUpdate: vi.fn().mockResolvedValue(undefined),
    openExternal: vi.fn().mockResolvedValue(undefined),
    onUpdateStatus: vi.fn((cb: (info: unknown) => void) => {
      updateStatusCallback = cb;
      return () => { updateStatusCallback = null; };
    }),
  } as unknown as typeof window.api;
});

describe('UpdateBanner', () => {
  it('renders nothing when no update available', async () => {
    const { container } = render(<UpdateBanner />);
    await waitFor(() => {
      expect(window.api.checkForUpdates).toHaveBeenCalled();
    });
    expect(container.firstChild).toBeNull();
  });

  it('shows banner when update available on mount', async () => {
    vi.mocked(window.api.checkForUpdates).mockResolvedValue(hasUpdate);
    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByText('2.0.0')).toBeInTheDocument();
    });
    expect(screen.getByText('(current: 1.0.0)')).toBeInTheDocument();
  });

  it('shows banner on push notification', async () => {
    render(<UpdateBanner />);

    await waitFor(() => {
      expect(window.api.checkForUpdates).toHaveBeenCalled();
    });

    // Simulate push from main process
    updateStatusCallback!(hasUpdate);

    await waitFor(() => {
      expect(screen.getByText('2.0.0')).toBeInTheDocument();
    });
  });

  it('displays correct version numbers', async () => {
    vi.mocked(window.api.checkForUpdates).mockResolvedValue(hasUpdate);
    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByText('2.0.0')).toBeInTheDocument();
      expect(screen.getByText('(current: 1.0.0)')).toBeInTheDocument();
    });
  });

  it('Download button calls downloadUpdate', async () => {
    vi.mocked(window.api.checkForUpdates).mockResolvedValue(hasUpdate);
    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByText('Download')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download'));
    expect(window.api.downloadUpdate).toHaveBeenCalled();
  });

  it('Release notes button calls openExternal', async () => {
    vi.mocked(window.api.checkForUpdates).mockResolvedValue(hasUpdate);
    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByText('Release notes')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Release notes'));
    expect(window.api.openExternal).toHaveBeenCalledWith(hasUpdate.releaseUrl);
  });

  it('X button dismisses the banner', async () => {
    vi.mocked(window.api.checkForUpdates).mockResolvedValue(hasUpdate);
    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByText('2.0.0')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Dismiss update banner'));
    expect(screen.queryByText('2.0.0')).not.toBeInTheDocument();
  });

  it('re-shows banner on new push after dismiss', async () => {
    vi.mocked(window.api.checkForUpdates).mockResolvedValue(hasUpdate);
    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByText('2.0.0')).toBeInTheDocument();
    });

    // Dismiss
    fireEvent.click(screen.getByLabelText('Dismiss update banner'));
    expect(screen.queryByText('2.0.0')).not.toBeInTheDocument();

    // New push re-shows
    const newerUpdate = { ...hasUpdate, latestVersion: '3.0.0' };
    updateStatusCallback!(newerUpdate);

    await waitFor(() => {
      expect(screen.getByText('3.0.0')).toBeInTheDocument();
    });
  });

  it('falls back to openExternal on download error', async () => {
    vi.mocked(window.api.checkForUpdates).mockResolvedValue(hasUpdate);
    vi.mocked(window.api.downloadUpdate).mockRejectedValue(new Error('fail'));
    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByText('Download')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download'));

    await waitFor(() => {
      expect(window.api.openExternal).toHaveBeenCalledWith(hasUpdate.releaseUrl);
    });
  });
});
