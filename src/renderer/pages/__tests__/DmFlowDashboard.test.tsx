import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../api', () => ({
  getDmFlowMetrics: vi.fn().mockResolvedValue({
    data: {
      cfd: [],
      leadTimeDistribution: { p50: 48, p85: 96, p95: 168 },
      leadTimeHistogram: [
        { range: '0-1d', count: 2 },
        { range: '1-3d', count: 5 },
        { range: '3-7d', count: 3 },
        { range: '1-2w', count: 1 },
        { range: '2-4w', count: 0 },
        { range: '4w+', count: 0 },
      ],
      wip: {
        count: 8,
        limit: 10,
        overLimit: false,
        byStatus: [
          { status: 'In Progress', count: 5 },
          { status: 'Code Review', count: 3 },
        ],
      },
      agingWipTiered: [
        { key: 'TEST-1', summary: 'Stuck ticket', assignee: 'Alice', status: 'In Progress', daysInStatus: 10, storyPoints: 5, tier: 'critical' },
      ],
      blockers: [
        { key: 'TEST-2', summary: 'Blocked task', assignee: 'Bob', blockedHours: 48, currentStatus: 'Blocked' },
      ],
      flowEfficiency: { average: 65, median: 60 },
      throughputStability: 0.72,
      weeklyThroughput: [
        { week: '1/1', count: 3, storyPoints: 8 },
        { week: '1/8', count: 4, storyPoints: 10 },
      ],
      monteCarlo: {
        targetItems: 8,
        confidenceLevels: [
          { percentile: 50, weeks: 2 },
          { percentile: 85, weeks: 3 },
          { percentile: 95, weeks: 4 },
        ],
      },
      totalTickets: 42,
      totalStoryPoints: 120,
      period: 'all',
      arrivalVsDeparture: [
        { week: '1/1', arrived: 5, departed: 3 },
        { week: '1/8', arrived: 4, departed: 4 },
      ],
      batchSizeTrend: [
        { week: '1/1', avgSp: 3.2 },
        { week: '1/8', avgSp: 2.8 },
      ],
      timeToFirstActivityHours: 12,
      leadTimeBreakdown: { activePercent: 55, waitPercent: 30, blockedPercent: 15 },
      traces: {
        leadTimeP50: '50 timelines → period filter → 42 had valid lead time\np50 = 48.0h',
        flowEfficiency: '42 resolved → 40 had computable efficiency\navg 65%, median 60%',
        wip: '50 timelines → 8 in active statuses\nWIP limit: 10',
        throughputStability: '8 weeks → mean 3.5, stability = 72%',
        monteCarlo: '8 WIP items, 8 weeks history → 10000 simulations',
      },
    },
  }),
  triggerSync: vi.fn().mockResolvedValue({ data: {} }),
  syncAllProjects: vi.fn().mockResolvedValue({ data: {} }),
  getAiConfig: vi.fn().mockResolvedValue({ data: { hasKey: false } }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import DmFlowDashboard from '../DmFlowDashboard';

describe('DmFlowDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders KPI cards with data', async () => {
    render(<DmFlowDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('65.00%')).toBeInTheDocument(); // flow efficiency
      expect(screen.getByText('8')).toBeInTheDocument(); // WIP count
      expect(screen.getByText('72.00%')).toBeInTheDocument(); // throughput stability
    });
  });

  it('shows "Flow Dashboard" heading', async () => {
    render(<DmFlowDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Flow Dashboard')).toBeInTheDocument();
    });
  });

  it('shows project name in heading', async () => {
    render(<DmFlowDashboard refreshKey={0} project={{ key: 'TEST', name: 'Test Project', lead: null, avatar: null }} />);
    await waitFor(() => {
      expect(screen.getByText(/Test Project — Flow Dashboard/)).toBeInTheDocument();
    });
  });

  it('shows period selector', () => {
    render(<DmFlowDashboard refreshKey={0} project={null} />);
    expect(screen.getByText('All Time')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Quarterly')).toBeInTheDocument();
  });

  it('shows Monte Carlo forecast', async () => {
    render(<DmFlowDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText(/Delivery Forecast/)).toBeInTheDocument();
      expect(screen.getByText('50% confidence')).toBeInTheDocument();
      expect(screen.getByText('85% confidence')).toBeInTheDocument();
      expect(screen.getByText('95% confidence')).toBeInTheDocument();
    });
  });

  it('shows aging WIP entries', async () => {
    render(<DmFlowDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Stuck ticket')).toBeInTheDocument();
      expect(screen.getByText('critical')).toBeInTheDocument();
    });
  });

  it('shows blockers', async () => {
    render(<DmFlowDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Blocked task')).toBeInTheDocument();
    });
  });

  it('shows WIP breakdown by status', async () => {
    render(<DmFlowDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('WIP Breakdown')).toBeInTheDocument();
      // "In Progress" appears in both WIP breakdown and aging WIP, use getAllByText
      expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Code Review')).toBeInTheDocument();
    });
  });

  it('shows explain buttons for KPI cards', async () => {
    render(<DmFlowDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Explain: Lead Time p50')).toBeInTheDocument();
      expect(screen.getByLabelText('Explain: Flow Efficiency')).toBeInTheDocument();
      expect(screen.getByLabelText('Explain: WIP')).toBeInTheDocument();
    });
  });

  it('opens explain modal on click', async () => {
    render(<DmFlowDashboard refreshKey={0} project={null} />);
    await waitFor(() => screen.getByLabelText('Explain: Lead Time p50'));
    fireEvent.click(screen.getByLabelText('Explain: Lead Time p50'));
    await waitFor(() => {
      expect(screen.getByText('Got it')).toBeInTheDocument();
    });
  });

  it('shows dynamic trace in explain modal when available', async () => {
    render(<DmFlowDashboard refreshKey={0} project={null} />);
    await waitFor(() => screen.getByLabelText('Explain: Lead Time p50'));
    fireEvent.click(screen.getByLabelText('Explain: Lead Time p50'));
    await waitFor(() => {
      expect(screen.getByText(/50 timelines → period filter/)).toBeInTheDocument();
    });
  });
});
