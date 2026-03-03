import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../api', () => ({
  getEmTeamMetrics: vi.fn().mockResolvedValue({
    data: {
      cycleTime: { p50: 24, p85: 48, p95: 72, trend: [] },
      throughputByWorkStream: [],
      weeklyThroughput: [],
      contributionSpread: [],
      agingWip: [],
      bugRatioByEngineer: [],
      reworkRate: 0.15,
      totalTickets: 42,
      totalStoryPoints: 120,
      period: 'all',
      spAccuracy: 95,
      firstTimePassRate: 0.85,
      avgReviewDurationHours: 6,
      workTypeDistribution: [{ type: 'Story', count: 30, percentage: 71 }, { type: 'Bug', count: 12, percentage: 29 }],
      unestimatedRatio: 0.05,
      leadTimeBreakdown: { activePercent: 60, waitPercent: 30, blockedPercent: 10 },
      traces: {
        totalTickets: '100 total timelines, 80 tickets\nPeriod "all": 42 resolved',
        cycleTimeP50: '42 scoped timelines\n40 had valid cycle time\np50 = 24.0h',
        reworkRate: '42 resolved timelines\n6 had backward transitions\nrate = 15.0%',
        spAccuracy: '42 tickets, sp_to_days=1\navg accuracy 95%',
        avgReviewDuration: '42 timelines\navg 6.0h in review',
        unestimatedRatio: '42 resolved, 2 had SP = null/0\nratio = 5.0%',
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

import EmTeamDashboard from '../EmTeamDashboard';
import { triggerSync, syncAllProjects } from '../../api';

describe('EmTeamDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders KPI cards with data', async () => {
    render(<EmTeamDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('15.0%')).toBeInTheDocument(); // rework rate
      expect(screen.getByText('85.0%')).toBeInTheDocument(); // first-time pass rate
      expect(screen.getByText('95%')).toBeInTheDocument(); // SP accuracy
    });
  });

  it('shows "Team Dashboard" heading', async () => {
    render(<EmTeamDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Team Dashboard')).toBeInTheDocument();
    });
  });

  it('shows project name in heading', async () => {
    render(<EmTeamDashboard refreshKey={0} project={{ key: 'TEST', name: 'Test Project', lead: null, avatar: null }} />);
    await waitFor(() => {
      expect(screen.getByText(/Test Project — Team Dashboard/)).toBeInTheDocument();
    });
  });

  it('shows period selector', async () => {
    render(<EmTeamDashboard refreshKey={0} project={null} />);
    expect(screen.getByText('All Time')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Weekly')).toBeInTheDocument();
  });

  it('calls syncAllProjects for multi-project sync', async () => {
    render(<EmTeamDashboard refreshKey={0} project={null} projectCount={3} />);
    await waitFor(() => expect(screen.getByText('Sync & Refresh')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Sync & Refresh'));
    await waitFor(() => {
      expect(syncAllProjects).toHaveBeenCalled();
    });
  });

  it('calls triggerSync for single project', async () => {
    render(<EmTeamDashboard refreshKey={0} project={null} projectCount={1} />);
    await waitFor(() => expect(screen.getByText('Sync & Refresh')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Sync & Refresh'));
    await waitFor(() => {
      expect(triggerSync).toHaveBeenCalled();
    });
  });

  it('shows explain buttons for KPI cards', async () => {
    render(<EmTeamDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Explain: Total Tickets')).toBeInTheDocument();
      expect(screen.getByLabelText('Explain: Cycle Time p50')).toBeInTheDocument();
      expect(screen.getByLabelText('Explain: Rework Rate')).toBeInTheDocument();
    });
  });

  it('opens explain modal on click', async () => {
    render(<EmTeamDashboard refreshKey={0} project={null} />);
    await waitFor(() => screen.getByLabelText('Explain: Total Tickets'));
    fireEvent.click(screen.getByLabelText('Explain: Total Tickets'));
    await waitFor(() => {
      expect(screen.getByText('Got it')).toBeInTheDocument();
    });
  });

  it('shows dynamic trace in explain modal when available', async () => {
    render(<EmTeamDashboard refreshKey={0} project={null} />);
    await waitFor(() => screen.getByLabelText('Explain: Total Tickets'));
    fireEvent.click(screen.getByLabelText('Explain: Total Tickets'));
    await waitFor(() => {
      expect(screen.getByText(/100 total timelines/)).toBeInTheDocument();
    });
  });
});
