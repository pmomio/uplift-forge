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
  getAiConfig: vi.fn(),
  setAiConfig: vi.fn(),
  deleteAiConfig: vi.fn(),
  testAiConnection: vi.fn(),
}));

import ConfigPanel from '../ConfigPanel';
import { getConfig, saveConfig, getJiraFields, getJiraStatuses, getJiraMembers, checkForUpdates, getAiConfig, setAiConfig, deleteAiConfig, testAiConnection } from '../../api';
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
    (getAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { provider: 'openai', hasKey: false } });
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

  // --- AI-Powered Suggestions section ---
  it('displays AI-Powered Suggestions section in Application Settings', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => {
      expect(screen.getByText('AI-Powered Suggestions')).toBeInTheDocument();
    });
  });

  it('shows provider toggle buttons', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Claude')).toBeInTheDocument();
    });
  });

  it('switches AI provider on toggle click', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => expect(screen.getByText('Claude')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Claude'));
    // Provider label in placeholder should change to Anthropic
    const input = document.querySelector('input[type="password"]') as HTMLInputElement;
    expect(input?.placeholder).toContain('Anthropic');
  });

  it('shows Save Key button', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => {
      expect(screen.getByText('Save Key')).toBeInTheDocument();
    });
  });

  it('shows Test Connection button', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => {
      expect(screen.getByText('Test Connection')).toBeInTheDocument();
    });
  });

  it('disables Save Key button when API key input is empty', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => screen.getByText('Save Key'));
    const saveBtn = screen.getByText('Save Key').closest('button');
    expect(saveBtn).toBeDisabled();
  });

  it('saves API key successfully', async () => {
    (setAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => screen.getByText('Save Key'));
    // Type an API key
    const input = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sk-test-key-123' } });
    fireEvent.click(screen.getByText('Save Key'));
    await waitFor(() => {
      expect(setAiConfig).toHaveBeenCalledWith('openai', 'sk-test-key-123');
      expect(toast.success).toHaveBeenCalledWith('AI API key saved');
    });
  });

  it('shows error toast when save fails', async () => {
    (setAiConfig as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => screen.getByText('Save Key'));
    const input = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sk-test' } });
    fireEvent.click(screen.getByText('Save Key'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to save API key');
    });
  });

  it('tests connection successfully', async () => {
    (getAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { provider: 'openai', hasKey: true } });
    (testAiConnection as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true } });
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => screen.getByText('Test Connection'));
    fireEvent.click(screen.getByText('Test Connection'));
    await waitFor(() => {
      expect(testAiConnection).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Connection successful!');
    });
  });

  it('shows error when test connection fails', async () => {
    (getAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { provider: 'openai', hasKey: true } });
    (testAiConnection as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: false, error: 'Invalid API key.' } });
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => screen.getByText('Test Connection'));
    fireEvent.click(screen.getByText('Test Connection'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid API key.');
    });
  });

  it('shows error toast when test connection throws', async () => {
    (getAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { provider: 'openai', hasKey: true } });
    (testAiConnection as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => screen.getByText('Test Connection'));
    fireEvent.click(screen.getByText('Test Connection'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Connection test failed');
    });
  });

  it('disables Test Connection button when no key is saved', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => screen.getByText('Test Connection'));
    const testBtn = screen.getByText('Test Connection').closest('button');
    expect(testBtn).toBeDisabled();
  });

  it('shows status indicator when key is configured', async () => {
    (getAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { provider: 'openai', hasKey: true } });
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => {
      expect(screen.getByText(/OpenAI key configured/)).toBeInTheDocument();
    });
  });

  it('shows Remove button when key is configured', async () => {
    (getAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { provider: 'openai', hasKey: true } });
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => {
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });
  });

  it('removes API key on Remove click', async () => {
    (getAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { provider: 'openai', hasKey: true } });
    (deleteAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => screen.getByText('Remove'));
    fireEvent.click(screen.getByText('Remove'));
    await waitFor(() => {
      expect(deleteAiConfig).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('AI API key removed');
    });
  });

  it('shows error toast when remove fails', async () => {
    (getAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { provider: 'openai', hasKey: true } });
    (deleteAiConfig as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Application Settings'));
    switchTab('Application Settings');
    await waitFor(() => screen.getByText('Remove'));
    fireEvent.click(screen.getByText('Remove'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to remove API key');
    });
  });

  // --- Config load error ---
  it('shows error state when config fails to load', async () => {
    (getConfig as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load configuration/)).toBeInTheDocument();
    });
  });

  it('retries config load on retry click', async () => {
    (getConfig as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Retry'));
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockConfig });
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => {
      expect(getConfig).toHaveBeenCalledTimes(2);
    });
  });
});
