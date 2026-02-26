import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TicketSummary from '../TicketSummary';

const makeTicket = (overrides: any = {}) => ({
  key: 'T-1',
  summary: 'Test',
  status: 'Done',
  assignee: 'Alice',
  eng_hours: 5,
  tpd_bu: 'B2C',
  work_stream: 'Product',
  has_computed_values: false,
  base_url: 'https://jira.test',
  ...overrides,
});

describe('TicketSummary', () => {
  it('displays total ticket count', () => {
    const tickets = [makeTicket(), makeTicket({ key: 'T-2' })];
    render(<TicketSummary tickets={tickets} activeFilter={null} onFilterChange={vi.fn()} />);
    // The ticket count is inside the "Tickets" stat card as a sibling span
    const ticketsLabel = screen.getByText('Tickets');
    const container = ticketsLabel.closest('div');
    expect(container?.textContent).toContain('2');
  });

  it('displays average hours', () => {
    const tickets = [makeTicket({ eng_hours: 10 }), makeTicket({ key: 'T-2', eng_hours: 20 })];
    render(<TicketSummary tickets={tickets} activeFilter={null} onFilterChange={vi.fn()} />);
    expect(screen.getByText('15.0')).toBeInTheDocument();
  });

  it('displays total hours', () => {
    const tickets = [makeTicket({ eng_hours: 10 }), makeTicket({ key: 'T-2', eng_hours: 6 })];
    render(<TicketSummary tickets={tickets} activeFilter={null} onFilterChange={vi.fn()} />);
    expect(screen.getByText('16.0h')).toBeInTheDocument();
  });

  it('displays fields complete percentage', () => {
    const tickets = [
      makeTicket(),
      makeTicket({ key: 'T-2', tpd_bu: null }),
    ];
    render(<TicketSummary tickets={tickets} activeFilter={null} onFilterChange={vi.fn()} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('displays 100% when all complete', () => {
    render(<TicketSummary tickets={[makeTicket()]} activeFilter={null} onFilterChange={vi.fn()} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows missing field counts', () => {
    const tickets = [
      makeTicket({ tpd_bu: null }),
      makeTicket({ key: 'T-2', eng_hours: null }),
      makeTicket({ key: 'T-3', work_stream: null }),
    ];
    render(<TicketSummary tickets={tickets} activeFilter={null} onFilterChange={vi.fn()} />);
    expect(screen.getByText('Missing')).toBeInTheDocument();
    expect(screen.getByText('TPD BU')).toBeInTheDocument();
    expect(screen.getByText('Hours')).toBeInTheDocument();
    expect(screen.getByText('Work Stream')).toBeInTheDocument();
  });

  it('does not show missing section when all complete', () => {
    render(<TicketSummary tickets={[makeTicket()]} activeFilter={null} onFilterChange={vi.fn()} />);
    expect(screen.queryByText('Missing')).not.toBeInTheDocument();
  });

  it('calls onFilterChange when missing filter clicked', () => {
    const onFilterChange = vi.fn();
    render(<TicketSummary tickets={[makeTicket({ tpd_bu: null })]} activeFilter={null} onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByText('TPD BU'));
    expect(onFilterChange).toHaveBeenCalledWith('tpd_bu');
  });

  it('toggles off active filter', () => {
    const onFilterChange = vi.fn();
    render(<TicketSummary tickets={[makeTicket({ tpd_bu: null })]} activeFilter="tpd_bu" onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByText('TPD BU'));
    expect(onFilterChange).toHaveBeenCalledWith(null);
  });

  it('shows status breakdown', () => {
    const tickets = [
      makeTicket({ status: 'Done' }),
      makeTicket({ key: 'T-2', status: 'Rejected' }),
    ];
    render(<TicketSummary tickets={tickets} activeFilter={null} onFilterChange={vi.fn()} />);
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('handles tickets with null eng_hours for avg', () => {
    const tickets = [makeTicket({ eng_hours: null })];
    render(<TicketSummary tickets={tickets} activeFilter={null} onFilterChange={vi.fn()} />);
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  // --- Missing hours filter button ---
  it('calls onFilterChange with eng_hours when Hours clicked', () => {
    const onFilterChange = vi.fn();
    render(<TicketSummary tickets={[makeTicket({ eng_hours: null })]} activeFilter={null} onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByText('Hours'));
    expect(onFilterChange).toHaveBeenCalledWith('eng_hours');
  });

  it('toggles off eng_hours filter when active', () => {
    const onFilterChange = vi.fn();
    render(<TicketSummary tickets={[makeTicket({ eng_hours: null })]} activeFilter="eng_hours" onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByText('Hours'));
    expect(onFilterChange).toHaveBeenCalledWith(null);
  });

  // --- Missing work_stream filter button ---
  it('calls onFilterChange with work_stream when Work Stream clicked', () => {
    const onFilterChange = vi.fn();
    render(<TicketSummary tickets={[makeTicket({ work_stream: null })]} activeFilter={null} onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByText('Work Stream'));
    expect(onFilterChange).toHaveBeenCalledWith('work_stream');
  });

  it('toggles off work_stream filter when active', () => {
    const onFilterChange = vi.fn();
    render(<TicketSummary tickets={[makeTicket({ work_stream: null })]} activeFilter="work_stream" onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByText('Work Stream'));
    expect(onFilterChange).toHaveBeenCalledWith(null);
  });
});
