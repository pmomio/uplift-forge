import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Sidebar, { TABS } from '../Sidebar';

vi.mock('../../api', () => ({
  checkForUpdates: vi.fn(() => Promise.resolve({ data: { currentVersion: '1.0.0' } })),
}));

describe('Sidebar', () => {
  const defaultProps = {
    activeTab: 'home',
    onTabChange: vi.fn(),
    project: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.api
    (window as any).api = {
      openExternal: vi.fn(),
    };
  });

  it('renders all navigation tabs', () => {
    render(<Sidebar {...defaultProps} />);
    for (const tab of TABS) {
      expect(screen.getByText(tab.label)).toBeInTheDocument();
    }
  });

  it('highlights the active tab', () => {
    render(<Sidebar {...defaultProps} activeTab="metrics" />);
    const metricsButton = screen.getByText('Team Metrics').closest('button');
    expect(metricsButton?.className).toContain('indigo');
  });

  it('calls onTabChange when tab clicked', () => {
    const onTabChange = vi.fn();
    render(<Sidebar {...defaultProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText('Settings'));
    expect(onTabChange).toHaveBeenCalledWith('config');
  });

  it('shows project name when provided', () => {
    render(<Sidebar {...defaultProps} project={{ key: 'PROJ', name: 'My Project', lead: 'Alice', avatar: null }} />);
    expect(screen.getByText('My Project')).toBeInTheDocument();
    expect(screen.getByText('PROJ')).toBeInTheDocument();
  });

  it('shows default name when no project', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Uplift Forge')).toBeInTheDocument();
  });

  it('shows project avatar when provided', () => {
    const { container } = render(<Sidebar {...defaultProps} project={{ key: 'P', name: 'P', lead: null, avatar: 'https://img.png' }} />);
    const img = container.querySelector('img[src="https://img.png"]');
    expect(img).toBeInTheDocument();
  });

  it('shows project lead when provided', () => {
    render(<Sidebar {...defaultProps} project={{ key: 'P', name: 'P', lead: 'Alice Lead', avatar: null }} />);
    expect(screen.getByText('Alice Lead')).toBeInTheDocument();
    expect(screen.getByText('Lead')).toBeInTheDocument();
  });

  it('does not show lead section when lead is null', () => {
    render(<Sidebar {...defaultProps} project={{ key: 'P', name: 'P', lead: null, avatar: null }} />);
    expect(screen.queryByText('Lead')).not.toBeInTheDocument();
  });

  it('displays version and developer info', async () => {
    render(<Sidebar {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Version 1.0.0/)).toBeInTheDocument();
      expect(screen.getByText('Parijat Mukherjee')).toBeInTheDocument();
    });
  });

  it('opens website when developer name clicked', async () => {
    render(<Sidebar {...defaultProps} />);
    await waitFor(() => screen.getByText('Parijat Mukherjee'));
    fireEvent.click(screen.getByText('Parijat Mukherjee'));
    expect((window as any).api.openExternal).toHaveBeenCalledWith('https://www.parijatmukherjee.com');
  });

  // --- Persona-based tab filtering ---
  it('shows all 6 tabs for engineering_manager persona', () => {
    render(<Sidebar {...defaultProps} persona="engineering_manager" />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Eng. Attribution')).toBeInTheDocument();
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
    expect(screen.queryByText('Eng. Attribution')).not.toBeInTheDocument();
  });

  it('shows 5 tabs for delivery_manager persona', () => {
    render(<Sidebar {...defaultProps} persona="delivery_manager" />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Team Metrics')).toBeInTheDocument();
    expect(screen.getByText('Epic Tracker')).toBeInTheDocument();
    expect(screen.getByText('Eng. Attribution')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByText('Individual Metrics')).not.toBeInTheDocument();
  });

  it('shows 5 tabs for management persona (no individual)', () => {
    render(<Sidebar {...defaultProps} persona="management" />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Team Metrics')).toBeInTheDocument();
    expect(screen.getByText('Epic Tracker')).toBeInTheDocument();
    expect(screen.getByText('Eng. Attribution')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByText('Individual Metrics')).not.toBeInTheDocument();
  });

  it('shows project count badge for multi-project', () => {
    render(<Sidebar {...defaultProps} project={{ key: 'PROJ', name: 'My Project', lead: null, avatar: null }} projectCount={3} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('does not show project count badge for single project', () => {
    render(<Sidebar {...defaultProps} project={{ key: 'PROJ', name: 'My Project', lead: null, avatar: null }} projectCount={1} />);
    expect(screen.queryByText('+0')).not.toBeInTheDocument();
  });
});
