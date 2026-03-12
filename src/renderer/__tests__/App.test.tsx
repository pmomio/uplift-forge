import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({
  Toaster: () => <div data-testid="toaster" />,
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../api', () => ({
  getAuthState: vi.fn(),
  logout: vi.fn(),
  getConfig: vi.fn(),
  getJiraProject: vi.fn(),
  listProjects: vi.fn(),
  checkForUpdates: vi.fn().mockResolvedValue({ data: { currentVersion: '1.0.0' } }),
}));

import App from '../App';
import { getAuthState, logout, getConfig, getJiraProject, listProjects } from '../api';

const mockAuth = { status: 'authenticated', email: 'test@test.com' };
const mockConfig = { persona: 'engineering_manager', project_key: 'PROJ' };
const mockProject = { key: 'PROJ', name: 'My Team', lead: 'Alice', avatar: null };

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAuthState as any).mockResolvedValue({ data: mockAuth });
    (getConfig as any).mockResolvedValue({ data: mockConfig });
    (getJiraProject as any).mockResolvedValue({ data: mockProject });
    (listProjects as any).mockResolvedValue({ data: [] });
    (logout as any).mockResolvedValue({ data: {} });
  });

  it('renders loading state initially', () => {
    (getAuthState as any).mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.getByRole('main', { hidden: true }).parentElement).toBeInTheDocument();
  });

  it('renders login page when unauthenticated', async () => {
    (getAuthState as any).mockResolvedValue({ data: { status: 'unauthenticated' } });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Connect & Continue/)).toBeInTheDocument();
    });
  });

  it('renders onboarding wizard when persona not set', async () => {
    (getConfig as any).mockResolvedValue({ data: { persona: null } });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Welcome to Uplift Forge/)).toBeInTheDocument();
    });
  });

  it('renders sidebar and home page when authenticated', async () => {
    render(<App />);
    await waitFor(() => screen.getByTestId('sidebar'));
    expect(screen.getByText(/Engineering Command Center/)).toBeInTheDocument();
  });

  it('handles logout', async () => {
    render(<App />);
    await waitFor(() => screen.getByTestId('sidebar'));
    fireEvent.click(screen.getByTitle('Sign out'));
    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
      expect(screen.getByText(/Connect & Continue/)).toBeInTheDocument();
    });
  });

  it('switches tabs via sidebar', async () => {
    render(<App />);
    await waitFor(() => screen.getByTestId('sidebar'));
    fireEvent.click(screen.getByText('Team Metrics'));
    await waitFor(() => {
      expect(screen.getByTestId('em-team-dashboard')).toBeInTheDocument();
    });
  });

  it('restricts tabs by persona', async () => {
    (getConfig as any).mockResolvedValue({ data: { persona: 'individual' } });
    render(<App />);
    await waitFor(() => screen.getByTestId('sidebar'));
    expect(screen.queryByText('Team Metrics')).not.toBeInTheDocument();
    expect(screen.getByText('Individual Metrics')).toBeInTheDocument();
  });

  it('renders Management dashboard for management persona', async () => {
    (getConfig as any).mockResolvedValue({ data: { persona: 'management' } });
    render(<App />);
    await waitFor(() => screen.getByTestId('sidebar'));
    fireEvent.click(screen.getByText('Team Metrics'));
    await waitFor(() => {
      expect(screen.getByTestId('cto-org-dashboard')).toBeInTheDocument();
    });
  });
});
