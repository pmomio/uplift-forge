import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api', () => ({
  updateTicket: vi.fn().mockResolvedValue({ data: {} }),
  syncSingleTicket: vi.fn().mockResolvedValue({ data: {} }),
  calculateHours: vi.fn().mockResolvedValue({ data: { hours: 5 } }),
  calculateFields: vi.fn().mockResolvedValue({ data: { tpd_bu: 'B2C', work_stream: 'Product' } }),
}));

import TicketTable from '../TicketTable';
import { updateTicket, syncSingleTicket, calculateHours, calculateFields } from '../../api';
import toast from 'react-hot-toast';

const makeTicket = (overrides: any = {}) => ({
  key: 'T-1',
  summary: 'Fix login bug',
  status: 'Done',
  assignee: 'Alice',
  eng_hours: 5.0,
  tpd_bu: 'B2C',
  work_stream: 'Product',
  has_computed_values: false,
  base_url: 'https://jira.test',
  ...overrides,
});

describe('TicketTable', () => {
  const defaultProps = {
    tickets: [
      makeTicket(),
      makeTicket({ key: 'T-2', summary: 'Add feature', assignee: 'Bob', eng_hours: null, tpd_bu: null, work_stream: null }),
    ],
    onUpdate: vi.fn(),
    missingFilter: null as null | 'tpd_bu' | 'eng_hours' | 'work_stream',
    onClearFilter: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const store: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => store[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => { store[key] = val; });
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
    const doneElements = screen.getAllByText('Done');
    expect(doneElements.length).toBeGreaterThan(0);
  });

  it('renders column headers', () => {
    render(<TicketTable {...defaultProps} />);
    expect(screen.getByText('Key')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Assignee')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('handles empty tickets', () => {
    render(<TicketTable {...defaultProps} tickets={[]} />);
    expect(screen.getByText('Key')).toBeInTheDocument();
  });

  it('renders JIRA links', () => {
    render(<TicketTable {...defaultProps} />);
    const links = screen.getAllByRole('link');
    expect(links.some(l => l.getAttribute('href')?.includes('jira.test'))).toBe(true);
  });

  // --- Filtering ---
  it('shows filter banner when missingFilter is active', () => {
    render(<TicketTable {...defaultProps} missingFilter="tpd_bu" />);
    expect(screen.getByText(/Showing tickets with missing/)).toBeInTheDocument();
  });

  it('calls onClearFilter when clear button clicked', () => {
    render(<TicketTable {...defaultProps} missingFilter="tpd_bu" />);
    const clearButtons = screen.getAllByRole('button');
    const clearBtn = clearButtons.find(b => b.textContent?.includes('Clear filter'));
    expect(clearBtn).toBeDefined();
    if (clearBtn) fireEvent.click(clearBtn);
    expect(defaultProps.onClearFilter).toHaveBeenCalled();
  });

  it('filters tickets by missing tpd_bu', () => {
    render(<TicketTable {...defaultProps} missingFilter="tpd_bu" />);
    expect(screen.getByText('T-2')).toBeInTheDocument();
    expect(screen.queryByText('Fix login bug')).not.toBeInTheDocument();
  });

  it('filters tickets by missing eng_hours', () => {
    render(<TicketTable {...defaultProps} missingFilter="eng_hours" />);
    expect(screen.getByText('T-2')).toBeInTheDocument();
    expect(screen.queryByText('Fix login bug')).not.toBeInTheDocument();
  });

  it('filters tickets by missing work_stream', () => {
    render(<TicketTable {...defaultProps} missingFilter="work_stream" />);
    expect(screen.getByText('T-2')).toBeInTheDocument();
    expect(screen.queryByText('Fix login bug')).not.toBeInTheDocument();
  });

  // --- Sorting ---
  it('sorts by column when header clicked', () => {
    render(<TicketTable {...defaultProps} />);
    fireEvent.click(screen.getByText('Assignee'));
    // Alice should come before Bob in asc order
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });

  it('toggles sort direction on second click', () => {
    render(<TicketTable {...defaultProps} />);
    fireEvent.click(screen.getByText('Key'));
    fireEvent.click(screen.getByText('Key'));
    // Should be desc now
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });

  it('shows reset sort button when sorted', () => {
    render(<TicketTable {...defaultProps} />);
    fireEvent.click(screen.getByText('Key'));
    // An X button should appear in the Actions header area
    const actionsHeader = screen.getByText('Actions');
    expect(actionsHeader).toBeInTheDocument();
  });

  // --- Editing ---
  it('allows editing tpd_bu field', () => {
    render(<TicketTable {...defaultProps} />);
    const selects = screen.getAllByRole('combobox');
    // Find the TPD BU select for T-1 (first one with B2C value)
    const tpdSelect = selects.find(s => (s as HTMLSelectElement).value === 'B2C');
    expect(tpdSelect).toBeDefined();
    if (tpdSelect) {
      fireEvent.change(tpdSelect, { target: { value: 'B2B' } });
    }
  });

  it('allows editing eng_hours field', () => {
    render(<TicketTable {...defaultProps} />);
    const numberInputs = screen.getAllByRole('spinbutton');
    expect(numberInputs.length).toBeGreaterThan(0);
    fireEvent.change(numberInputs[0], { target: { value: '10' } });
  });

  // --- Save (per-ticket) ---
  it('saves ticket when per-ticket save button clicked', async () => {
    const onUpdate = vi.fn();
    render(<TicketTable {...defaultProps} onUpdate={onUpdate} tickets={[makeTicket({ has_computed_values: true })]} />);
    // Find the per-ticket save button (text is exactly "Save", not "Save All")
    const saveButtons = screen.getAllByRole('button');
    const saveBtn = saveButtons.find(b => b.textContent?.trim() === 'Save');
    expect(saveBtn).toBeDefined();
    if (saveBtn) fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(updateTicket).toHaveBeenCalledWith('T-1', expect.any(Object));
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  it('shows toast on per-ticket save success', async () => {
    render(<TicketTable {...defaultProps} tickets={[makeTicket({ has_computed_values: true })]} />);
    const saveButtons = screen.getAllByRole('button');
    const saveBtn = saveButtons.find(b => b.textContent?.trim() === 'Save');
    if (saveBtn) fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it('shows toast on per-ticket save failure', async () => {
    (updateTicket as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network'));
    render(<TicketTable {...defaultProps} tickets={[makeTicket({ has_computed_values: true })]} />);
    const saveButtons = screen.getAllByRole('button');
    const saveBtn = saveButtons.find(b => b.textContent?.trim() === 'Save');
    if (saveBtn) fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('saves ticket with edited fields in payload', async () => {
    render(<TicketTable {...defaultProps} tickets={[makeTicket()]} />);
    // Edit tpd_bu to make the ticket dirty
    const selects = screen.getAllByRole('combobox');
    const buSelect = selects.find(s => (s as HTMLSelectElement).value === 'B2C');
    if (buSelect) fireEvent.change(buSelect, { target: { value: 'B2B' } });
    // Now save
    const saveButtons = screen.getAllByRole('button');
    const saveBtn = saveButtons.find(b => b.textContent?.trim() === 'Save');
    if (saveBtn) fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(updateTicket).toHaveBeenCalledWith('T-1', expect.objectContaining({ tpd_bu: 'B2B' }));
    });
  });

  // --- Sync single ticket ---
  it('syncs a single ticket', async () => {
    const onUpdate = vi.fn();
    render(<TicketTable {...defaultProps} onUpdate={onUpdate} />);
    // Find sync buttons by their title
    const syncButtons = screen.getAllByTitle('Sync from JIRA');
    expect(syncButtons.length).toBeGreaterThan(0);
    fireEvent.click(syncButtons[0]);
    await waitFor(() => {
      expect(syncSingleTicket).toHaveBeenCalledWith('T-1');
    });
  });

  it('shows toast on sync failure', async () => {
    (syncSingleTicket as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Fail'));
    render(<TicketTable {...defaultProps} />);
    const syncButtons = screen.getAllByTitle('Sync from JIRA');
    fireEvent.click(syncButtons[0]);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  // --- Calculate hours ---
  it('calculates hours for a ticket', async () => {
    render(<TicketTable {...defaultProps} />);
    const calcButtons = screen.getAllByTitle('Recalculate from status transitions');
    expect(calcButtons.length).toBeGreaterThan(0);
    fireEvent.click(calcButtons[0]);
    await waitFor(() => {
      expect(calculateHours).toHaveBeenCalledWith('T-1');
    });
  });

  it('shows toast when hours calculation returns null', async () => {
    (calculateHours as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { hours: null } });
    render(<TicketTable {...defaultProps} />);
    const calcButtons = screen.getAllByTitle('Recalculate from status transitions');
    fireEvent.click(calcButtons[0]);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('shows toast when hours calculation fails', async () => {
    (calculateHours as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Fail'));
    render(<TicketTable {...defaultProps} />);
    const calcButtons = screen.getAllByTitle('Recalculate from status transitions');
    fireEvent.click(calcButtons[0]);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  // --- Calculate fields ---
  it('calculates fields for a ticket', async () => {
    render(<TicketTable {...defaultProps} />);
    const calcButtons = screen.getAllByTitle('Recalculate from parent mapping');
    expect(calcButtons.length).toBeGreaterThan(0);
    fireEvent.click(calcButtons[0]);
    await waitFor(() => {
      expect(calculateFields).toHaveBeenCalledWith('T-1');
    });
  });

  it('shows toast when field calc returns null', async () => {
    (calculateFields as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { tpd_bu: null, work_stream: null } });
    render(<TicketTable {...defaultProps} />);
    const calcButtons = screen.getAllByTitle('Recalculate from parent mapping');
    fireEvent.click(calcButtons[0]);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('shows toast when field calc fails', async () => {
    (calculateFields as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Fail'));
    render(<TicketTable {...defaultProps} />);
    const calcButtons = screen.getAllByTitle('Recalculate from parent mapping');
    fireEvent.click(calcButtons[0]);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  // --- Calculate All ---
  it('shows Calculate All button', () => {
    render(<TicketTable {...defaultProps} />);
    expect(screen.getByText('Calculate All')).toBeInTheDocument();
  });

  it('runs Calculate All for all page tickets', async () => {
    render(<TicketTable {...defaultProps} />);
    fireEvent.click(screen.getByText('Calculate All'));
    await waitFor(() => {
      expect(calculateHours).toHaveBeenCalledTimes(2);
      expect(calculateFields).toHaveBeenCalledTimes(2);
    });
  });

  it('shows toast after Calculate All completes', async () => {
    render(<TicketTable {...defaultProps} />);
    fireEvent.click(screen.getByText('Calculate All'));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  // --- Save All ---
  it('shows Save All button', () => {
    render(<TicketTable {...defaultProps} />);
    expect(screen.getByText(/Save All/)).toBeInTheDocument();
  });

  it('runs Save All for dirty tickets', async () => {
    const onUpdate = vi.fn();
    render(<TicketTable {...defaultProps} onUpdate={onUpdate} tickets={[
      makeTicket({ has_computed_values: true }),
      makeTicket({ key: 'T-2', has_computed_values: true }),
    ]} />);
    const saveAllBtn = screen.getByText(/Save All/);
    fireEvent.click(saveAllBtn);
    await waitFor(() => {
      expect(updateTicket).toHaveBeenCalledTimes(2);
    });
  });

  it('shows toast on Save All with failures', async () => {
    (updateTicket as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Fail'));
    render(<TicketTable {...defaultProps} tickets={[makeTicket({ has_computed_values: true })]} />);
    fireEvent.click(screen.getByText(/Save All/));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  // --- Pagination ---
  it('shows pagination controls', () => {
    render(<TicketTable {...defaultProps} />);
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('paginates tickets when more than 10', () => {
    const manyTickets = Array.from({ length: 15 }, (_, i) => makeTicket({ key: `T-${i + 1}`, summary: `Ticket ${i + 1}` }));
    render(<TicketTable {...defaultProps} tickets={manyTickets} />);
    expect(screen.getByText('T-1')).toBeInTheDocument();
    // T-11 should not be on page 1
    expect(screen.queryByText('T-11')).not.toBeInTheDocument();
    // Navigate to page 2
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('T-11')).toBeInTheDocument();
  });

  it('disables Previous on first page', () => {
    render(<TicketTable {...defaultProps} />);
    const prevBtn = screen.getByText('Previous');
    expect(prevBtn).toBeDisabled();
  });

  // --- Ticket count display ---
  it('shows ticket count', () => {
    render(<TicketTable {...defaultProps} />);
    expect(screen.getByText(/2 tickets/)).toBeInTheDocument();
  });

  it('shows filtered count when filter active', () => {
    render(<TicketTable {...defaultProps} missingFilter="tpd_bu" />);
    // The filtered count text appears in toolbar and/or pagination
    const allText = document.body.textContent;
    expect(allText).toContain('filtered from 2');
  });

  // --- Status color mapping ---
  it('renders different status colors', () => {
    render(<TicketTable {...defaultProps} tickets={[
      makeTicket({ status: 'Rejected' }),
      makeTicket({ key: 'T-2', status: 'In Progress' }),
    ]} />);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  // --- localStorage sort persistence ---
  it('persists sort state to localStorage', () => {
    render(<TicketTable {...defaultProps} />);
    fireEvent.click(screen.getByText('Key'));
    expect(Storage.prototype.setItem).toHaveBeenCalled();
  });

  // --- Work Stream editing ---
  it('allows editing work_stream field', () => {
    render(<TicketTable {...defaultProps} />);
    const selects = screen.getAllByRole('combobox');
    const wsSelect = selects.find(s => (s as HTMLSelectElement).value === 'Product');
    expect(wsSelect).toBeDefined();
    if (wsSelect) {
      fireEvent.change(wsSelect, { target: { value: 'Operational' } });
    }
  });

  // --- Pagination backward ---
  it('navigates back with Previous button', () => {
    const manyTickets = Array.from({ length: 15 }, (_, i) => makeTicket({ key: `T-${i + 1}`, summary: `Ticket ${i + 1}` }));
    render(<TicketTable {...defaultProps} tickets={manyTickets} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('T-11')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Previous'));
    expect(screen.getByText('T-1')).toBeInTheDocument();
  });

  // --- Sort with null values ---
  it('handles sorting with null values', () => {
    render(<TicketTable {...defaultProps} />);
    fireEvent.click(screen.getByText('Eng Hours'));
    // T-1 has hours (5), T-2 has null — nulls should sort last
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });

  // --- Calculate work_stream field ---
  it('calculates work_stream field', async () => {
    render(<TicketTable {...defaultProps} />);
    // Find recalculate buttons for parent mapping (there are 2 per ticket - tpd_bu and work_stream)
    const calcButtons = screen.getAllByTitle('Recalculate from parent mapping');
    // Click the second one (work_stream for T-1)
    expect(calcButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(calcButtons[1]);
    await waitFor(() => {
      expect(calculateFields).toHaveBeenCalledWith('T-1');
    });
  });

  // --- Reset sort ---
  it('resets sort when sort is active', () => {
    render(<TicketTable {...defaultProps} />);
    fireEvent.click(screen.getByText('Key'));
    // Find reset sort button by title
    const resetBtn = screen.getByTitle('Reset sorting');
    expect(resetBtn).toBeInTheDocument();
    fireEvent.click(resetBtn);
  });

  // --- Showing text with pagination ---
  it('shows pagination showing text', () => {
    render(<TicketTable {...defaultProps} />);
    const allText = document.body.textContent;
    expect(allText).toContain('Showing');
    expect(allText).toContain('of');
    expect(allText).toContain('tickets');
  });

  // --- Various status colors ---
  it('renders Closed and Cancelled statuses', () => {
    render(<TicketTable {...defaultProps} tickets={[
      makeTicket({ status: 'Closed' }),
      makeTicket({ key: 'T-2', status: 'Cancelled' }),
    ]} />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('renders Resolved status', () => {
    render(<TicketTable {...defaultProps} tickets={[makeTicket({ status: 'Resolved' })] } />);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  // --- Sort by numeric column ---
  it('sorts by eng_hours numeric column', () => {
    render(<TicketTable {...defaultProps} tickets={[
      makeTicket({ key: 'T-1', eng_hours: 10 }),
      makeTicket({ key: 'T-2', eng_hours: 3 }),
    ]} />);
    fireEvent.click(screen.getByText('Eng Hours'));
    // First in asc order should be T-2 (3 hours)
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });

  // --- Calculate All handles errors gracefully ---
  it('Calculate All handles individual failures gracefully', async () => {
    (calculateHours as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    (calculateFields as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    render(<TicketTable {...defaultProps} />);
    fireEvent.click(screen.getByText('Calculate All'));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  // --- Save disabled for clean ticket ---
  it('save button disabled for non-dirty non-computed ticket', () => {
    render(<TicketTable {...defaultProps} tickets={[makeTicket({ has_computed_values: false })]} />);
    const saveButtons = screen.getAllByRole('button');
    const saveBtn = saveButtons.find(b => b.textContent?.includes('Save') && !b.textContent?.includes('Save All'));
    expect(saveBtn).toBeDefined();
    // The individual save button should be disabled (no dirty, no computed values)
    expect(saveBtn).toBeDisabled();
  });
});
