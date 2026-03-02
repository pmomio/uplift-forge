import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api', () => ({
  listEpics: vi.fn(),
  syncEpics: vi.fn(),
  getAiConfig: vi.fn(),
  getAiSuggestions: vi.fn(),
}));

import EpicTracker from '../EpicTracker';
import { listEpics, syncEpics, getAiConfig, getAiSuggestions } from '../../api';
import toast from 'react-hot-toast';
import type { EpicSummary } from '../../../shared/types';

const mockEpic: EpicSummary = {
  key: 'EPIC-1',
  summary: 'Build new feature',
  totalTickets: 5,
  resolvedTickets: 2,
  totalSP: 20,
  resolvedSP: 8,
  progressPct: 0.4,
  avgCycleTime: 12.5,
  riskScore: 0.45,
  riskLevel: 'medium',
  riskFactors: ['Only 40% complete with 3 of 5 tickets still open'],
  childTickets: [
    { key: 'T-1', summary: 'Task 1', status: 'Done', assignee: 'Alice', assignee_id: 'a1', issue_type: 'Story', story_points: 3, eng_hours: 10, tpd_bu: null, work_stream: null, resolved: '2025-01-01', has_computed_values: false },
    { key: 'T-2', summary: 'Task 2', status: 'In Progress', assignee: 'Bob', assignee_id: 'b1', issue_type: 'Story', story_points: 5, eng_hours: null, tpd_bu: null, work_stream: null, resolved: null, has_computed_values: false },
  ],
};

const mockEpicHigh: EpicSummary = {
  key: 'EPIC-2',
  summary: 'Fix bugs',
  totalTickets: 3,
  resolvedTickets: 0,
  totalSP: 9,
  resolvedSP: 0,
  progressPct: 0,
  avgCycleTime: null,
  riskScore: 0.75,
  riskLevel: 'high',
  riskFactors: ['0% complete'],
  childTickets: [],
};

