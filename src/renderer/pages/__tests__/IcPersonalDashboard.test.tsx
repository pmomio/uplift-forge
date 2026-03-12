import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../api', () => ({
  getIcPersonalMetrics: vi.fn().mockResolvedValue({
    data: {
      cycleTimeTrend: [
        { week: '1/1', value: 24 },
        { week: '1/8', value: 36 },
      ],
      cycleTimeP50: 30,
      throughput: [
        { week: '1/1', value: 3 },
        { week: '1/8', value: 2 },
      ],
      agingWip: [
        { key: 'TEST-4', summary: 'My WIP ticket', status: 'In Progress', daysInStatus: 5, storyPoints: 2 },
      ],
      timeInStatus: [
        { status: 'In Progress', hours: 100, percentage: 60 },
        { status: 'Code Review', hours: 40, percentage: 24 },
        { status: 'Open', hours: 26, percentage: 16 },
      ],
      reworkRate: 0.15,
      reworkTrend: [],
      scopeTrajectory: [],
      spAccuracy: 105,
      firstTimePassRate: 0.85,
      avgReviewWaitHours: 4.5,
      focusScore: 0.75,
      totalTickets: 12,
      totalStoryPoints: 35,
      teamComparison: [
        { metric: 'Cycle Time p50 (hours)', myValue: 30, teamMedian: 40 },
        { metric: 'Rework Rate', myValue: 0.15, teamMedian: 0.2 },
        { metric: 'Throughput (tickets)', myValue: 12, teamMedian: 10 },
      ],
      goalProgress: [
        { metric: 'Tickets Completed', current: 12, target: 15 },
        { metric: 'Story Points', current: 35, target: 40 },
      ],
      period: 'all',
      traces: {
        cycleTimeP50: '4 total → filtered to my_account_id: 3 → period: 2 resolved → p50 30.0h',
        reworkRate: '3 my timelines → 1 backward transitions → rate 15%',
        tickets: 'my tickets, period filter → 12 resolved, 35 SP',
        spAccuracy: '2 tickets with SP>0 and eng_hours>0, sp_to_days=1 → avg 105%',
        firstTimePassRate: 'complement of rework rate: 1 - 0.15 = 85.0%',
        avgReviewWait: '3 timelines → avg 4.5h in review statuses',
        focusScore: '3 tickets → 2 product types → focus 75%',
        teamComparison: '4 engineers → my p50 30h vs team median 40h',
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

import IcPersonalDashboard from '../IcPersonalDashboard';

describe('IcPersonalDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders KPI cards', async () => {
    render(<IcPersonalDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument(); // tickets
      expect(screen.getByText('35')).toBeInTheDocument(); // story points
      expect(screen.getByText('15.00%')).toBeInTheDocument(); // rework rate
    });
  });

  it('shows "My Metrics" heading', async () => {
    render(<IcPersonalDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('My Metrics')).toBeInTheDocument();
    });
  });

  it('shows project name in heading', async () => {
    render(<IcPersonalDashboard refreshKey={0} project={{ key: 'TEST', name: 'Test Project', lead: null, avatar: null }} />);
    await waitFor(() => {
      expect(screen.getByText(/Test Project — My Metrics/)).toBeInTheDocument();
    });
  });

  it('shows period selector', () => {
    render(<IcPersonalDashboard refreshKey={0} project={null} />);
    expect(screen.getByText('All Time')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
  });

  it('shows time in status breakdown', async () => {
    render(<IcPersonalDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Time in Each Status')).toBeInTheDocument();
      expect(screen.getByText('Code Review')).toBeInTheDocument();
    });
  });

  it('shows aging WIP', async () => {
    render(<IcPersonalDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('My WIP ticket')).toBeInTheDocument();
    });
  });

  it('shows team comparison', async () => {
    render(<IcPersonalDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Team Comparison (anonymous)')).toBeInTheDocument();
    });
  });

  it('shows goal progress', async () => {
    render(<IcPersonalDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Goal Progress')).toBeInTheDocument();
      expect(screen.getByText('Tickets Completed')).toBeInTheDocument();
    });
  });

  it('shows explain buttons on health cards', async () => {
    render(<IcPersonalDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Explain: Cycle Time p50')).toBeInTheDocument();
      expect(screen.getByLabelText('Explain: Rework Rate')).toBeInTheDocument();
      expect(screen.getByLabelText('Explain: Tickets')).toBeInTheDocument();
      expect(screen.getByLabelText('Explain: Story Points')).toBeInTheDocument();
    });
  });

  it('opens explain modal on click', async () => {
    render(<IcPersonalDashboard refreshKey={0} project={null} />);
    await waitFor(() => screen.getByLabelText('Explain: Cycle Time p50'));
    fireEvent.click(screen.getByLabelText('Explain: Cycle Time p50'));
    await waitFor(() => {
      expect(screen.getByText('Got it')).toBeInTheDocument();
    });
  });

  it('shows dynamic trace in explain modal when available', async () => {
    render(<IcPersonalDashboard refreshKey={0} project={null} />);
    await waitFor(() => screen.getByLabelText('Explain: Cycle Time p50'));
    fireEvent.click(screen.getByLabelText('Explain: Cycle Time p50'));
    await waitFor(() => {
      expect(screen.getByText(/filtered to my_account_id/)).toBeInTheDocument();
    });
  });
});
