import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TicketSummary from '../TicketSummary';

const makeTicket = (overrides: any = {}) => ({
  key: 'T-1',
  summary: 'Test',
  status: 'Done',
  assignee: 'Alice',
  has_computed_values: false,
  base_url: 'https://jira.test',
  story_points: 3,
  ...overrides,
});

describe('TicketSummary', () => {
  it('displays total ticket count', () => {
    const tickets = [makeTicket(), makeTicket({ key: 'T-2' })];
    render(<TicketSummary tickets={tickets} activeFilter={null} onFilterChange={vi.fn()} />);
    expect(screen.getByText('Total Tickets')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows missing story points count', () => {
    const tickets = [
      makeTicket({ story_points: null }),
      makeTicket({ key: 'T-2', story_points: null }),
      makeTicket({ key: 'T-3', story_points: 5 }),
    ];
    render(<TicketSummary tickets={tickets} activeFilter={null} onFilterChange={vi.fn()} />);
    expect(screen.getByText('Missing Data')).toBeInTheDocument();
    expect(screen.getByText('Missing SP (2)')).toBeInTheDocument();
  });

  it('calls onFilterChange when missing filter clicked', () => {
    const onFilterChange = vi.fn();
    render(<TicketSummary tickets={[makeTicket({ story_points: null })]} activeFilter={null} onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByText('Missing SP (1)'));
    expect(onFilterChange).toHaveBeenCalledWith('story_points');
  });

  it('toggles off active filter', () => {
    const onFilterChange = vi.fn();
    render(<TicketSummary tickets={[makeTicket({ story_points: null })]} activeFilter="story_points" onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByText('Missing SP (1)'));
    expect(onFilterChange).toHaveBeenCalledWith(null);
  });
});
