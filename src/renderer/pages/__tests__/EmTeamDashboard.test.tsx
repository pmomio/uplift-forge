import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api', () => ({
  getEmTeamMetrics: vi.fn(),
  getAiConfig: vi.fn(),
  getAiSuggestions: vi.fn(),
  syncAllProjects: vi.fn(),
  triggerSync: vi.fn(),
}));

import EmTeamDashboard from '../EmTeamDashboard';
import { getEmTeamMetrics, getAiConfig, triggerSync } from '../../api';

const mockData = {
  totalTickets: 100,
  totalStoryPoints: 350,
  cycleTime: {
    p50: 24,
    p85: 72,
    p95: 120,
    trend: [{ week: '1/1', p50: 20, p85: 60 }],
  },
  weeklyThroughput: [{ week: '1/1', count: 10, storyPoints: 35 }],
  contributionSpread: [],
  agingWip: [],
  bugRatioByEngineer: [],
  reworkRate: 15,
  spAccuracy: 85,
  firstTimePassRate: 85,
  avgReviewDurationHours: 4,
  workTypeDistribution: [{ type: 'Story', count: 80, percentage: 80 }],
  unestimatedRatio: 5,
  leadTimeBreakdown: { activePercent: 40, waitPercent: 50, blockedPercent: 10 },
  period: '4w',
  traces: { totalTickets: '100 tickets total' },
};

describe('EmTeamDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getEmTeamMetrics as any).mockResolvedValue({ data: mockData });
    (getAiConfig as any).mockResolvedValue({ data: { hasKey: false } });
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
      expect(screen.getByText('24')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
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
    (triggerSync as any).mockResolvedValue({ data: { status: 'success' } });
    render(<EmTeamDashboard refreshKey={0} project={{ key: 'PROJ', name: 'P', lead: null, avatar: null }} projectCount={1} />);
    await waitFor(() => screen.getByText('Sync & Refresh'));
    fireEvent.click(screen.getByText('Sync & Refresh'));
    expect(triggerSync).toHaveBeenCalled();
  });

  it('shows unestimated ratio card', async () => {
    render(<EmTeamDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Unestimated Ratio')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });
});
