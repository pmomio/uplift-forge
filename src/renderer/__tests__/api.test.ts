import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set up window.api mock with all methods
const mockApi: Record<string, ReturnType<typeof vi.fn>> = {};
const apiMethods = [
  'login', 'logout', 'getAuthState', 'resetApp',
  'getConfig', 'saveConfig',
  'getJiraProject', 'getJiraFields', 'getJiraStatuses', 'getJiraMembers',
  'getTickets', 'updateTicket', 'syncOneTicket', 'calcTicketFields',
  'syncFull', 'syncAllProjects',
  'getTeamMetrics', 'getIndividualMetrics',
  'checkForUpdates', 'downloadUpdate',
  'getAiConfig', 'setAiConfig', 'deleteAiConfig', 'testAiConnection', 'getAiSuggestions',
  'listProjects', 'addProject', 'updateProject', 'removeProject', 'syncProject', 'getCrossProjectMetrics',
  'getEpics', 'getEpicDetail', 'syncEpics',
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
  getTickets, updateTicket, syncOneTicket, calcTicketFields,
  syncFull, syncAllProjects,
  getTeamMetrics, getIndividualMetrics,
  checkForUpdates, downloadUpdate,
  getAiConfig, setAiConfig, deleteAiConfig, testAiConnection, getAiSuggestions,
  listProjects, addProject, updateProjectConfig, removeProject, syncProject, getCrossProjectMetrics,
  getEpics, getEpicDetail, syncEpics,
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
    const res = await updateTicket('T-1', { tpd_bu: 'B2C' });
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.updateTicket).toHaveBeenCalledWith('T-1', { tpd_bu: 'B2C' });
  });

  it('wraps syncOneTicket', async () => {
    const res = await syncOneTicket('T-1');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.syncOneTicket).toHaveBeenCalledWith('T-1');
  });

  it('wraps calcTicketFields', async () => {
    const res = await calcTicketFields('T-1');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.calcTicketFields).toHaveBeenCalledWith('T-1');
  });

  it('wraps syncFull', async () => {
    const res = await syncFull();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps getTeamMetrics with default period', async () => {
    const res = await getTeamMetrics();
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.getTeamMetrics).toHaveBeenCalledWith('all', undefined);
  });

  it('wraps getTeamMetrics with custom period', async () => {
    await getTeamMetrics('weekly');
    expect(mockApi.getTeamMetrics).toHaveBeenCalledWith('weekly', undefined);
  });

  it('wraps getIndividualMetrics with default period', async () => {
    const res = await getIndividualMetrics();
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.getIndividualMetrics).toHaveBeenCalledWith('all', undefined);
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

  // --- Multi-project API wrappers ---
  it('wraps syncAllProjects', async () => {
    const res = await syncAllProjects();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps getTickets with optional projectKey', async () => {
    const res = await getTickets('PROJ');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.getTickets).toHaveBeenCalledWith('PROJ');
  });

  it('wraps syncFull with optional projectKey', async () => {
    const res = await syncFull('PROJ');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.syncFull).toHaveBeenCalledWith('PROJ');
  });

  it('wraps getTeamMetrics with projectKey', async () => {
    await getTeamMetrics('all', 'PROJ');
    expect(mockApi.getTeamMetrics).toHaveBeenCalledWith('all', 'PROJ');
  });

  it('wraps getIndividualMetrics with projectKey', async () => {
    await getIndividualMetrics('all', 'PROJ');
    expect(mockApi.getIndividualMetrics).toHaveBeenCalledWith('all', 'PROJ');
  });

  it('wraps listProjects', async () => {
    const res = await listProjects();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps addProject', async () => {
    const proj = { project_key: 'NEW' };
    const res = await addProject(proj);
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.addProject).toHaveBeenCalledWith(proj);
  });

  it('wraps updateProjectConfig', async () => {
    const res = await updateProjectConfig('PROJ', { project_name: 'Dev' });
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.updateProject).toHaveBeenCalledWith('PROJ', { project_name: 'Dev' });
  });

  it('wraps removeProject', async () => {
    const res = await removeProject('PROJ');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.removeProject).toHaveBeenCalledWith('PROJ');
  });

  it('wraps syncProject', async () => {
    const res = await syncProject('PROJ');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.syncProject).toHaveBeenCalledWith('PROJ');
  });

  it('wraps getCrossProjectMetrics', async () => {
    const res = await getCrossProjectMetrics('monthly');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.getCrossProjectMetrics).toHaveBeenCalledWith('monthly');
  });

  it('wraps getEpics with optional projectKey', async () => {
    const res = await getEpics('PROJ');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.getEpics).toHaveBeenCalledWith('PROJ');
  });

  it('wraps getEpicDetail with optional projectKey', async () => {
    const res = await getEpicDetail('EPIC-1', 'PROJ');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.getEpicDetail).toHaveBeenCalledWith('EPIC-1', 'PROJ');
  });

  it('wraps syncEpics with optional projectKey', async () => {
    const res = await syncEpics('PROJ');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.syncEpics).toHaveBeenCalledWith('PROJ');
  });
});
