import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api', () => ({
  getEmTeamMetrics: vi.fn(),
  triggerSync: vi.fn().mockResolvedValue({ data: {} }),
  syncAllProjects: vi.fn().mockResolvedValue({ data: {} }),
  getAiConfig: vi.fn().mockResolvedValue({ data: { hasKey: false } }),
}));

import EmTeamDashboard from '../EmTeamDashboard';
import { getEmTeamMetrics, triggerSync } from '../../api';

const mockMetrics = {
  totalTickets: 100,
  cycleTime: { p50: 24, p85: 48, p95: 72, trend: [] },
  reworkRate: 15,
  spAccuracy: 105,
  avgReviewDurationHours: 4.5,
  unestimatedRatio: 5,
  weeklyThroughput: [],
  workTypeDistribution: [],
  agingWip: [],
  leadTimeBreakdown: { activePercent: 55, waitPercent: 30, blockedPercent: 15 },
  traces: {
    totalTickets: '100 resolved tickets',
    cycleTimeP50: 'p50 = 24.0h',
    reworkRate: '15% rework',
    spAccuracy: '105% accuracy',
    avgReviewDuration: '4.5h reviews',
    unestimatedRatio: '5% unestimated',
  },
};

describe('EmTeamDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getEmTeamMetrics as any).mockResolvedValue({ data: mockMetrics });
  });

  it('renders loading state initially', () => {
    (getEmTeamMetrics as any).mockReturnValue(new Promise(() => {}));
    const { container } = render(<EmTeamDashboard refreshKey={0} project={null} />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders KPI cards with data', async () => {
    render(<EmTeamDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('24.00')).toBeInTheDocument();
      expect(screen.getByText('15.00')).toBeInTheDocument();
    });
  });

  it('shows unestimated ratio card', async () => {
    render(<EmTeamDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Unestimated Ratio')).toBeInTheDocument();
      expect(screen.getByText('5.00')).toBeInTheDocument();
    });
  });

  it('shows period selector', async () => {
    render(<EmTeamDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('4W')).toBeInTheDocument();
      expect(screen.getByText('12W')).toBeInTheDocument();
      expect(screen.getByText('All')).toBeInTheDocument();
    });
  });

  it('calls triggerSync on button click for single project', async () => {
    render(<EmTeamDashboard refreshKey={0} project={{ key: 'PROJ', name: 'Proj', lead: null, avatar: null }} />);
    await waitFor(() => screen.getByText('Sync & Refresh'));
    fireEvent.click(screen.getByText('Sync & Refresh'));
    await waitFor(() => {
      expect(triggerSync).toHaveBeenCalledWith('PROJ');
    });
  });
});
