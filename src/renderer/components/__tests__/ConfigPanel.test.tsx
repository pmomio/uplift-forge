import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api', () => ({
  getConfig: vi.fn(),
  saveConfig: vi.fn(),
  getJiraFields: vi.fn(),
  getJiraStatuses: vi.fn(),
  getJiraProject: vi.fn(),
  getJiraMembers: vi.fn(),
  resetApp: vi.fn(),
}));

import ConfigPanel from '../ConfigPanel';
import { getConfig, saveConfig, getJiraFields, getJiraStatuses, getJiraMembers, getAiConfig, setAiConfig, deleteAiConfig, getJiraProject } from '../../api';
import toast from 'react-hot-toast';

const mockConfig = {
  project_key: 'ACTIN',
  mapping_rules: { tpd_bu: { B2C: [] }, work_stream: { Product: [] } },
  field_ids: { tpd_bu: 'cf_1', work_stream: 'cf_3', story_points: 'cf_sp' },
  ticket_filter: { mode: 'last_x_months', months: 6 },
  sp_to_days: 1.0,
  tracked_engineers: [],
  active_statuses: ['In Progress'],
  blocked_statuses: ['Blocked'],
  done_statuses: ['Done'],
  persona: 'engineering_manager',
};

describe('ConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).api = {
      getAiConfig: vi.fn().mockResolvedValue({ data: { provider: 'openai', hasKey: false } }),
      setAiConfig: vi.fn().mockResolvedValue({ data: { status: 'success' } }),
      deleteAiConfig: vi.fn().mockResolvedValue({ data: { status: 'success' } }),
    };
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockConfig });
    (saveConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { status: 'success', ticket_count: 10 } });
    (getJiraFields as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'cf_1', name: 'TPD BU', type: 'option' }, { id: 'cf_sp', name: 'Story Points', type: 'number' }],
    });
    (getJiraStatuses as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: '1', name: 'Open' }, { id: '2', name: 'In Progress' }, { id: '3', name: 'Done' }],
    });
    (getJiraProject as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { name: 'Active Project', key: 'ACTIN' } });
    (getJiraMembers as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
  });

  const switchTab = (tabName: string) => {
    const tab = screen.getByText(tabName);
    fireEvent.click(tab);
  };

  it('loads config on mount', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(getConfig).toHaveBeenCalled();
    });
  });

  it('displays JIRA Connection section in General tab', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Primary Project')).toBeInTheDocument();
    });
  });

  it('displays Metrics section', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Metrics & Workflow'));
    switchTab('Metrics & Workflow');
    await waitFor(() => {
      expect(screen.getByText('Estimation Calibration')).toBeInTheDocument();
    });
  });

  it('uppercases project key input', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByDisplayValue('ACTIN'));
    const input = screen.getByDisplayValue('ACTIN');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(screen.getByDisplayValue('TEST')).toBeInTheDocument();
  });

  it('saves config on button click', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Save Changes'));
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => {
      expect(saveConfig).toHaveBeenCalled();
    });
  });

  it('shows AI Assistant Setup in Application tab', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application'));
    switchTab('Application');
    await waitFor(() => {
      expect(screen.getByText('AI Assistant Setup')).toBeInTheDocument();
    });
  });
});
