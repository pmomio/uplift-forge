import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../api', () => ({
  getEmIndividualMetrics: vi.fn().mockResolvedValue({
    data: {
      engineers: [
        {
          accountId: 'a1', displayName: 'Alice',
          cycleTimeP50: 24, cycleTimeP85: 48,
          reworkRate: 0.1, bugRatio: 0.05,
          tickets: 20, storyPoints: 50,
          complexityScore: 2.5, focusRatio: 0.8,
          spAccuracy: 95, firstTimePassRate: 0.9,
        },
        {
          accountId: 'a2', displayName: 'Bob',
          cycleTimeP50: 36, cycleTimeP85: 72,
          reworkRate: 0.2, bugRatio: 0.15,
          tickets: 15, storyPoints: 30,
          complexityScore: 2.0, focusRatio: 0.7,
          spAccuracy: 110, firstTimePassRate: 0.8,
        },
      ],
      teamAverages: {
        cycleTimeP50: 30, reworkRate: 0.15, bugRatio: 0.1,
        tickets: 35, storyPoints: 80,
        spAccuracy: 102, firstTimePassRate: 0.85,
      },
      period: 'all',
      traces: {
        teamAvg: '3 timelines → period filter → 2 engineers → team avg cycle p50 30h, rework 15%',
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

import EmIndividualDashboard from '../EmIndividualDashboard';

describe('EmIndividualDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders engineer names', async () => {
    render(<EmIndividualDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('shows team averages cards', async () => {
    render(<EmIndividualDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Team Averages')).toBeInTheDocument();
    });
  });

  it('shows period selector', () => {
    render(<EmIndividualDashboard refreshKey={0} project={null} />);
    expect(screen.getByText('All Time')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
  });

  it('expands engineer card on click', async () => {
    render(<EmIndividualDashboard refreshKey={0} project={null} />);
    await waitFor(() => screen.getByText('Alice'));
    fireEvent.click(screen.getByText('Alice'));
    await waitFor(() => {
      expect(screen.getByText('Complexity')).toBeInTheDocument();
      expect(screen.getByText('Focus Ratio')).toBeInTheDocument();
    });
  });

  it('shows heading with project name', async () => {
    render(<EmIndividualDashboard refreshKey={0} project={{ key: 'TEST', name: 'Test Project', lead: null, avatar: null }} />);
    await waitFor(() => {
      expect(screen.getByText(/Test Project — Individual Metrics/)).toBeInTheDocument();
    });
  });

  it('shows explain buttons on team average cards', async () => {
    render(<EmIndividualDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Explain: Cycle p50')).toBeInTheDocument();
      expect(screen.getByLabelText('Explain: Rework')).toBeInTheDocument();
      expect(screen.getByLabelText('Explain: Bug Ratio')).toBeInTheDocument();
      expect(screen.getByLabelText('Explain: Tickets')).toBeInTheDocument();
      expect(screen.getByLabelText('Explain: Story Points')).toBeInTheDocument();
    });
  });

  it('opens explain modal on click', async () => {
    render(<EmIndividualDashboard refreshKey={0} project={null} />);
    await waitFor(() => screen.getByLabelText('Explain: Cycle p50'));
    fireEvent.click(screen.getByLabelText('Explain: Cycle p50'));
    await waitFor(() => {
      expect(screen.getByText('Got it')).toBeInTheDocument();
    });
  });

  it('shows dynamic trace in explain modal when available', async () => {
    render(<EmIndividualDashboard refreshKey={0} project={null} />);
    await waitFor(() => screen.getByLabelText('Explain: Cycle p50'));
    fireEvent.click(screen.getByLabelText('Explain: Cycle p50'));
    await waitFor(() => {
      expect(screen.getByText(/3 timelines → period filter/)).toBeInTheDocument();
    });
  });
});
