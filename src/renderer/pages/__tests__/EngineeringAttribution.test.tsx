import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api', () => ({
  getTickets: vi.fn(),
  triggerSync: vi.fn(),
  updateTicket: vi.fn(),
  syncSingleTicket: vi.fn(),
  calculateHours: vi.fn(),
  calculateFields: vi.fn(),
}));

import EngineeringAttribution from '../EngineeringAttribution';
import { getTickets, triggerSync } from '../../api';

const mockTickets = [
  {
    key: 'T-1', summary: 'Fix bug', status: 'Done', assignee: 'Alice',
    eng_hours: 5, tpd_bu: 'B2C', work_stream: 'Product', has_computed_values: false,
    base_url: 'https://jira.test',
  },
  {
    key: 'T-2', summary: 'Add feature', status: 'Done', assignee: 'Bob',
    eng_hours: null, tpd_bu: null, work_stream: null, has_computed_values: false,
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
    render(<EngineeringAttribution refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(getTickets).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('T-1')).toBeInTheDocument();
      expect(screen.getByText('T-2')).toBeInTheDocument();
    });
  });

  it('renders page header', async () => {
    render(<EngineeringAttribution refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Engineering Attribution')).toBeInTheDocument();
    });
  });

  it('renders personalized header with project name', async () => {
    render(<EngineeringAttribution refreshKey={0} project={{ key: 'PROJ', name: 'My Team', lead: null, avatar: null }} />);
    await waitFor(() => {
      expect(screen.getByText(/My Team — Engineering Attribution/)).toBeInTheDocument();
    });
  });

  it('shows sync button', async () => {
    render(<EngineeringAttribution refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Sync Now')).toBeInTheDocument();
    });
  });

  it('triggers sync on button click', async () => {
    render(<EngineeringAttribution refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('Sync Now')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Sync Now'));
    await waitFor(() => {
      expect(triggerSync).toHaveBeenCalled();
    });
  });

  it('triggers sync when refreshKey changes', async () => {
    const { rerender } = render(<EngineeringAttribution refreshKey={0} project={null} />);
    await waitFor(() => expect(getTickets).toHaveBeenCalled());
    rerender(<EngineeringAttribution refreshKey={1} project={null} />);
    await waitFor(() => {
      expect(triggerSync).toHaveBeenCalled();
    });
  });

  it('shows empty state when no tickets', async () => {
    (getTickets as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    render(<EngineeringAttribution refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('No tickets in cache')).toBeInTheDocument();
    });
  });

  it('shows loading spinner initially', () => {
    (getTickets as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {})); // never resolves
    render(<EngineeringAttribution refreshKey={0} project={null} />);
    expect(screen.getByText('Loading tickets...')).toBeInTheDocument();
  });

  // --- Error handling ---
  it('handles fetch error gracefully', async () => {
    (getTickets as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    render(<EngineeringAttribution refreshKey={0} project={null} />);
    await waitFor(() => {
      expect(screen.getByText('No tickets in cache')).toBeInTheDocument();
    });
  });

  it('handles sync error with toast', async () => {
    const toast = (await import('react-hot-toast')).default;
    (triggerSync as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Sync fail'));
    render(<EngineeringAttribution refreshKey={0} project={null} />);
    await waitFor(() => screen.getByText('Sync Now'));
    fireEvent.click(screen.getByText('Sync Now'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Sync failed');
    });
  });

  it('shows success toast and last synced after sync', async () => {
    const toast = (await import('react-hot-toast')).default;
    render(<EngineeringAttribution refreshKey={0} project={null} />);
    await waitFor(() => screen.getByText('Sync Now'));
    fireEvent.click(screen.getByText('Sync Now'));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/Last synced at/)).toBeInTheDocument();
    });
  });
});
