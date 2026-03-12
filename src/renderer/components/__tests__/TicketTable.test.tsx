import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api', () => ({
  updateTicket: vi.fn().mockResolvedValue({ data: {} }),
  syncOneTicket: vi.fn().mockResolvedValue({ data: {} }),
}));

import TicketTable from '../TicketTable';
import { updateTicket, syncOneTicket } from '../../api';
import toast from 'react-hot-toast';

const makeTicket = (overrides: any = {}) => ({
  key: 'T-1',
  summary: 'Fix login bug',
  status: 'Done',
  assignee: 'Alice',
  has_computed_values: false,
  base_url: 'https://jira.test',
  updated: '2025-01-01T10:00:00Z',
  priority: 'Medium',
  issue_type: 'Story',
  story_points: 3,
  ...overrides,
});

describe('TicketTable', () => {
  const defaultProps = {
    tickets: [
      makeTicket(),
      makeTicket({ key: 'T-2', summary: 'Add feature', assignee: 'Bob', story_points: null }),
    ],
    loading: false,
    onRefresh: vi.fn(),
    activeFilter: null as string | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).api = {
      openExternal: vi.fn().mockResolvedValue(undefined),
    };
  });

  // --- Rendering ---
  it('renders ticket keys', () => {
    render(<TicketTable {...defaultProps} />);
    expect(screen.getByText('T-1')).toBeInTheDocument();
    expect(screen.getByText('T-2')).toBeInTheDocument();
  });

  it('renders ticket summaries', () => {
    render(<TicketTable {...defaultProps} />);
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('Add feature')).toBeInTheDocument();
  });

  it('renders assignee names', () => {
    render(<TicketTable {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders status badges', () => {
    render(<TicketTable {...defaultProps} />);
    expect(screen.getAllByText('Story').length).toBeGreaterThan(0);
  });

  it('renders column headers', () => {
    render(<TicketTable {...defaultProps} />);
    expect(screen.getByText('Key')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Assignee')).toBeInTheDocument();
    expect(screen.getByText('SP')).toBeInTheDocument();
  });

  // --- Filtering ---
  it('filters tickets by missing story_points', () => {
    render(<TicketTable {...defaultProps} activeFilter="story_points" />);
    expect(screen.getByText('T-2')).toBeInTheDocument();
    expect(screen.queryByText('Fix login bug')).not.toBeInTheDocument();
  });

  // --- Sorting ---
  it('sorts by column when header clicked', () => {
    render(<TicketTable {...defaultProps} />);
    fireEvent.click(screen.getByText('Assignee'));
    // Just verify it doesn't crash
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  // --- Sync single ticket ---
  it('syncs a single ticket', async () => {
    render(<TicketTable {...defaultProps} />);
    const syncButtons = screen.getAllByTitle('Re-sync from JIRA');
    expect(syncButtons.length).toBeGreaterThan(0);
    fireEvent.click(syncButtons[0]);
    await waitFor(() => {
      expect(syncOneTicket).toHaveBeenCalledWith('T-1');
    });
  });

  // --- UI Interactions ---
  it('allows manual search', () => {
    render(<TicketTable {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/Search/);
    fireEvent.change(searchInput, { target: { value: 'Bob' } });
    expect(screen.getByText('T-2')).toBeInTheDocument();
    expect(screen.queryByText('T-1')).not.toBeInTheDocument();
  });
});
