import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

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

vi.mock('../../api', () => ({
  getTeamMetrics: vi.fn(),
  triggerSync: vi.fn(),
  getAiConfig: vi.fn(),
}));

import TeamMetrics from '../TeamMetrics';
import { getTeamMetrics, triggerSync, getAiConfig } from '../../api';
import toast from 'react-hot-toast';

const mockMetrics = {
  summary: {
    total_tickets: 42,
    total_story_points: 120,
    total_eng_hours: 320,
    estimation_accuracy: 1.05,
    avg_eng_hours_per_sp: 2.7,
    avg_cycle_time_hours: 7.6,
    bug_count: 5,
    bug_ratio: 0.12,
    bug_eng_hours_pct: 8.5,
  },
  prev_summary: {
    total_tickets: 38,
    total_story_points: 110,
    total_eng_hours: 300,
    estimation_accuracy: 1.0,
    avg_eng_hours_per_sp: 2.5,
    avg_cycle_time_hours: 8.0,
    bug_count: 6,
    bug_ratio: 0.16,
    bug_eng_hours_pct: 10,
  },
  monthly_trend: [
    { month: '2025-10', tickets: 20, story_points: 50, eng_hours: 150 },
    { month: '2025-11', tickets: 22, story_points: 70, eng_hours: 170 },
  ],
  by_business_unit: {
    B2C: { eng_hours: 200, story_points: 80, tickets: 30 },
    B2B: { eng_hours: 120, story_points: 40, tickets: 12 },
  },
  prev_by_business_unit: {
    B2C: { eng_hours: 180, story_points: 70, tickets: 25 },
    B2B: { eng_hours: 120, story_points: 40, tickets: 13 },
  },
  by_work_stream: {
    Product: { eng_hours: 240, story_points: 90, tickets: 32 },
    Operational: { eng_hours: 80, story_points: 30, tickets: 10 },
  },
  prev_by_work_stream: {
    Product: { eng_hours: 220, story_points: 80, tickets: 28 },
    Operational: { eng_hours: 80, story_points: 30, tickets: 10 },
  },
  issue_type_breakdown: {
    Story: { tickets: 25, eng_hours: 200 },
    Bug: { tickets: 5, eng_hours: 40 },
    Task: { tickets: 12, eng_hours: 80 },
  },
  prev_issue_type_breakdown: {
    Story: { tickets: 20, eng_hours: 180 },
    Bug: { tickets: 6, eng_hours: 50 },
    Task: { tickets: 12, eng_hours: 70 },
  },
  period: 'all',
};

