import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    defaults: {},
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  };
  return {
    default: { create: vi.fn(() => mockAxiosInstance) },
  };
});

// Import after mock so the module uses the mocked axios
import api, {
  getTickets, updateTicket, syncSingleTicket, calculateHours, calculateFields,
  triggerSync, getConfig, saveConfig, getJiraFields, getJiraStatuses,
  getJiraProject, getTeamMetrics, getJiraMembers, getIndividualMetrics,
} from '../api';

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports a default api object with expected methods', () => {
    // axios.create is called at module load time; verify the returned instance has the right shape
    expect(api).toBeDefined();
    expect(api.get).toBeDefined();
    expect(api.post).toBeDefined();
    expect(api.patch).toBeDefined();
  });

  it('getTickets calls GET /tickets', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    await getTickets();
    expect(api.get).toHaveBeenCalledWith('/tickets');
  });

  it('updateTicket calls PATCH /tickets/:key', async () => {
    (api.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    await updateTicket('T-1', { tpd_bu: 'B2C' });
    expect(api.patch).toHaveBeenCalledWith('/tickets/T-1', { tpd_bu: 'B2C' });
  });

  it('syncSingleTicket calls POST /tickets/:key/sync', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    await syncSingleTicket('T-1');
    expect(api.post).toHaveBeenCalledWith('/tickets/T-1/sync');
  });

  it('calculateHours calls GET /tickets/:key/calculate', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { hours: 5 } });
    await calculateHours('T-1');
    expect(api.get).toHaveBeenCalledWith('/tickets/T-1/calculate');
  });

  it('calculateFields calls GET /tickets/:key/calculate-fields', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    await calculateFields('T-1');
    expect(api.get).toHaveBeenCalledWith('/tickets/T-1/calculate-fields');
  });

  it('triggerSync calls POST /sync', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    await triggerSync();
    expect(api.post).toHaveBeenCalledWith('/sync');
  });

  it('getConfig calls GET /config', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    await getConfig();
    expect(api.get).toHaveBeenCalledWith('/config');
  });

  it('saveConfig calls POST /config', async () => {
    const cfg = { project_key: 'TEST' };
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    await saveConfig(cfg);
    expect(api.post).toHaveBeenCalledWith('/config', cfg);
  });

  it('getJiraFields calls GET /jira/fields', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    await getJiraFields();
    expect(api.get).toHaveBeenCalledWith('/jira/fields');
  });

  it('getJiraStatuses calls GET /jira/statuses', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    await getJiraStatuses();
    expect(api.get).toHaveBeenCalledWith('/jira/statuses');
  });

  it('getJiraProject calls GET /jira/project', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    await getJiraProject();
    expect(api.get).toHaveBeenCalledWith('/jira/project');
  });

  it('getTeamMetrics calls GET /metrics/team with period param', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    await getTeamMetrics('weekly');
    expect(api.get).toHaveBeenCalledWith('/metrics/team', { params: { period: 'weekly' } });
  });

  it('getTeamMetrics defaults to all period', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    await getTeamMetrics();
    expect(api.get).toHaveBeenCalledWith('/metrics/team', { params: { period: 'all' } });
  });

  it('getJiraMembers calls GET /jira/members', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    await getJiraMembers();
    expect(api.get).toHaveBeenCalledWith('/jira/members');
  });

  it('getIndividualMetrics calls GET /metrics/individual with period', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    await getIndividualMetrics('monthly');
    expect(api.get).toHaveBeenCalledWith('/metrics/individual', { params: { period: 'monthly' } });
  });
});
