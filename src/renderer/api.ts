/**
 * IPC-based API layer that replaces the Axios HTTP client.
 *
 * Each function wraps the IPC call result in { data } to match
 * the Axios response shape, so all components keep using res.data unchanged.
 */

type AxiosLike<T> = { data: T };

const wrap = <T>(p: Promise<T>): Promise<AxiosLike<T>> => p.then((data) => ({ data }));

// Auth
export const login = (baseUrl: string, email: string, apiToken: string) =>
  wrap(window.api.login(baseUrl, email, apiToken));
export const logout = () => wrap(window.api.logout());
export const getAuthState = () => wrap(window.api.getAuthState());
export const resetApp = () => wrap(window.api.resetApp());

// Config
export const getConfig = () => wrap(window.api.getConfig());
export const saveConfig = (config: unknown) => wrap(window.api.saveConfig(config));

// JIRA metadata
export const getJiraProject = () => wrap(window.api.getJiraProject());
export const getJiraFields = () => wrap(window.api.getJiraFields());
export const getJiraStatuses = () => wrap(window.api.getJiraStatuses());
export const getJiraMembers = () => wrap(window.api.getJiraMembers());
export const getJiraFieldOptions = (fieldId: string) => wrap(window.api.getJiraFieldOptions(fieldId));

// Tickets
export const getTickets = () => wrap(window.api.getTickets());
export const updateTicket = (key: string, fields: unknown) => wrap(window.api.updateTicket(key, fields));
export const syncSingleTicket = (key: string) => wrap(window.api.syncSingleTicket(key));
export const calculateHours = (key: string) => wrap(window.api.calculateHours(key));
export const calculateFields = (key: string) => wrap(window.api.calculateFields(key));

// Sync
export const triggerSync = () => wrap(window.api.triggerSync());

// Metrics
export const getTeamMetrics = (period = 'all') => wrap(window.api.getTeamMetrics(period));
export const getIndividualMetrics = (period = 'all') => wrap(window.api.getIndividualMetrics(period));

// Update
export const checkForUpdates = () => wrap(window.api.checkForUpdates());
export const downloadUpdate = () => wrap(window.api.downloadUpdate());

// AI Suggestions
export const getAiConfig = () => wrap(window.api.getAiConfig());
export const setAiConfig = (provider: string, apiKey: string) => wrap(window.api.setAiConfig(provider, apiKey));
export const deleteAiConfig = () => wrap(window.api.deleteAiConfig());
export const testAiConnection = () => wrap(window.api.testAiConnection());
export const getAiSuggestions = (req: unknown) => wrap(window.api.getAiSuggestions(req));
