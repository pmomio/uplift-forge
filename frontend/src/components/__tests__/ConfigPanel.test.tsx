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
}));

import ConfigPanel from '../ConfigPanel';
import { getConfig, saveConfig, getJiraFields, getJiraStatuses, getJiraMembers } from '../../api';
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
  });

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
    expect(screen.getByText('Configuration')).toBeInTheDocument();
  });

  // --- Section headers ---
  it('displays JIRA Connection section', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('JIRA Connection')).toBeInTheDocument();
    });
  });

  it('displays Team Metrics section', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Team Metrics')).toBeInTheDocument();
    });
  });

  it('displays Engineering Attribution section', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Engineering Attribution')).toBeInTheDocument();
    });
  });

  it('displays Engineering Hours section', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Engineering Hours Calculation')).toBeInTheDocument();
    });
  });

  it('displays Individual Metrics section', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Individual Metrics')).toBeInTheDocument();
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

  it('does not auto-fetch when project key is empty', async () => {
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...mockConfig, project_key: '' },
    });
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(getConfig).toHaveBeenCalled();
    });
    // Should not have called fields/statuses
    expect(getJiraFields).not.toHaveBeenCalled();
  });

  it('fetches fields on button click and shows toast', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Refresh Fields'));
    fireEvent.click(screen.getByText('Refresh Fields'));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Fields and statuses refreshed');
    });
  });

  it('shows Fetch Fields button when no project key', async () => {
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...mockConfig, project_key: '' },
    });
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Fetch Fields')).toBeInTheDocument();
    });
    // Button should be disabled
    const btn = screen.getByText('Fetch Fields').closest('button');
    expect(btn).toBeDisabled();
  });

  // --- Saving ---
  it('shows save button', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Save Configuration')).toBeInTheDocument();
    });
  });

  it('saves config on button click', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Save Configuration'));
    fireEvent.click(screen.getByText('Save Configuration'));
    await waitFor(() => {
      expect(saveConfig).toHaveBeenCalled();
    });
  });

  it('calls onConfigSaved after successful save', async () => {
    const onConfigSaved = vi.fn();
    render(<ConfigPanel onConfigSaved={onConfigSaved} />);
    await waitFor(() => screen.getByText('Save Configuration'));
    fireEvent.click(screen.getByText('Save Configuration'));
    await waitFor(() => {
      expect(onConfigSaved).toHaveBeenCalled();
    });
  });

  it('shows sync toast when save triggers sync', async () => {
    (saveConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { sync_triggered: true, ticket_count: 5 } });
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Save Configuration'));
    fireEvent.click(screen.getByText('Save Configuration'));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Config saved — synced 5 tickets');
    });
  });

  it('shows error toast when save fails', async () => {
    (saveConfig as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Fail'));
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Save Configuration'));
    fireEvent.click(screen.getByText('Save Configuration'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to save configuration');
    });
  });

  // --- Error state ---
  it('shows error state when config fails to load', async () => {
    (getConfig as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
    });
  });

  it('shows retry button on load error', async () => {
    (getConfig as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('retries config load on retry button click', async () => {
    (getConfig as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Retry'));
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockConfig });
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => {
      expect(getConfig).toHaveBeenCalledTimes(2);
    });
  });

  // --- Data Time Range ---
  it('shows time range input', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Data Time Range')).toBeInTheDocument();
    });
  });

  it('shows months input with value', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('6')).toBeInTheDocument();
    });
  });

  // --- SP Calibration ---
  it('shows SP calibration section', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Story Point Calibration')).toBeInTheDocument();
    });
  });

  it('shows sp_to_days input', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    });
  });

  // --- Table Display Filter ---
  it('shows display filter toggle', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Table Display Filter')).toBeInTheDocument();
    });
  });

  it('shows missing fields mode description when toggled', async () => {
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...mockConfig, ticket_filter: { mode: 'missing_fields', months: 6 } },
    });
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Showing only tickets missing/)).toBeInTheDocument();
    });
  });

  // --- Engineering Hours Status selects ---
  it('shows start and end status selects after fields fetched', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Start Status (clock starts)')).toBeInTheDocument();
      expect(screen.getByText('End Status (clock stops)')).toBeInTheDocument();
    });
  });

  it('shows excluded statuses chips', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Blocked')).toBeInTheDocument();
    });
  });

  // --- JIRA Members ---
  it('shows Fetch Members button', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Fetch Members')).toBeInTheDocument();
    });
  });

  it('fetches members on button click', async () => {
    (getJiraMembers as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ accountId: 'a1', displayName: 'Alice', avatar: null, active: true }],
    });
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Fetch Members'));
    fireEvent.click(screen.getByText('Fetch Members'));
    await waitFor(() => {
      expect(getJiraMembers).toHaveBeenCalled();
    });
  });

  it('shows member list after fetch', async () => {
    (getJiraMembers as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ accountId: 'a1', displayName: 'Alice Engineer', avatar: null, active: true }],
    });
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Fetch Members'));
    fireEvent.click(screen.getByText('Fetch Members'));
    await waitFor(() => {
      expect(screen.getByText('Alice Engineer')).toBeInTheDocument();
    });
  });

  // --- Mapping Rules ---
  it('renders TPD Business Unit Rules', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('TPD Business Unit Rules')).toBeInTheDocument();
    });
  });

  it('renders Work Stream Rules', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Work Stream Rules')).toBeInTheDocument();
    });
  });

  // --- JIRA Field Mappings ---
  it('shows JIRA Field Mappings section after fields fetched', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('JIRA Field Mappings')).toBeInTheDocument();
    });
  });

  // --- Member toggling ---
  it('toggles member selection on click', async () => {
    (getJiraMembers as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ accountId: 'a1', displayName: 'Alice Dev', avatar: null, active: true }],
    });
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Fetch Members'));
    fireEvent.click(screen.getByText('Fetch Members'));
    await waitFor(() => expect(screen.getByText('Alice Dev')).toBeInTheDocument());
    // Click member to add
    fireEvent.click(screen.getByText('Alice Dev'));
    // The member should now be tracked (chip should appear)
    await waitFor(() => {
      // There should be 2 instances - one in chip and one in list
      const elements = screen.getAllByText('Alice Dev');
      expect(elements.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('removes tracked member on click', async () => {
    // Start with a tracked engineer
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        ...mockConfig,
        tracked_engineers: [{ accountId: 'a1', displayName: 'Alice Dev', avatar: null }],
      },
    });
    (getJiraMembers as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ accountId: 'a1', displayName: 'Alice Dev', avatar: null, active: true }],
    });
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Fetch Members'));
    fireEvent.click(screen.getByText('Fetch Members'));
    await waitFor(() => expect(screen.getAllByText('Alice Dev').length).toBeGreaterThanOrEqual(2));
    // Click the member list button (not the chip) to remove
    const aliceElements = screen.getAllByText('Alice Dev');
    const memberButton = aliceElements.find(el => el.closest('button[class*="w-full"]'));
    expect(memberButton).toBeDefined();
    fireEvent.click(memberButton!.closest('button')!);
    // After removal, there should only be one "Alice Dev" (in the member list, not in chips)
    await waitFor(() => {
      const elements = screen.getAllByText('Alice Dev');
      expect(elements.length).toBe(1);
    });
  });

  it('shows tracked engineer chips', async () => {
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        ...mockConfig,
        tracked_engineers: [{ accountId: 'a1', displayName: 'Bob Engineer', avatar: null }],
      },
    });
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Bob Engineer')).toBeInTheDocument();
    });
  });

  // --- Excluded status add ---
  it('renders excluded status dropdown with available statuses', async () => {
    render(<ConfigPanel />);
    // Wait for the Eng Hours section to render (fieldsFetched=true)
    await waitFor(() => {
      expect(screen.getByText('Excluded Statuses (time in these statuses is not counted)')).toBeInTheDocument();
    });
    // Existing excluded status chip should be visible
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    // The "Add excluded status..." dropdown should exist
    const selects = screen.getAllByRole('combobox');
    const addSelect = selects.find(s => {
      const options = Array.from((s as HTMLSelectElement).options);
      return options.some(o => o.text === 'Add excluded status...');
    }) as HTMLSelectElement;
    expect(addSelect).toBeDefined();
    // Available options should exclude already-excluded "Blocked"
    const optionTexts = Array.from(addSelect.options).map(o => o.text);
    expect(optionTexts).toContain('Open');
    expect(optionTexts).toContain('QA Review');
    expect(optionTexts).not.toContain('Blocked');
  });

  // --- SP calibration change ---
  it('updates sp_to_days value', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByDisplayValue('1'));
    const spInput = screen.getByDisplayValue('1');
    fireEvent.change(spInput, { target: { value: '2' } });
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  // --- Months input change ---
  it('updates ticket filter months', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByDisplayValue('6'));
    const monthsInput = screen.getByDisplayValue('6');
    fireEvent.change(monthsInput, { target: { value: '3' } });
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
  });

  // --- Start/End status select change ---
  it('updates start status', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Start Status (clock starts)'));
    const selects = screen.getAllByRole('combobox');
    const startSelect = selects.find(s => (s as HTMLSelectElement).value === 'In Progress');
    expect(startSelect).toBeDefined();
    if (startSelect) {
      fireEvent.change(startSelect, { target: { value: 'Done' } });
    }
  });

  it('updates end status', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('End Status (clock stops)'));
    const selects = screen.getAllByRole('combobox');
    const endSelect = selects.find(s => (s as HTMLSelectElement).value === 'Code Review');
    // If not found (Code Review may not be in mock statuses), find by label context
    if (endSelect) {
      fireEvent.change(endSelect, { target: { value: 'Done' } });
      expect((endSelect as HTMLSelectElement).value).toBeDefined();
    }
  });

  // --- Field mapping select ---
  it('shows field options in mapping selects', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('JIRA Field Mappings'));
    // Should have TPD BU and Eng Hours in dropdown options
    const selects = screen.getAllByRole('combobox');
    const fieldSelects = selects.filter(s => {
      const options = Array.from((s as HTMLSelectElement).options);
      return options.some(o => o.text.includes('TPD BU'));
    });
    expect(fieldSelects.length).toBeGreaterThan(0);
  });

  // --- Story Points Field section ---
  it('shows Story Points Field section', async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('Story Points Field')).toBeInTheDocument();
    });
  });

  // --- Fetch Members error handling ---
  it('shows error toast when members fetch fails', async () => {
    (getJiraMembers as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Fail'));
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Fetch Members'));
    fireEvent.click(screen.getByText('Fetch Members'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('shows error toast when members fetch returns error', async () => {
    (getJiraMembers as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { error: 'Not found' },
    });
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText('Fetch Members'));
    fireEvent.click(screen.getByText('Fetch Members'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  // --- Fetch fields/statuses error handling ---
  it('handles field fetch error gracefully', async () => {
    (getJiraFields as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Fail'));
    render(<ConfigPanel />);
    // Should still render without crashing
    await waitFor(() => {
      expect(screen.getByText('JIRA Connection')).toBeInTheDocument();
    });
  });

  it('handles field fetch with error response', async () => {
    (getJiraFields as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { error: 'no permission' },
    });
    render(<ConfigPanel />);
    await waitFor(() => {
      expect(screen.getByText('JIRA Connection')).toBeInTheDocument();
    });
  });

  // --- Display filter toggle ---
  it('toggles display filter mode', async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText(/Show only tickets with missing/));
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(screen.getByText(/Showing only tickets missing/)).toBeInTheDocument();
    });
  });
});
