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
}));

vi.mock('../../api', () => ({
  getIndividualMetrics: vi.fn(),
  triggerSync: vi.fn(),
  getAiConfig: vi.fn(),
  getConfig: vi.fn().mockResolvedValue({ data: { persona: 'engineering_manager' } }),
}));

import IndividualMetrics from '../IndividualMetrics';
import { getIndividualMetrics, triggerSync, getAiConfig } from '../../api';

const mockData = {
  engineers: [
    {
      accountId: 'a1', displayName: 'Alice', avatar: null,
      metrics: {
        total_tickets: 10, total_story_points: 30, total_eng_hours: 80,
        avg_cycle_time_hours: 8.0, avg_eng_hours_per_sp: 2.7,
        estimation_accuracy: 1.1, bug_ratio: 0.1, complexity_score: 3.0, focus_ratio: 0.8,
      },
      prev_metrics: {
        total_tickets: 8, total_story_points: 25, total_eng_hours: 60,
        avg_cycle_time_hours: 7.5, avg_eng_hours_per_sp: 2.4,
        estimation_accuracy: 1.0, bug_ratio: 0.12, complexity_score: 3.1, focus_ratio: 0.75,
      },
    },
    {
      accountId: 'b1', displayName: 'Bob', avatar: 'https://avatar.png',
      metrics: {
        total_tickets: 8, total_story_points: 20, total_eng_hours: 60,
        avg_cycle_time_hours: 7.5, avg_eng_hours_per_sp: 3.0,
        estimation_accuracy: 0.9, bug_ratio: 0.25, complexity_score: 2.5, focus_ratio: 0.6,
      },
      prev_metrics: {
        total_tickets: 6, total_story_points: 18, total_eng_hours: 50,
        avg_cycle_time_hours: 8.3, avg_eng_hours_per_sp: 2.8,
        estimation_accuracy: 0.95, bug_ratio: 0.17, complexity_score: 3.0, focus_ratio: 0.67,
      },
    },
  ],
  team_averages: {
    total_tickets: 9, total_story_points: 25, total_eng_hours: 70,
    avg_cycle_time_hours: 7.8, avg_eng_hours_per_sp: 2.8,
    estimation_accuracy: 1.0, bug_ratio: 0.17, complexity_score: 2.8, focus_ratio: 0.7,
  },
  prev_team_averages: {
    total_tickets: 7, total_story_points: 21, total_eng_hours: 55,
    avg_cycle_time_hours: 7.9, avg_eng_hours_per_sp: 2.6,
    estimation_accuracy: 0.97, bug_ratio: 0.14, complexity_score: 3.0, focus_ratio: 0.71,
  },
  period: 'all',
};

