import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../api', () => ({
  getCtoOrgMetrics: vi.fn().mockResolvedValue({
    data: {
      throughputByProject: [
        { projectKey: 'ALPHA', projectName: 'Alpha', weeks: [{ week: '1/1', count: 5, storyPoints: 15 }] },
      ],
      cycleTimeByProject: [
        { projectKey: 'ALPHA', projectName: 'Alpha', p50: 24, p85: 48, p95: 72 },
      ],
      bugEscapeRate: 0.12,
      techDebtRatio: 0.25,
      flowEfficiency: { average: 35, median: 30 },
      headcountNormalizedThroughput: 4.2,
      weeklyThroughput: [{ week: '1/1', count: 10, storyPoints: 30 }],
      totalTickets: 42,
      totalStoryPoints: 120,
      totalProjects: 2,
      period: 'all',
      deliveryPredictability: [
        { projectKey: 'ALPHA', projectName: 'Alpha', coefficientOfVariation: 25 },
      ],
      workTypeByProject: [
        { projectKey: 'ALPHA', projectName: 'Alpha', types: [{ type: 'Story', count: 8 }, { type: 'Bug', count: 2 }] },
      ],
      traces: {
        totalTickets: '2 projects → period filter → 42 unique tickets → 120 SP',
        bugEscapeRate: '42 unique tickets → 5 bugs, 37 non-bugs → rate 12.0%',
        techDebtRatio: '42 tickets → 10 bugs + tech-debt-labeled → ratio 25.0%',
        flowEfficiency: '42 unique timelines → 40 had efficiency → avg 35.0%, median 30.0%',
        headcount: '42 tickets / 10 tracked engineers = 4.2/engineer',
      },
    },
  }),
  syncAllProjects: vi.fn().mockResolvedValue({ data: {} }),
  getAiConfig: vi.fn().mockResolvedValue({ data: { hasKey: false } }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import CtoOrgDashboard from '../CtoOrgDashboard';
import { syncAllProjects } from '../../api';

describe('CtoOrgDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders KPI cards with data', async () => {
    render(<CtoOrgDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('12.0%')).toBeInTheDocument();
      expect(screen.getByText('25.0%')).toBeInTheDocument();
      expect(screen.getByText('35.0%')).toBeInTheDocument();
    });
  });

  it('shows "Organizational Health Radar" heading', async () => {
    render(<CtoOrgDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Organizational Health Radar')).toBeInTheDocument();
    });
  });

  it('shows period selector with all options', async () => {
    render(<CtoOrgDashboard refreshKey={0} project={null} />);
    expect(screen.getByText('All Time')).toBeInTheDocument();
    expect(screen.getByText('Quarterly')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Weekly')).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('shows headcount-normalized throughput', async () => {
    render(<CtoOrgDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('4.2')).toBeInTheDocument();
      expect(screen.getByText('Headcount-Normalized Throughput')).toBeInTheDocument();
    });
  });

  it('calls syncAllProjects on sync', async () => {
    render(<CtoOrgDashboard refreshKey={0} project={null} />);
    await waitFor(() => expect(screen.getByText('Sync All Projects')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Sync All Projects'));
    await waitFor(() => {
      expect(syncAllProjects).toHaveBeenCalled();
    });
  });

  it('shows project count in subtitle', async () => {
    render(<CtoOrgDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      // The MetricCard for Total Tickets shows SP + project count as subtitle
      expect(screen.getByText(/120 SP across 2 projects/)).toBeInTheDocument();
    });
  });

  it('shows traffic light dots for KPIs', async () => {
    render(<CtoOrgDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Bug Escape Rate')).toBeInTheDocument();
      expect(screen.getByText('Tech Debt Ratio')).toBeInTheDocument();
      expect(screen.getByText('Flow Efficiency')).toBeInTheDocument();
    });
  });

  it('shows explain buttons on traffic-light cards', async () => {
    render(<CtoOrgDashboard refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Explain: Bug Escape Rate')).toBeInTheDocument();
      expect(screen.getByLabelText('Explain: Tech Debt Ratio')).toBeInTheDocument();
      expect(screen.getByLabelText('Explain: Flow Efficiency')).toBeInTheDocument();
    });
  });

  it('opens explain modal on click', async () => {
    render(<CtoOrgDashboard refreshKey={0} project={null} />);
    await waitFor(() => screen.getByLabelText('Explain: Bug Escape Rate'));
    fireEvent.click(screen.getByLabelText('Explain: Bug Escape Rate'));
    await waitFor(() => {
      expect(screen.getByText('Got it')).toBeInTheDocument();
    });
  });

  it('shows dynamic trace in explain modal when available', async () => {
    render(<CtoOrgDashboard refreshKey={0} project={null} />);
    await waitFor(() => screen.getByLabelText('Explain: Bug Escape Rate'));
    fireEvent.click(screen.getByLabelText('Explain: Bug Escape Rate'));
    await waitFor(() => {
      expect(screen.getByText(/42 unique tickets → 5 bugs/)).toBeInTheDocument();
    });
  });
});
