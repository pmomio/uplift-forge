import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set up window.api mock with all methods
const mockApi: Record<string, ReturnType<typeof vi.fn>> = {};
const apiMethods = [
  'login', 'logout', 'getAuthState', 'resetApp',
  'getConfig', 'saveConfig',
  'getJiraProject', 'getJiraFields', 'getJiraStatuses', 'getJiraMembers',
  'getTickets', 'updateTicket', 'syncSingleTicket', 'calculateHours', 'calculateFields',
  'triggerSync',
  'getTeamMetrics', 'getIndividualMetrics',
  'checkForUpdates', 'downloadUpdate',
  'getAiConfig', 'setAiConfig', 'deleteAiConfig', 'testAiConnection', 'getAiSuggestions',
];

for (const method of apiMethods) {
  mockApi[method] = vi.fn().mockResolvedValue('result');
}

(window as any).api = mockApi;

// Import after window.api is set up
import {
  login, logout, getAuthState, resetApp,
  getConfig, saveConfig,
  getJiraProject, getJiraFields, getJiraStatuses, getJiraMembers,
  getTickets, updateTicket, syncSingleTicket, calculateHours, calculateFields,
  triggerSync,
  getTeamMetrics, getIndividualMetrics,
  checkForUpdates, downloadUpdate,
  getAiConfig, setAiConfig, deleteAiConfig, testAiConnection, getAiSuggestions,
} from '../api';

describe('api wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const method of apiMethods) {
      mockApi[method].mockResolvedValue('result');
    }
  });

  it('wraps login', async () => {
    const res = await login('url', 'email', 'token');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.login).toHaveBeenCalledWith('url', 'email', 'token');
  });

  it('wraps logout', async () => {
    const res = await logout();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps getAuthState', async () => {
    const res = await getAuthState();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps resetApp', async () => {
    const res = await resetApp();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps getConfig', async () => {
    const res = await getConfig();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps saveConfig', async () => {
    const res = await saveConfig({ key: 'val' });
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.saveConfig).toHaveBeenCalledWith({ key: 'val' });
  });

  it('wraps getJiraProject', async () => {
    const res = await getJiraProject();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps getJiraFields', async () => {
    const res = await getJiraFields();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps getJiraStatuses', async () => {
    const res = await getJiraStatuses();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps getJiraMembers', async () => {
    const res = await getJiraMembers();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps getTickets', async () => {
    const res = await getTickets();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps updateTicket', async () => {
    const res = await updateTicket('T-1', { eng_hours: 5 });
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.updateTicket).toHaveBeenCalledWith('T-1', { eng_hours: 5 });
  });

  it('wraps syncSingleTicket', async () => {
    const res = await syncSingleTicket('T-1');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.syncSingleTicket).toHaveBeenCalledWith('T-1');
  });

  it('wraps calculateHours', async () => {
    const res = await calculateHours('T-1');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.calculateHours).toHaveBeenCalledWith('T-1');
  });

  it('wraps calculateFields', async () => {
    const res = await calculateFields('T-1');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.calculateFields).toHaveBeenCalledWith('T-1');
  });

  it('wraps triggerSync', async () => {
    const res = await triggerSync();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps getTeamMetrics with default period', async () => {
    const res = await getTeamMetrics();
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.getTeamMetrics).toHaveBeenCalledWith('all');
  });

  it('wraps getTeamMetrics with custom period', async () => {
    await getTeamMetrics('weekly');
    expect(mockApi.getTeamMetrics).toHaveBeenCalledWith('weekly');
  });

  it('wraps getIndividualMetrics with default period', async () => {
    const res = await getIndividualMetrics();
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.getIndividualMetrics).toHaveBeenCalledWith('all');
  });

  it('wraps checkForUpdates', async () => {
    const res = await checkForUpdates();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps downloadUpdate', async () => {
    const res = await downloadUpdate();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps getAiConfig', async () => {
    const res = await getAiConfig();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps setAiConfig', async () => {
    const res = await setAiConfig('openai', 'sk-test');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.setAiConfig).toHaveBeenCalledWith('openai', 'sk-test');
  });

  it('wraps deleteAiConfig', async () => {
    const res = await deleteAiConfig();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps testAiConnection', async () => {
    const res = await testAiConnection();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps getAiSuggestions', async () => {
    const req = { metricKey: 'bug_ratio' };
    const res = await getAiSuggestions(req);
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.getAiSuggestions).toHaveBeenCalledWith(req);
  });
});
