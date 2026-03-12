import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set up window.api mock with all methods
const mockApi: Record<string, ReturnType<typeof vi.fn>> = {};
const apiMethods = [
  'login', 'logout', 'getAuthState', 'resetApp', 'demoLogin',
  'getConfig', 'saveConfig',
  'getJiraProject', 'getJiraFields', 'getJiraStatuses', 'getJiraMembers',
  'getTickets', 'updateTicket', 'syncOneTicket',
  'syncFull', 'syncAllProjects',
  'getEmTeamMetrics', 'getEmIndividualMetrics',
  'getDmFlowMetrics', 'getDmForecastMetrics',
  'getIcPersonalMetrics', 'getCtoOrgMetrics',
  'checkForUpdates', 'downloadUpdate',
  'getAiConfig', 'setAiConfig', 'deleteAiConfig', 'testAiConnection', 'getAiSuggestions',
  'listProjects', 'addProject', 'updateProject', 'removeProject', 'syncProject', 'getCrossProjectMetrics',
  'getEpics', 'getEpicDetail', 'syncEpics',
  'getTimelines',
];

for (const method of apiMethods) {
  mockApi[method] = vi.fn().mockResolvedValue('result');
}

(window as any).api = mockApi;

// Import after window.api is set up
import {
  login, logout, getAuthState, resetApp, demoLogin,
  getConfig, saveConfig,
  getJiraProject, getJiraFields, getJiraStatuses, getJiraMembers,
  getTickets, updateTicket, syncOneTicket,
  syncFull, syncAllProjects,
  getEmTeamMetrics, getEmIndividualMetrics,
  getDmFlowMetrics, getDmForecastMetrics,
  getIcPersonalMetrics, getCtoOrgMetrics,
  checkForUpdates, downloadUpdate,
  getAiConfig, setAiConfig, deleteAiConfig, testAiConnection, getAiSuggestions,
  listProjects, addProject, updateProjectConfig, removeProject, syncProject, getCrossProjectMetrics,
  getEpics, getEpicDetail, syncEpics,
  getTimelines,
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

  it('wraps demoLogin', async () => {
    const res = await demoLogin();
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.demoLogin).toHaveBeenCalled();
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
    const res = await updateTicket('T-1', { summary: 'New' });
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.updateTicket).toHaveBeenCalledWith('T-1', { summary: 'New' });
  });

  it('wraps syncOneTicket', async () => {
    const res = await syncOneTicket('T-1');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.syncOneTicket).toHaveBeenCalledWith('T-1');
  });

  it('wraps syncFull', async () => {
    const res = await syncFull();
    expect(res).toEqual({ data: 'result' });
  });

  it('wraps getEmTeamMetrics with default period', async () => {
    const res = await getEmTeamMetrics();
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.getEmTeamMetrics).toHaveBeenCalledWith('all', undefined);
  });

  it('wraps getEmTeamMetrics with custom period', async () => {
    await getEmTeamMetrics('weekly');
    expect(mockApi.getEmTeamMetrics).toHaveBeenCalledWith('weekly', undefined);
  });

  it('wraps getEmIndividualMetrics with default period', async () => {
    const res = await getEmIndividualMetrics();
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.getEmIndividualMetrics).toHaveBeenCalledWith('all', undefined);
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

  it('wraps getEmTeamMetrics with projectKey', async () => {
    await getEmTeamMetrics('all', 'PROJ');
    expect(mockApi.getEmTeamMetrics).toHaveBeenCalledWith('all', 'PROJ');
  });

  it('wraps getEmIndividualMetrics with projectKey', async () => {
    await getEmIndividualMetrics('all', 'PROJ');
    expect(mockApi.getEmIndividualMetrics).toHaveBeenCalledWith('all', 'PROJ');
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

  it('wraps getTimelines', async () => {
    const res = await getTimelines('PROJ');
    expect(res).toEqual({ data: 'result' });
    expect(mockApi.getTimelines).toHaveBeenCalledWith('PROJ');
  });
});
