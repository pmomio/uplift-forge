import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Sidebar from '../Sidebar';
import { ALL_TABS } from '../Sidebar';

// Mock API
vi.mock('../../api', () => ({
  checkForUpdates: vi.fn().mockResolvedValue({ data: { currentVersion: '1.0.0' } }),
}));

const mockProject = {
  key: 'PROJ',
  name: 'Test Project',
  lead: 'John Doe',
  avatar: 'avatar.png',
};

describe('Sidebar', () => {
  const defaultProps = {
    activeTab: 'home',
    onTabChange: vi.fn(),
    project: mockProject,
    email: 'user@test.com',
    onLogout: vi.fn(),
    onReset: vi.fn(),
    persona: 'engineering_manager' as const,
    projectCount: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).api = {
      openExternal: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('renders all navigation tabs', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Team Metrics')).toBeInTheDocument();
    expect(screen.getByText('Individual Metrics')).toBeInTheDocument();
    expect(screen.getByText('Epic Tracker')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('highlights the active tab', () => {
    render(<Sidebar {...defaultProps} activeTab="metrics" />);
    const metricsBtn = screen.getByText('Team Metrics').closest('button');
    expect(metricsBtn).toHaveClass('bg-indigo-500/15');
  });

  it('calls onTabChange when tab clicked', () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByText('Epic Tracker'));
    expect(defaultProps.onTabChange).toHaveBeenCalledWith('epics');
  });

  it('shows project name when provided', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('shows default name when no project', () => {
    render(<Sidebar {...defaultProps} project={null} />);
    expect(screen.getByText('Uplift Forge')).toBeInTheDocument();
  });

  it('shows project avatar when provided', () => {
    render(<Sidebar {...defaultProps} />);
    const img = screen.getByAltText('');
    expect(img).toHaveAttribute('src', 'avatar.png');
  });

  it('shows project lead when provided', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('does not show lead section when lead is null', () => {
    render(<Sidebar {...defaultProps} project={{ ...mockProject, lead: null }} />);
    expect(screen.queryByText('Lead')).not.toBeInTheDocument();
  });

  it('calls onLogout when logout button clicked', () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Sign out'));
    expect(defaultProps.onLogout).toHaveBeenCalled();
  });

  it('calls onReset when reset button clicked', () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByText('Reset App'));
    expect(defaultProps.onReset).toHaveBeenCalled();
  });

  it('shows version from update check', async () => {
    render(<Sidebar {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Version 1.0.0')).toBeInTheDocument();
    });
  });

  it('opens external link for developer website', () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByText('Parijat Mukherjee'));
    expect((window as any).api.openExternal).toHaveBeenCalledWith('https://www.parijatmukherjee.com');
  });

  // --- Persona Tab Isolation ---

  it('shows all 5 tabs for engineering_manager persona', () => {
    render(<Sidebar {...defaultProps} persona="engineering_manager" />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Team Metrics')).toBeInTheDocument();
    expect(screen.getByText('Individual Metrics')).toBeInTheDocument();
    expect(screen.getByText('Epic Tracker')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows only 3 tabs for individual persona', () => {
    render(<Sidebar {...defaultProps} persona="individual" />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Individual Metrics')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByText('Team Metrics')).not.toBeInTheDocument();
    expect(screen.queryByText('Epic Tracker')).not.toBeInTheDocument();
  });

  it('shows 4 tabs for delivery_manager persona', () => {
    render(<Sidebar {...defaultProps} persona="delivery_manager" />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Team Metrics')).toBeInTheDocument();
    expect(screen.getByText('Epic Tracker')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByText('Individual Metrics')).not.toBeInTheDocument();
  });

  it('shows 4 tabs for management persona (no individual)', () => {
    render(<Sidebar {...defaultProps} persona="management" />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Team Metrics')).toBeInTheDocument();
    expect(screen.getByText('Epic Tracker')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByText('Individual Metrics')).not.toBeInTheDocument();
  });

  it('shows project count badge for multi-project', () => {
    render(<Sidebar {...defaultProps} projectCount={3} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('does not show project count badge for single project', () => {
    render(<Sidebar {...defaultProps} projectCount={1} />);
    expect(screen.queryByText('+0')).not.toBeInTheDocument();
  });
});