describe('IndividualMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getIndividualMetrics as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockData });
    (triggerSync as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    (getAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { provider: 'openai', hasKey: false } });
  });

  it('fetches metrics on mount', async () => {
    render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(getIndividualMetrics).toHaveBeenCalledWith('all');
    });
  });

  it('renders page header', async () => {
    render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Individual Metrics')).toBeInTheDocument();
    });
  });

  it('renders personalized header with project', async () => {
    render(<IndividualMetrics refreshKey={0} project={{ key: 'P', name: 'Team X', lead: null, avatar: null }} />);
    await waitFor(() => {
      expect(screen.getByText(/Team X — Individual Metrics/)).toBeInTheDocument();
    });
  });

  it('displays engineer names', async () => {
    render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('displays engineer avatar when available', async () => {
    const { container } = render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
    const img = container.querySelector('img[src="https://avatar.png"]');
    expect(img).toBeInTheDocument();
  });

  it('shows period selector', async () => {
    render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('All Time')).toBeInTheDocument();
      expect(screen.getByText('Monthly')).toBeInTheDocument();
    });
  });

  it('changes period on click', async () => {
    render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => expect(screen.getByText('Weekly')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Weekly'));
    await waitFor(() => {
      expect(getIndividualMetrics).toHaveBeenCalledWith('weekly');
    });
  });

  it('shows sync button', async () => {
    render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Sync & Refresh')).toBeInTheDocument();
    });
  });

  it('shows empty state when no engineers tracked', async () => {
    (getIndividualMetrics as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { engineers: [], team_averages: {}, prev_team_averages: {}, period: 'all' },
    });
    render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText(/No tracked engineers configured/)).toBeInTheDocument();
    });
  });

  it('refetches when refreshKey changes', async () => {
    const { rerender } = render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => expect(getIndividualMetrics).toHaveBeenCalledTimes(1));
    rerender(<IndividualMetrics refreshKey={1} project={null} />);
    await waitFor(() => expect(getIndividualMetrics).toHaveBeenCalledTimes(2));
  });

  it('triggers sync on button click', async () => {
    render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => expect(screen.getByText('Sync & Refresh')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Sync & Refresh'));
    await waitFor(() => {
      expect(triggerSync).toHaveBeenCalled();
    });
  });

  // --- Team Average Row ---
  it('renders team average section', async () => {
    render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText(/Team Average/)).toBeInTheDocument();
    });
  });

  // --- KPI Labels ---
  it('renders all KPI labels', async () => {
    render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
    // Check that the main KPI labels are present (they repeat per engineer + team avg)
    const ticketsLabels = screen.getAllByText('Tickets');
    expect(ticketsLabels.length).toBeGreaterThan(0);
  });

  // --- Expand engineer detail ---
  it('expands engineer detail on click', async () => {
    render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
    // Click Alice's name/row to expand
    fireEvent.click(screen.getByText('Alice'));
    await waitFor(() => {
      expect(screen.getByText('vs Team Average')).toBeInTheDocument();
      expect(screen.getByText('Ratios & Quality')).toBeInTheDocument();
    });
  });

  it('collapses engineer detail on second click', async () => {
    render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Alice'));
    await waitFor(() => expect(screen.getByText('vs Team Average')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Alice'));
    await waitFor(() => {
      expect(screen.queryByText('vs Team Average')).not.toBeInTheDocument();
    });
  });

  // --- Team Comparison chart ---
  it('renders team comparison chart when multiple engineers', async () => {
    render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Team Comparison')).toBeInTheDocument();
    });
  });

  // --- Fetch error handling ---
  it('handles fetch error gracefully', async () => {
    (getIndividualMetrics as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Fail'));
    render(<IndividualMetrics refreshKey={0} project={null} />);
    // Should not crash
    await waitFor(() => {
      expect(screen.getByText('Individual Metrics')).toBeInTheDocument();
    });
  });

  // --- Sync error handling ---
  it('handles sync error with toast', async () => {
    (triggerSync as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Fail'));
    render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => screen.getByText('Sync & Refresh'));
    fireEvent.click(screen.getByText('Sync & Refresh'));
    await waitFor(() => {
      expect(triggerSync).toHaveBeenCalled();
    });
  });

  // --- Ticket count display ---
  it('shows ticket count per engineer', async () => {
    render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('10 tickets')).toBeInTheDocument();
      expect(screen.getByText('8 tickets')).toBeInTheDocument();
    });
  });

  // --- Trend badge tooltip hover ---
  it('shows tooltip on trend badge hover', async () => {
    // Use monthly period so hasPrev=true and TrendBadges render
    (getIndividualMetrics as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...mockData, period: 'monthly' },
    });
    const { container } = render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    // Switch to monthly to trigger refetch with period='monthly'
    fireEvent.click(screen.getByText('Monthly'));
    await waitFor(() => {
      const badges = container.querySelectorAll('span.cursor-default');
      expect(badges.length).toBeGreaterThan(0);
    });
    const badges = container.querySelectorAll('span.cursor-default');
    fireEvent.mouseEnter(badges[0]);
    await waitFor(() => {
      expect(screen.getByText(/Previous:/)).toBeInTheDocument();
    });
    fireEvent.mouseLeave(badges[0]);
    await waitFor(() => {
      expect(screen.queryByText(/Previous:/)).not.toBeInTheDocument();
    });
  });

  // --- Help tooltip hover ---
  it('shows help tooltip on hover', async () => {
    const { container } = render(<IndividualMetrics refreshKey={0} project={null} />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    // Expand Alice to see help icons in expanded detail
    fireEvent.click(screen.getByText('Alice'));
    await waitFor(() => expect(screen.getByText('Ratios & Quality')).toBeInTheDocument());
    // Help icons have cursor-help class
    const helpIcons = container.querySelectorAll('.cursor-help');
    expect(helpIcons.length).toBeGreaterThan(0);
    const helpSpan = helpIcons[0].closest('span');
    expect(helpSpan).toBeDefined();
    fireEvent.mouseEnter(helpSpan!);
    fireEvent.mouseLeave(helpSpan!);
  });
});
