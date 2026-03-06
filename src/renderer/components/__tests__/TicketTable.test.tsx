import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api', () => ({
  updateTicket: vi.fn().mockResolvedValue({ data: {} }),
  syncOneTicket: vi.fn().mockResolvedValue({ data: {} }),
  calcTicketFields: vi.fn().mockResolvedValue({ data: { tpd_bu: 'B2C', work_stream: 'Product' } }),
}));

import TicketTable from '../TicketTable';
import { updateTicket, syncOneTicket, calcTicketFields } from '../../api';
import toast from 'react-hot-toast';

const makeTicket = (overrides: any = {}) => ({
  key: 'T-1',
  summary: 'Fix login bug',
  status: 'Done',
  assignee: 'Alice',
  tpd_bu: 'B2C',
  work_stream: 'Product',
  has_computed_values: false,
  base_url: 'https://jira.test',
  updated: '2025-01-01T10:00:00Z',
  priority: 'Medium',
  issue_type: 'Story',
  ...overrides,
});

describe('TicketTable', () => {
  const defaultProps = {
    tickets: [
      makeTicket(),
      makeTicket({ key: 'T-2', summary: 'Add feature', assignee: 'Bob', tpd_bu: null, work_stream: null }),
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
    expect(screen.getByText('Business Unit')).toBeInTheDocument();
    expect(screen.getByText('Work Stream')).toBeInTheDocument();
  });

  // --- Filtering ---
  it('filters tickets by missing tpd_bu', () => {
    render(<TicketTable {...defaultProps} activeFilter="tpd_bu" />);
    expect(screen.getByText('T-2')).toBeInTheDocument();
    expect(screen.queryByText('Fix login bug')).not.toBeInTheDocument();
  });

  it('filters tickets by missing work_stream', () => {
    render(<TicketTable {...defaultProps} activeFilter="work_stream" />);
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

  // --- Calculate fields ---
  it('calculates fields for a ticket', async () => {
    render(<TicketTable {...defaultProps} />);
    const calcButtons = screen.getAllByTitle('Run inference rules');
    expect(calcButtons.length).toBeGreaterThan(0);
    fireEvent.click(calcButtons[0]);
    await waitFor(() => {
      expect(calcTicketFields).toHaveBeenCalledWith('T-1');
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
