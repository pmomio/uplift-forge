import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TicketSummary from '../TicketSummary';

const makeTicket = (overrides: any = {}) => ({
  key: 'T-1',
  summary: 'Test',
  status: 'Done',
  assignee: 'Alice',
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
    expect(screen.getByText('Total Tickets')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
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
      makeTicket({ key: 'T-2', story_points: null }),
      makeTicket({ key: 'T-2b', story_points: null }),
      makeTicket({ key: 'T-2c', story_points: null }),
      makeTicket({ key: 'T-3', work_stream: null }),
    ];
    render(<TicketSummary tickets={tickets} activeFilter={null} onFilterChange={vi.fn()} />);
    expect(screen.getByText('Missing Data')).toBeInTheDocument();
    
    expect(screen.getByText('BU (1)')).toBeInTheDocument();
    expect(screen.getByText('WS (1)')).toBeInTheDocument();
    expect(screen.getByText('SP (5)')).toBeInTheDocument();
  });

  it('calls onFilterChange when missing filter clicked', () => {
    const onFilterChange = vi.fn();
    render(<TicketSummary tickets={[makeTicket({ tpd_bu: null })]} activeFilter={null} onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByText('BU (1)'));
    expect(onFilterChange).toHaveBeenCalledWith('tpd_bu');
  });

  it('toggles off active filter', () => {
    const onFilterChange = vi.fn();
    render(<TicketSummary tickets={[makeTicket({ tpd_bu: null })]} activeFilter="tpd_bu" onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByText('BU (1)'));
    expect(onFilterChange).toHaveBeenCalledWith(null);
  });
});
