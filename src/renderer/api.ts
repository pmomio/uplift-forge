/**
 * IPC-based API layer that replaces the Axios HTTP client.
 *
 * Each function wraps the IPC call result in { data } to match
 * the Axios response shape, so all components keep using res.data unchanged.
 */

type AxiosLike<T> = { data: T };

const wrap = <T>(p: Promise<T>): Promise<AxiosLike<T>> => p.then((data) => ({ data }));

// Auth
export const login = () => wrap(window.api.login());
export const logout = () => wrap(window.api.logout());
export const getAuthState = () => wrap(window.api.getAuthState());

// Config
export const getConfig = () => wrap(window.api.getConfig());
export const saveConfig = (config: unknown) => wrap(window.api.saveConfig(config));

// JIRA metadata
export const getJiraProject = () => wrap(window.api.getJiraProject());
export const getJiraFields = () => wrap(window.api.getJiraFields());
export const getJiraStatuses = () => wrap(window.api.getJiraStatuses());
export const getJiraMembers = () => wrap(window.api.getJiraMembers());

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
