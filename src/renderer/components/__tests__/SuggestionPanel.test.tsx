import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../api', () => ({
  getAiSuggestions: vi.fn(),
  getConfig: vi.fn().mockResolvedValue({ data: { persona: 'engineering_manager' } }),
}));

import SuggestionPanel from '../SuggestionPanel';
import { getAiSuggestions } from '../../api';
import type { AiSuggestRequest } from '../../../shared/types';

const mockRequest: AiSuggestRequest = {
  metricKey: 'bug_ratio',
  metricLabel: 'Bug Ratio',
  currentValue: 0.25,
  previousValue: 0.18,
  trendDirection: 'up',
  trendPct: 39,
  helpContent: 'Bug percentage.',
  context: 'team',
};

describe('SuggestionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <SuggestionPanel open={false} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders panel when open', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['Do this'], error: undefined },
    });
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    expect(screen.getByText('AI Suggestions')).toBeInTheDocument();
  });

  it('shows metric label in header', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['Do this'] },
    });
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    expect(screen.getByText('Bug Ratio')).toBeInTheDocument();
  });

  it('shows current value in context section', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['Improve'] },
    });
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    expect(screen.getByText('0.25')).toBeInTheDocument();
  });

  it('shows trend text', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['Improve'] },
    });
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    // Trend text is "up 39%"
    expect(screen.getByText('up 39%')).toBeInTheDocument();
  });

  it('shows previous value', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['Improve'] },
    });
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    expect(screen.getByText('0.18')).toBeInTheDocument();
  });

  it('fetches suggestions on open', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['Suggestion A', 'Suggestion B'] },
    });
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    await waitFor(() => {
      expect(getAiSuggestions).toHaveBeenCalledWith(mockRequest);
    });
  });

  it('displays suggestions after loading', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['Fix the bug ratio', 'Improve test coverage'] },
    });
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Fix the bug ratio')).toBeInTheDocument();
      expect(screen.getByText('Improve test coverage')).toBeInTheDocument();
    });
  });

  it('displays numbered suggestion badges', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['First', 'Second', 'Third'] },
    });
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('shows error state with retry button', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: [], error: 'Connection failed' },
    });
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Unable to get suggestions')).toBeInTheDocument();
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('retries on Retry button click', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { suggestions: [], error: 'Fail' } })
      .mockResolvedValueOnce({ data: { suggestions: ['Works now'] } });
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    await waitFor(() => expect(screen.getByText('Retry')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => {
      expect(screen.getByText('Works now')).toBeInTheDocument();
    });
    expect(getAiSuggestions).toHaveBeenCalledTimes(2);
  });

  it('shows error when fetch throws', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Failed to connect to AI provider.')).toBeInTheDocument();
    });
  });

  it('calls onClose when backdrop is clicked', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['A'] },
    });
    const onClose = vi.fn();
    render(
      <SuggestionPanel open={true} onClose={onClose} request={mockRequest} aiProvider="openai" />,
    );
    // Backdrop is the first child div with backdrop-blur class
    const backdrop = document.querySelector('.backdrop-blur-sm');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['A'] },
    });
    const onClose = vi.fn();
    render(
      <SuggestionPanel open={true} onClose={onClose} request={mockRequest} aiProvider="openai" />,
    );
    // Close button is in the header
    const closeBtn = document.querySelector('button .lucide-x')?.closest('button');
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape key', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['A'] },
    });
    const onClose = vi.fn();
    render(
      <SuggestionPanel open={true} onClose={onClose} request={mockRequest} aiProvider="openai" />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows OpenAI in footer when provider is openai', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['A'] },
    });
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Powered by OpenAI/)).toBeInTheDocument();
    });
  });

  it('shows Claude in footer when provider is claude', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['A'] },
    });
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={mockRequest} aiProvider="claude" />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Powered by Claude/)).toBeInTheDocument();
    });
  });

  it('does not fetch when request is null', () => {
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={null} aiProvider="openai" />,
    );
    expect(getAiSuggestions).not.toHaveBeenCalled();
  });

  it('resets result when panel closes', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['Visible'] },
    });
    const { rerender } = render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    await waitFor(() => expect(screen.getByText('Visible')).toBeInTheDocument());
    rerender(
      <SuggestionPanel open={false} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    expect(screen.queryByText('Visible')).not.toBeInTheDocument();
  });

  it('shows team average in context when provided', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['A'] },
    });
    const reqWithTeamAvg = { ...mockRequest, teamAverageValue: 0.15 };
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={reqWithTeamAvg} aiProvider="openai" />,
    );
    expect(screen.getByText('Team Avg')).toBeInTheDocument();
    expect(screen.getByText('0.15')).toBeInTheDocument();
  });

  it('applies emerald color for upward trend', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['A'] },
    });
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={mockRequest} aiProvider="openai" />,
    );
    const trendEl = screen.getByText('up 39%');
    expect(trendEl.className).toContain('emerald');
  });

  it('applies rose color for downward trend', async () => {
    (getAiSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { suggestions: ['A'] },
    });
    const downReq = { ...mockRequest, trendDirection: 'down' as const, trendPct: -10 };
    render(
      <SuggestionPanel open={true} onClose={vi.fn()} request={downReq} aiProvider="openai" />,
    );
    const trendEl = screen.getByText('down 10%');
    expect(trendEl.className).toContain('rose');
  });
});
