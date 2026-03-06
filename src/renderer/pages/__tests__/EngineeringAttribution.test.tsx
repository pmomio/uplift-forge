import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api', () => ({
  getTickets: vi.fn(),
  triggerSync: vi.fn(),
  updateTicket: vi.fn(),
  syncOneTicket: vi.fn(),
  calcTicketFields: vi.fn(),
}));

import EngineeringAttribution from '../EngineeringAttribution';
import { getTickets, triggerSync } from '../../api';

const mockTickets = [
  {
    key: 'T-1', summary: 'Fix bug', status: 'Done', assignee: 'Alice',
    tpd_bu: 'B2C', work_stream: 'Product', has_computed_values: false,
    base_url: 'https://jira.test',
  },
  {
    key: 'T-2', summary: 'Add feature', status: 'Done', assignee: 'Bob',
    tpd_bu: null, work_stream: null, has_computed_values: false,
    base_url: 'https://jira.test',
  },
];

describe('EngineeringAttribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getTickets as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockTickets });
    (triggerSync as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { status: 'success' } });
  });

  it('fetches and displays tickets on mount', async () => {
    render(<EngineeringAttribution refreshKey={0} project={null} persona="engineering_manager" projectCount={1} />);
    await waitFor(() => {
      expect(getTickets).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('T-1')).toBeInTheDocument();
      expect(screen.getByText('T-2')).toBeInTheDocument();
    });
  });

  it('renders page header', async () => {
    render(<EngineeringAttribution refreshKey={0} project={null} persona="engineering_manager" projectCount={1} />);
    await waitFor(() => {
      expect(screen.getByText('Engineering Attribution')).toBeInTheDocument();
    });
  });

  it('renders personalized header with project name', async () => {
    render(<EngineeringAttribution refreshKey={0} project={{ key: 'PROJ', name: 'My Team', lead: null, avatar: null }} persona="engineering_manager" projectCount={1} />);
    await waitFor(() => {
      expect(screen.getByText(/My Team — Engineering Attribution/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no tickets', async () => {
    (getTickets as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    render(<EngineeringAttribution refreshKey={0} project={null} persona="engineering_manager" projectCount={1} />);
    await waitFor(() => {
      expect(screen.getByText(/No tickets in cache/)).toBeInTheDocument();
    });
  });

  it('triggers full sync on button click', async () => {
    render(<EngineeringAttribution refreshKey={0} project={null} persona="engineering_manager" projectCount={1} />);
    await waitFor(() => screen.getByText('Sync Now'));
    fireEvent.click(screen.getByText('Sync Now'));
    await waitFor(() => expect(triggerSync).toHaveBeenCalled());
  });
});