describe('TeamMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getTeamMetrics as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockMetrics });
    (triggerSync as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    (getAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { provider: 'openai', hasKey: false } });
  });

  // --- Loading and fetching ---
  it('fetches metrics on mount', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(getTeamMetrics).toHaveBeenCalledWith('all');
    });
  });

  it('renders page header', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Team Metrics')).toBeInTheDocument();
    });
  });

  it('renders personalized header with project', async () => {
    render(<TeamMetrics refreshKey={0} project={{ key: 'P', name: 'Team X', lead: null, avatar: null }} />);
    await waitFor(() => {
      expect(screen.getByText(/Team X — Team Metrics/)).toBeInTheDocument();
    });
  });

  // --- KPI cards ---
  it('displays total tickets KPI', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Total Tickets')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });

  it('displays total story points KPI', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Total Story Points')).toBeInTheDocument();
      expect(screen.getByText('120')).toBeInTheDocument();
    });
  });

  it('displays estimation accuracy KPI', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Estimation Accuracy')).toBeInTheDocument();
    });
  });

  it('displays bug ratio KPI', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Bug Ratio')).toBeInTheDocument();
    });
  });

  it('displays avg cycle time KPI', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Avg Cycle Time')).toBeInTheDocument();
    });
  });

  it('displays avg hours per SP KPI', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Avg Hours / SP')).toBeInTheDocument();
    });
  });

  it('displays bug count KPI', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Bug Count')).toBeInTheDocument();
    });
  });

  it('displays bug hours pct KPI', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Bug Hours %')).toBeInTheDocument();
    });
  });

  // --- Charts sections ---
  it('renders monthly trend chart when 2+ data points', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Monthly Trend')).toBeInTheDocument();
    });
  });

  it('does not render monthly trend with only one data point', async () => {
    (getTeamMetrics as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...mockMetrics, monthly_trend: [{ month: '2025-10', tickets: 20, story_points: 50, eng_hours: 150 }] },
    });
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Total Tickets')).toBeInTheDocument();
    });
    expect(screen.queryByText('Monthly Trend')).not.toBeInTheDocument();
  });

  it('renders eng hours by BU chart', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Eng Hours by Business Unit')).toBeInTheDocument();
    });
  });

  it('renders eng hours by work stream chart', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Eng Hours by Work Stream')).toBeInTheDocument();
    });
  });

  it('renders story points by BU chart', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Story Points by Business Unit')).toBeInTheDocument();
    });
  });

  it('renders issue type breakdown chart', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Issue Type Breakdown')).toBeInTheDocument();
    });
  });

  // --- Period selector ---
  it('shows all period selector buttons', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('All Time')).toBeInTheDocument();
      expect(screen.getByText('Monthly')).toBeInTheDocument();
      expect(screen.getByText('Bi-weekly')).toBeInTheDocument();
      expect(screen.getByText('Weekly')).toBeInTheDocument();
    });
  });

  it('changes period on click', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => expect(screen.getByText('Weekly')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Weekly'));
    await waitFor(() => {
      expect(getTeamMetrics).toHaveBeenCalledWith('weekly');
    });
  });

  // --- Sync ---
  it('shows sync button', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Sync & Refresh')).toBeInTheDocument();
    });
  });

  it('triggers sync on button click', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => expect(screen.getByText('Sync & Refresh')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Sync & Refresh'));
    await waitFor(() => {
      expect(triggerSync).toHaveBeenCalled();
    });
  });

  it('shows success toast after sync', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => screen.getByText('Sync & Refresh'));
    fireEvent.click(screen.getByText('Sync & Refresh'));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Metrics refreshed');
    });
  });

  it('shows error toast when sync fails', async () => {
    (triggerSync as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Fail'));
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => screen.getByText('Sync & Refresh'));
    fireEvent.click(screen.getByText('Sync & Refresh'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Sync failed');
    });
  });

  // --- Empty state ---
  it('shows empty state when no data', async () => {
    (getTeamMetrics as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { summary: { total_tickets: 0 }, prev_summary: null, monthly_trend: [], by_business_unit: {}, by_work_stream: {}, issue_type_breakdown: {}, period: 'all' },
    });
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText(/No data available/)).toBeInTheDocument();
    });
  });

  // --- Refresh key ---
  it('refetches when refreshKey changes', async () => {
    const { rerender } = render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => expect(getTeamMetrics).toHaveBeenCalledTimes(1));
    rerender(<TeamMetrics refreshKey={1} project={null} />);
    await waitFor(() => expect(getTeamMetrics).toHaveBeenCalledTimes(2));
  });

  // --- Null values ---
  it('handles null estimation accuracy', async () => {
    (getTeamMetrics as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...mockMetrics, summary: { ...mockMetrics.summary, estimation_accuracy: null } },
    });
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Estimation Accuracy')).toBeInTheDocument();
    });
  });

  // --- Trend badge tooltip hover ---
  it('shows tooltip on trend badge hover', async () => {
    const { container } = render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => expect(screen.getByText('Total Tickets')).toBeInTheDocument());
    // Find trend badges — they have cursor-default class
    const badges = container.querySelectorAll('span.cursor-default');
    expect(badges.length).toBeGreaterThan(0);
    // Hover on first trend badge
    fireEvent.mouseEnter(badges[0]);
    await waitFor(() => {
      expect(screen.getByText(/Previous:/)).toBeInTheDocument();
      expect(screen.getByText(/Current:/)).toBeInTheDocument();
    });
    fireEvent.mouseLeave(badges[0]);
    await waitFor(() => {
      expect(screen.queryByText(/Previous:/)).not.toBeInTheDocument();
    });
  });

  // --- Help tooltip hover ---
  it('shows help tooltip on hover', async () => {
    const { container } = render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => expect(screen.getByText('Total Tickets')).toBeInTheDocument());
    // Help icons have cursor-help class
    const helpIcons = container.querySelectorAll('.cursor-help');
    expect(helpIcons.length).toBeGreaterThan(0);
    const helpSpan = helpIcons[0].closest('span');
    expect(helpSpan).toBeDefined();
    fireEvent.mouseEnter(helpSpan!);
    await waitFor(() => {
      // HelpTooltip shows description when hovered
      expect(container.querySelector('.fixed.w-80')).toBeInTheDocument();
    });
    fireEvent.mouseLeave(helpSpan!);
  });

  // --- Section trend badge hover ---
  it('shows section trend badge tooltip on hover', async () => {
    render(<TeamMetrics refreshKey={0} project={null} />);
    await waitFor(() => expect(screen.getByText('Eng Hours by Business Unit')).toBeInTheDocument());
    // Section trend badges have "vs prev period" text
    const prevPeriodElements = screen.queryAllByText(/vs prev period/);
    expect(prevPeriodElements.length).toBeGreaterThan(0);
    const badge = prevPeriodElements[0].closest('span[class*="cursor-default"]');
    expect(badge).toBeDefined();
    if (badge) {
      fireEvent.mouseEnter(badge);
      fireEvent.mouseLeave(badge);
    }
  });
});
