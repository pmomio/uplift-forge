import { contextBridge, ipcRenderer } from 'electron';
import { Channels } from '../shared/channels.js';

/**
 * Typed API exposed to the renderer via contextBridge.
 */
const api = {
  // Auth
  login: (baseUrl: string, email: string, apiToken: string) =>
    ipcRenderer.invoke(Channels.AUTH_LOGIN, baseUrl, email, apiToken),
  logout: () => ipcRenderer.invoke(Channels.AUTH_LOGOUT),
  getAuthState: () => ipcRenderer.invoke(Channels.AUTH_STATE),
  resetApp: () => ipcRenderer.invoke(Channels.AUTH_RESET),
  onAuthStateChanged: (callback: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown) => callback(state);
    ipcRenderer.on(Channels.AUTH_STATE_CHANGED, listener);
    return () => ipcRenderer.removeListener(Channels.AUTH_STATE_CHANGED, listener);
  },

  // Config
  getConfig: () => ipcRenderer.invoke(Channels.CONFIG_GET),
  saveConfig: (config: unknown) => ipcRenderer.invoke(Channels.CONFIG_SAVE, config),

  // JIRA metadata
  getJiraProject: () => ipcRenderer.invoke(Channels.JIRA_PROJECT),
  getJiraFields: () => ipcRenderer.invoke(Channels.JIRA_FIELDS),
  getJiraStatuses: () => ipcRenderer.invoke(Channels.JIRA_STATUSES),
  getJiraMembers: () => ipcRenderer.invoke(Channels.JIRA_MEMBERS),

  // Tickets
  getTickets: () => ipcRenderer.invoke(Channels.TICKETS_LIST),
  updateTicket: (key: string, fields: unknown) => ipcRenderer.invoke(Channels.TICKETS_UPDATE, key, fields),
  syncSingleTicket: (key: string) => ipcRenderer.invoke(Channels.TICKETS_SYNC_ONE, key),
  calculateHours: (key: string) => ipcRenderer.invoke(Channels.TICKETS_CALC_HOURS, key),
  calculateFields: (key: string) => ipcRenderer.invoke(Channels.TICKETS_CALC_FIELDS, key),

  // Sync
  triggerSync: () => ipcRenderer.invoke(Channels.SYNC_FULL),

  // Metrics
  getTeamMetrics: (period: string) => ipcRenderer.invoke(Channels.METRICS_TEAM, period),
  getIndividualMetrics: (period: string) => ipcRenderer.invoke(Channels.METRICS_INDIVIDUAL, period),

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke(Channels.OPEN_EXTERNAL, url),

  // Update
  checkForUpdates: () => ipcRenderer.invoke(Channels.UPDATE_CHECK),
  downloadUpdate: () => ipcRenderer.invoke(Channels.UPDATE_DOWNLOAD),
  onUpdateStatus: (callback: (info: unknown) => void) => {
    const listener = (_event: unknown, info: unknown) => callback(info);
    ipcRenderer.on(Channels.UPDATE_STATUS, listener);
    return () => ipcRenderer.removeListener(Channels.UPDATE_STATUS, listener);
  },

  // AI Suggestions
  getAiConfig: () => ipcRenderer.invoke(Channels.AI_CONFIG_GET),
  setAiConfig: (provider: string, apiKey: string) => ipcRenderer.invoke(Channels.AI_CONFIG_SET, provider, apiKey),
  deleteAiConfig: () => ipcRenderer.invoke(Channels.AI_CONFIG_DELETE),
  testAiConnection: () => ipcRenderer.invoke(Channels.AI_CONFIG_TEST),
  getAiSuggestions: (req: unknown) => ipcRenderer.invoke(Channels.AI_SUGGEST, req),
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;