describe('EpicTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listEpics as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [mockEpic, mockEpicHigh] });
    (syncEpics as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [mockEpic, mockEpicHigh] });
    (getAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { provider: 'openai', hasKey: false } });
  });

  it('renders page header', async () => {
    render(<EpicTracker refreshKey={0} />);
    await waitFor(() => {
      expect(screen.getByText('Epic Tracker')).toBeInTheDocument();
    });
  });

  it('renders personalized header with project', async () => {
    render(<EpicTracker refreshKey={0} project={{ key: 'P', name: 'Team X', lead: null, avatar: null }} />);
    await waitFor(() => {
      expect(screen.getByText(/Team X — Epic Tracker/)).toBeInTheDocument();
    });
  });

  it('fetches epics on mount', async () => {
    render(<EpicTracker refreshKey={0} />);
    await waitFor(() => {
      expect(listEpics).toHaveBeenCalled();
    });
  });

  it('shows loading state', () => {
    (listEpics as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<EpicTracker refreshKey={0} />);
    expect(screen.getByText('Loading epics...')).toBeInTheDocument();
  });

  it('shows empty state when no epics', async () => {
    (listEpics as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    render(<EpicTracker refreshKey={0} />);
    await waitFor(() => {
      expect(screen.getByText('No epics found')).toBeInTheDocument();
    });
  });

  it('displays summary stats', async () => {
    render(<EpicTracker refreshKey={0} />);
    await waitFor(() => {
      expect(screen.getByText('Total Epics')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 epics total
      expect(screen.getByText('High Risk')).toBeInTheDocument();
    });
  });

  it('displays epic cards', async () => {
    render(<EpicTracker refreshKey={0} />);
    await waitFor(() => {
      expect(screen.getByText('Build new feature')).toBeInTheDocument();
      expect(screen.getByText('Fix bugs')).toBeInTheDocument();
    });
  });

  it('shows epic key', async () => {
    render(<EpicTracker refreshKey={0} />);
    await waitFor(() => {
      expect(screen.getByText('EPIC-1')).toBeInTheDocument();
      expect(screen.getByText('EPIC-2')).toBeInTheDocument();
    });
  });

  it('shows progress percentage', async () => {
    render(<EpicTracker refreshKey={0} />);
    await waitFor(() => {
      expect(screen.getByText('40%')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  it('shows ticket counts', async () => {
    render(<EpicTracker refreshKey={0} />);
    await waitFor(() => {
      expect(screen.getByText('2/5 tickets')).toBeInTheDocument();
    });
  });

  it('expands epic on click', async () => {
    render(<EpicTracker refreshKey={0} />);
    await waitFor(() => screen.getByText('Build new feature'));
    // Click epic to expand
    fireEvent.click(screen.getByText('Build new feature'));
    await waitFor(() => {
      expect(screen.getByText('Risk Factors')).toBeInTheDocument();
      expect(screen.getByText(/Only 40% complete/)).toBeInTheDocument();
    });
  });

  it('shows child tickets when expanded', async () => {
    render(<EpicTracker refreshKey={0} />);
    await waitFor(() => screen.getByText('Build new feature'));
    fireEvent.click(screen.getByText('Build new feature'));
    await waitFor(() => {
      expect(screen.getByText('Child Tickets (2)')).toBeInTheDocument();
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
    });
  });

  it('collapses epic on second click', async () => {
    render(<EpicTracker refreshKey={0} />);
    await waitFor(() => screen.getByText('Build new feature'));
    fireEvent.click(screen.getByText('Build new feature'));
    await waitFor(() => screen.getByText('Risk Factors'));
    fireEvent.click(screen.getByText('Build new feature'));
    await waitFor(() => {
      expect(screen.queryByText('Risk Factors')).not.toBeInTheDocument();
    });
  });

  it('syncs on button click', async () => {
    render(<EpicTracker refreshKey={0} />);
    await waitFor(() => screen.getByText('Sync & Refresh'));
    fireEvent.click(screen.getByText('Sync & Refresh'));
    await waitFor(() => {
      expect(syncEpics).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Epics refreshed');
    });
  });

  it('shows error toast when sync fails', async () => {
    (syncEpics as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    render(<EpicTracker refreshKey={0} />);
    await waitFor(() => screen.getByText('Sync & Refresh'));
    fireEvent.click(screen.getByText('Sync & Refresh'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Sync failed');
    });
  });

  it('refetches when refreshKey changes', async () => {
    const { rerender } = render(<EpicTracker refreshKey={0} />);
    await waitFor(() => expect(listEpics).toHaveBeenCalledTimes(1));
    rerender(<EpicTracker refreshKey={1} />);
    await waitFor(() => expect(listEpics).toHaveBeenCalledTimes(2));
  });

  it('shows AI Risk Analysis button when expanded and AI configured', async () => {
    (getAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { provider: 'openai', hasKey: true } });
    render(<EpicTracker refreshKey={0} />);
    await waitFor(() => screen.getByText('Build new feature'));
    fireEvent.click(screen.getByText('Build new feature'));
    await waitFor(() => {
      expect(screen.getByText('AI Risk Analysis')).toBeInTheDocument();
    });
  });

  it('shows AI suggestions when returned', async () => {
    (getAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { provider: 'openai', hasKey: true } });
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['Split blocked tasks', 'Add more reviewers'] },
    });
    render(<EpicTracker refreshKey={0} />);
    await waitFor(() => screen.getByText('Build new feature'));
    fireEvent.click(screen.getByText('Build new feature'));
    await waitFor(() => screen.getByText('AI Risk Analysis'));
    fireEvent.click(screen.getByText('AI Risk Analysis'));
    await waitFor(() => {
      expect(screen.getByText('Split blocked tasks')).toBeInTheDocument();
      expect(screen.getByText('Add more reviewers')).toBeInTheDocument();
    });
  });
});
