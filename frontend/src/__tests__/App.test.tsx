import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// Mock all API calls
vi.mock('../api', () => ({
  getJiraProject: vi.fn().mockResolvedValue({ data: { key: 'TEST', name: 'Test Project', lead: 'Alice', avatar: null } }),
  getTickets: vi.fn().mockResolvedValue({ data: [] }),
  triggerSync: vi.fn().mockResolvedValue({ data: { status: 'success' } }),
  getConfig: vi.fn().mockResolvedValue({ data: {} }),
  saveConfig: vi.fn().mockResolvedValue({ data: {} }),
  getJiraFields: vi.fn().mockResolvedValue({ data: [] }),
  getJiraStatuses: vi.fn().mockResolvedValue({ data: [] }),
  getTeamMetrics: vi.fn().mockResolvedValue({ data: { summary: {}, prev_summary: {}, monthly_trend: [], by_business_unit: {}, by_work_stream: {}, issue_type_breakdown: {}, period: 'all' } }),
  getIndividualMetrics: vi.fn().mockResolvedValue({ data: { engineers: [], team_averages: {}, prev_team_averages: {}, period: 'all' } }),
  getJiraMembers: vi.fn().mockResolvedValue({ data: [] }),
}));

// Mock react-hot-toast to avoid timer issues
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

// Mock recharts to avoid canvas issues
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  Legend: () => null,
}));

import App from '../App';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default Home tab', async () => {
    render(<App />);
    await waitFor(() => {
      // "Home" appears in both sidebar and page header — verify both exist
      const homeElements = screen.getAllByText('Home');
      expect(homeElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('fetches project info on mount', async () => {
    const { getJiraProject } = await import('../api');
    render(<App />);
    await waitFor(() => {
      expect(getJiraProject).toHaveBeenCalled();
    });
  });

  it('displays project name from API', async () => {
    render(<App />);
    await waitFor(() => {
      // Project name appears in sidebar and may appear on home page
      const elements = screen.getAllByText('Test Project');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('navigates between tabs', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText('Home').length).toBeGreaterThanOrEqual(1);
    });

    // Click "Eng. Attribution" in sidebar
    fireEvent.click(screen.getByText('Eng. Attribution'));
    // The page header should show "Engineering Attribution"
    await waitFor(() => {
      expect(screen.getByText(/Engineering Attribution/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Configuration'));
    await waitFor(() => {
      expect(screen.getByText('JIRA Connection')).toBeInTheDocument();
    });
  });

  it('handles project fetch error gracefully', async () => {
    const { getJiraProject } = await import('../api');
    (getJiraProject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));
    render(<App />);
    // Should still render without crashing
    await waitFor(() => {
      expect(screen.getByText('Uplift Forge')).toBeInTheDocument();
    });
  });

  it('handles project with error response gracefully', async () => {
    const { getJiraProject } = await import('../api');
    (getJiraProject as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { error: 'Not found' } });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Uplift Forge')).toBeInTheDocument();
    });
  });

  it('re-fetches project when config is saved', async () => {
    const { getJiraProject, saveConfig, getConfig } = await import('../api');
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { project_key: 'TEST', field_ids: {}, mapping_rules: { tpd_bu: {}, work_stream: {} }, ticket_filter: { mode: 'last_x_months', months: 6 } },
    });
    (saveConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { status: 'success', ticket_count: 0 } });
    render(<App />);
    await waitFor(() => expect(getJiraProject).toHaveBeenCalledTimes(1));
    // Navigate to config tab
    fireEvent.click(screen.getByText('Configuration'));
    await waitFor(() => screen.getByText('Save Configuration'));
    // Save config — this triggers onConfigSaved → handleConfigSaved → fetchProject
    fireEvent.click(screen.getByText('Save Configuration'));
    await waitFor(() => {
      expect(getJiraProject).toHaveBeenCalledTimes(2);
    });
  });
});
