import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({
  Toaster: () => <div data-testid="toaster" />,
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../api', () => ({
  getAuthState: vi.fn(),
  getJiraProject: vi.fn(),
  resetApp: vi.fn(),
}));

vi.mock('../components/Sidebar', () => ({
  default: ({ activeTab, onTabChange, onLogout, onReset }: any) => (
    <div data-testid="sidebar">
      <span data-testid="active-tab">{activeTab}</span>
      <button onClick={() => onTabChange('metrics')}>Switch to Metrics</button>
      <button onClick={() => onTabChange('config')}>Switch to Config</button>
      <button onClick={() => onLogout()}>Logout</button>
      <button onClick={() => onReset()}>Reset</button>
    </div>
  ),
}));

vi.mock('../pages/HomePage', () => ({
  default: () => <div data-testid="home-page">Home</div>,
}));

vi.mock('../pages/EngineeringAttribution', () => ({
  default: () => <div data-testid="attribution-page">Attribution</div>,
}));

vi.mock('../pages/TeamMetrics', () => ({
  default: () => <div data-testid="team-metrics-page">Team Metrics</div>,
}));

vi.mock('../pages/IndividualMetrics', () => ({
  default: () => <div data-testid="individual-metrics-page">Individual</div>,
}));

vi.mock('../components/ConfigPanel', () => ({
  default: ({ onConfigSaved }: any) => (
    <div data-testid="config-panel">
      <button onClick={onConfigSaved}>Save Config</button>
    </div>
  ),
}));

vi.mock('../components/UpdateBanner', () => ({
  default: () => <div data-testid="update-banner" />,
}));

vi.mock('../pages/LoginPage', () => ({
  default: ({ onLoginSuccess }: any) => (
    <div data-testid="login-page">
      <button onClick={onLoginSuccess}>Login</button>
    </div>
  ),
}));

import App from '../App';
import { getAuthState, getJiraProject, resetApp } from '../api';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).api = {
      logout: vi.fn().mockResolvedValue(undefined),
      onAuthStateChanged: vi.fn(() => vi.fn()), // returns unsubscribe
    };
  });

  it('shows loading spinner initially', () => {
    (getAuthState as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<App />);
    // Should show loader
    const loader = document.querySelector('.animate-spin');
    expect(loader).toBeInTheDocument();
  });

  it('shows login page when unauthenticated', async () => {
    (getAuthState as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { status: 'unauthenticated' },
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  it('shows main layout when authenticated', async () => {
    (getAuthState as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { status: 'authenticated', email: 'test@test.com' },
    });
    (getJiraProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { key: 'PROJ', name: 'My Project', lead: null, avatar: null },
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });
  });

  it('navigates to team metrics tab', async () => {
    (getAuthState as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { status: 'authenticated', email: 'test@test.com' },
    });
    (getJiraProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { key: 'PROJ', name: 'My Project', lead: null, avatar: null },
    });
    render(<App />);
    await waitFor(() => screen.getByTestId('sidebar'));
    fireEvent.click(screen.getByText('Switch to Metrics'));
    await waitFor(() => {
      expect(screen.getByTestId('team-metrics-page')).toBeInTheDocument();
    });
  });

  it('navigates to config tab', async () => {
    (getAuthState as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { status: 'authenticated', email: 'test@test.com' },
    });
    (getJiraProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { key: 'PROJ', name: 'My Project', lead: null, avatar: null },
    });
    render(<App />);
    await waitFor(() => screen.getByTestId('sidebar'));
    fireEvent.click(screen.getByText('Switch to Config'));
    await waitFor(() => {
      expect(screen.getByTestId('config-panel')).toBeInTheDocument();
    });
  });

  it('handles login success', async () => {
    (getAuthState as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { status: 'unauthenticated' } })
      .mockResolvedValueOnce({ data: { status: 'authenticated', email: 'test@test.com' } });
    (getJiraProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { key: 'PROJ', name: 'Test', lead: null, avatar: null },
    });
    render(<App />);
    await waitFor(() => screen.getByTestId('login-page'));
    fireEvent.click(screen.getByText('Login'));
    await waitFor(() => {
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });
  });

  it('handles logout', async () => {
    (getAuthState as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { status: 'authenticated', email: 'test@test.com' },
    });
    (getJiraProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { key: 'PROJ', name: 'Test', lead: null, avatar: null },
    });
    render(<App />);
    await waitFor(() => screen.getByTestId('sidebar'));
    fireEvent.click(screen.getByText('Logout'));
    await waitFor(() => {
      expect((window as any).api.logout).toHaveBeenCalled();
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  it('handles reset', async () => {
    (getAuthState as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { status: 'authenticated', email: 'test@test.com' },
    });
    (getJiraProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { key: 'PROJ', name: 'Test', lead: null, avatar: null },
    });
    (resetApp as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    render(<App />);
    await waitFor(() => screen.getByTestId('sidebar'));
    fireEvent.click(screen.getByText('Reset'));
    await waitFor(() => {
      expect(resetApp).toHaveBeenCalled();
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  it('handles config saved (increments refreshKey)', async () => {
    (getAuthState as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { status: 'authenticated', email: 'test@test.com' },
    });
    (getJiraProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { key: 'PROJ', name: 'Test', lead: null, avatar: null },
    });
    render(<App />);
    await waitFor(() => screen.getByTestId('sidebar'));
    fireEvent.click(screen.getByText('Switch to Config'));
    await waitFor(() => screen.getByTestId('config-panel'));
    fireEvent.click(screen.getByText('Save Config'));
    // Project should be refetched
    await waitFor(() => {
      expect(getJiraProject).toHaveBeenCalledTimes(2);
    });
  });

  it('handles auth check failure gracefully', async () => {
    (getAuthState as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  it('handles project fetch failure gracefully', async () => {
    (getAuthState as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { status: 'authenticated', email: 'test@test.com' },
    });
    (getJiraProject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    render(<App />);
    await waitFor(() => {
      // Should still show main layout even if project fetch fails
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });
  });

  it('sets up auth state change listener', async () => {
    (getAuthState as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { status: 'authenticated', email: 'test@test.com' },
    });
    (getJiraProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { key: 'PROJ', name: 'Test', lead: null, avatar: null },
    });
    render(<App />);
    await waitFor(() => screen.getByTestId('sidebar'));
    expect((window as any).api.onAuthStateChanged).toHaveBeenCalled();
  });

  it('handles missing onAuthStateChanged', async () => {
    (window as any).api = { logout: vi.fn() };
    (getAuthState as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { status: 'authenticated', email: 'test@test.com' },
    });
    (getJiraProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { key: 'PROJ', name: 'Test', lead: null, avatar: null },
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });
  });

  it('skips project with error field', async () => {
    (getAuthState as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { status: 'authenticated', email: 'test@test.com' },
    });
    (getJiraProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { key: 'PROJ', name: 'PROJ', lead: null, avatar: null, error: 'Not found' },
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });
  });
});
