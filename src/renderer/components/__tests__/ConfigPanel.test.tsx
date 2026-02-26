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
  getJiraMembers: vi.fn(),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
}));

import ConfigPanel from '../ConfigPanel';
import { getConfig, saveConfig, getJiraFields, getJiraStatuses, getJiraMembers, checkForUpdates } from '../../api';
import toast from 'react-hot-toast';

const mockConfig = {
  project_key: 'ACTIN',
  office_hours: { start: '09:00', end: '18:00', timezone: 'Europe/Berlin', exclude_weekends: true },
  mapping_rules: { tpd_bu: { B2C: [] }, work_stream: { Product: [] } },
  field_ids: { tpd_bu: 'cf_1', eng_hours: 'cf_2', work_stream: 'cf_3' },
  eng_start_status: 'In Progress',
  eng_end_status: 'Code Review',
  eng_excluded_statuses: ['Blocked'],
  ticket_filter: { mode: 'last_x_months', months: 6 },
  sp_to_days: 1.0,
  tracked_engineers: [],
  sync_config: { auto_write_to_jira: false },
};

describe('ConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockConfig });
    (saveConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { status: 'success', ticket_count: 10 } });
    (getJiraFields as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'cf_1', name: 'TPD BU', type: 'option' }, { id: 'cf_2', name: 'Eng Hours', type: 'number' }],
    });
    (getJiraStatuses as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: '1', name: 'Open' }, { id: '2', name: 'In Progress' }, { id: '3', name: 'Done' }, { id: '4', name: 'QA Review' }],
    });
    (getJiraMembers as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    (checkForUpdates as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { currentVersion: '1.0.0', updateAvailable: false } });
  });

  const switchTab = (tabName: string) => {
    const tab = screen.getByText(tabName);
    fireEvent.click(tab);
  };

  // --- Loading ---
  it('loads config on mount', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(getConfig).toHaveBeenCalled();
    });
  });

  it('shows loading spinner initially', () => {
    // Delay config response
    (getConfig as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<ConfigPanel />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  // --- Section headers ---
  it('displays JIRA Connection section in General tab', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('JIRA Connection')).toBeInTheDocument();
    });
  });

  it('displays Team Metrics section in Metrics tab', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Metrics'));
    switchTab('Metrics');
    await waitFor(() => {
      expect(screen.getByText('Performance Calibration')).toBeInTheDocument();
    });
  });

  it('displays Engineering Attribution section in Attribution tab', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Engineering Attribution'));
    switchTab('Engineering Attribution');
    await waitFor(() => {
      expect(screen.getByText('Automated Mapping Rules')).toBeInTheDocument();
      expect(screen.getByText('Work Cycle Definition')).toBeInTheDocument();
    });
  });

  it('displays Individual Metrics section in Metrics tab', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Metrics'));
    switchTab('Metrics');
    await waitFor(() => {
      expect(screen.getByText('Team Management')).toBeInTheDocument();
    });
  });

  // --- Project Key ---
  it('displays project key input', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      const input = screen.getByDisplayValue('ACTIN');
      expect(input).toBeInTheDocument();
    });
  });

  it('uppercases project key input', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByDisplayValue('ACTIN'));
    const input = screen.getByDisplayValue('ACTIN');
    fireEvent.change(input, { target: { value: 'test' } });
    // The value should be uppercased
    expect(screen.getByDisplayValue('TEST')).toBeInTheDocument();
  });

  // --- Fetch Fields ---
  it('shows fetch fields button (auto-fetched shows Refresh Fields)', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Refresh Fields')).toBeInTheDocument();
    });
  });

  it('auto-fetches fields when project key is present', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(getJiraFields).toHaveBeenCalled();
      expect(getJiraStatuses).toHaveBeenCalled();
    });
  });

  it('fetches fields on button click and shows toast', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Refresh Fields'));
    fireEvent.click(screen.getByText('Refresh Fields'));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Fields and statuses refreshed');
    });
  });

  // --- Saving ---
  it('shows save button', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument();
    });
  });

  it('saves config on button click', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Save Settings'));
    fireEvent.click(screen.getByText('Save Settings'));
    await waitFor(() => {
      expect(saveConfig).toHaveBeenCalled();
    });
  });

  // --- Data Time Range ---
  it('shows time range input in General tab', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Data Time Range')).toBeInTheDocument();
      expect(screen.getByDisplayValue('6')).toBeInTheDocument();
    });
  });

  // --- Performance Calibration ---
  it('shows SP calibration section in Metrics tab', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Metrics'));
    switchTab('Metrics');
    await waitFor(() => {
      expect(screen.getByText('Story Point Calibration')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    });
  });

  // --- Table Display Filter ---
  it('shows display filter toggle in General tab', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Show only tickets with missing/)).toBeInTheDocument();
    });
  });

  // --- Engineering Hours Status selects ---
  it('shows start and end status selects in Attribution tab', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Engineering Attribution'));
    switchTab('Engineering Attribution');
    await waitFor(() => {
      expect(screen.getByText('Start Status (clock starts)')).toBeInTheDocument();
      expect(screen.getByText('End Status (clock stops)')).toBeInTheDocument();
    });
  });

  // --- JIRA Members ---
  it('fetches and displays members in Metrics tab', async () => {
    (getJiraMembers as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ accountId: 'a1', displayName: 'Alice Engineer', avatar: null, active: true }],
    });
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Metrics'));
    switchTab('Metrics');
    await waitFor(() => screen.getByText('Fetch Members'));
    fireEvent.click(screen.getByText('Fetch Members'));
    await waitFor(() => {
      expect(getJiraMembers).toHaveBeenCalled();
      expect(screen.getByText('Alice Engineer')).toBeInTheDocument();
    });
  });

  // --- Mapping Rules ---
  it('renders mapping rules in Attribution tab', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Engineering Attribution'));
    switchTab('Engineering Attribution');
    await waitFor(() => {
      expect(screen.getByText('TPD Business Unit Rules')).toBeInTheDocument();
      expect(screen.getByText('Work Stream Rules')).toBeInTheDocument();
    });
  });

  // --- JIRA Field Mappings ---
  it('shows JIRA Field Mappings section in General tab', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('JIRA Field Mappings')).toBeInTheDocument();
    });
  });

  // --- Application Settings ---
  it('displays version info in Application Settings tab', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => {
      expect(screen.getByText('Current Version')).toBeInTheDocument();
      expect(screen.getByText('Check for Updates')).toBeInTheDocument();
    });
  });
});
