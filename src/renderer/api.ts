/**
 * IPC-based API layer that replaces the Axios HTTP client.
 *
 * Each function wraps the IPC call result in { data } to match
 * the Axios response shape, so all components keep using res.data unchanged.
 */

type AxiosLikeResponse<T> = Promise<{ data: T }>;

function wrap<T>(promise: Promise<T>): AxiosLikeResponse<T> {
  return promise.then((data) => ({ data }));
}

// Auth
export const login = (baseUrl: string, email: string, apiToken: string) => wrap(window.api.login(baseUrl, email, apiToken));
export const logout = () => wrap(window.api.logout());
export const getAuthState = () => wrap(window.api.getAuthState());
export const resetApp = () => wrap(window.api.resetApp());

// Config
export const getConfig = () => wrap(window.api.getConfig());
export const saveConfig = (payload: any) => wrap(window.api.saveConfig(payload));

// JIRA Metadata
export const getJiraProject = () => wrap(window.api.getJiraProject());
export const getJiraFields = () => wrap(window.api.getJiraFields());
export const getJiraStatuses = () => wrap(window.api.getJiraStatuses());
export const getJiraMembers = () => wrap(window.api.getJiraMembers());

// Tickets
export const getTickets = (projectKey?: string) => wrap(window.api.getTickets(projectKey));
export const updateTicket = (key: string, fields: any) => wrap(window.api.updateTicket(key, fields));
export const syncOneTicket = (key: string) => wrap(window.api.syncOneTicket(key));
export const calcTicketFields = (key: string) => wrap(window.api.calcTicketFields(key));

// Sync
export const syncFull = (projectKey?: string) => wrap(window.api.syncFull(projectKey));
export const triggerSync = syncFull; // Alias for tests
export const syncAllProjects = () => wrap(window.api.syncAllProjects());

// Epics
export const getEpics = (projectKey?: string) => wrap(window.api.getEpics(projectKey));
export const getEpicDetail = (epicKey: string, projectKey?: string) => wrap(window.api.getEpicDetail(epicKey, projectKey));
export const syncEpics = (projectKey?: string) => wrap(window.api.syncEpics(projectKey));

// Timelines
export const getTimelines = (projectKey?: string) => wrap(window.api.getTimelines(projectKey));

// Shell
export const openExternal = (url: string) => window.api.openExternal(url);

// Update
export const checkForUpdates = () => wrap(window.api.checkForUpdates());
export const downloadUpdate = () => wrap(window.api.downloadUpdate());

// AI
export const getAiConfig = () => wrap(window.api.getAiConfig());
export const setAiConfig = (provider: string, apiKey: string) => wrap(window.api.setAiConfig(provider, apiKey));
export const deleteAiConfig = () => wrap(window.api.deleteAiConfig());
export const testAiConnection = () => wrap(window.api.testAiConnection());
export const getAiSuggestions = (req: any) => wrap(window.api.getAiSuggestions(req));

// Projects (Multi-project CRUD)
export const listProjects = () => wrap(window.api.listProjects());
export const addProject = (project: any) => wrap(window.api.addProject(project));
export const updateProjectConfig = (projectKey: string, updates: any) => wrap(window.api.updateProject(projectKey, updates));
export const removeProject = (projectKey: string) => wrap(window.api.removeProject(projectKey));
export const syncProject = (projectKey: string) => wrap(window.api.syncProject(projectKey));
export const getCrossProjectMetrics = (period: string) => wrap(window.api.getCrossProjectMetrics(period));

// Legacy Metrics (still used in tests)
export const getTeamMetrics = (period = 'all', projectKey?: string) => wrap(window.api.getTeamMetrics(period, projectKey));
export const getIndividualMetrics = (period = 'all', projectKey?: string) => wrap(window.api.getIndividualMetrics(period, projectKey));

// Persona-specific metrics
export const getEmTeamMetrics = (period = 'all', projectKey?: string) => wrap(window.api.getEmTeamMetrics(period, projectKey));
export const getEmIndividualMetrics = (period = 'all', projectKey?: string) => wrap(window.api.getEmIndividualMetrics(period, projectKey));
export const getDmFlowMetrics = (period = 'all', projectKey?: string) => wrap(window.api.getDmFlowMetrics(period, projectKey));
export const getDmForecastMetrics = (projectKey?: string) => wrap(window.api.getDmForecastMetrics(projectKey));
export const getIcPersonalMetrics = (period = 'all') => wrap(window.api.getIcPersonalMetrics(period));
export const getCtoOrgMetrics = (period = 'all') => wrap(window.api.getCtoOrgMetrics(period));
