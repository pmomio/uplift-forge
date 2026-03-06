import { contextBridge, ipcRenderer } from 'electron';
import { Channels } from '../shared/channels.js';

/**
 * Typed API exposed to the renderer via contextBridge.
 */
const api = {
  // Auth
  login: (baseUrl: string, email: string, apiToken: string) => ipcRenderer.invoke(Channels.AUTH_LOGIN, baseUrl, email, apiToken),
  logout: () => ipcRenderer.invoke(Channels.AUTH_LOGOUT),
  getAuthState: () => ipcRenderer.invoke(Channels.AUTH_STATE),
  resetApp: () => ipcRenderer.invoke(Channels.AUTH_RESET),

  // Config
  getConfig: () => ipcRenderer.invoke(Channels.CONFIG_GET),
  saveConfig: (payload: any) => ipcRenderer.invoke(Channels.CONFIG_SAVE, payload),

  // JIRA Metadata
  getJiraProject: () => ipcRenderer.invoke(Channels.JIRA_PROJECT),
  getJiraFields: () => ipcRenderer.invoke(Channels.JIRA_FIELDS),
  getJiraStatuses: () => ipcRenderer.invoke(Channels.JIRA_STATUSES),
  getJiraMembers: () => ipcRenderer.invoke(Channels.JIRA_MEMBERS),

  // Tickets
  getTickets: (projectKey?: string) => ipcRenderer.invoke(Channels.TICKETS_LIST, projectKey),
  updateTicket: (key: string, fields: any) => ipcRenderer.invoke(Channels.TICKETS_UPDATE, key, fields),
  syncOneTicket: (key: string) => ipcRenderer.invoke(Channels.TICKETS_SYNC_ONE, key),
  calcTicketFields: (key: string) => ipcRenderer.invoke(Channels.TICKETS_CALC_FIELDS, key),

  // Sync
  syncFull: (projectKey?: string) => ipcRenderer.invoke(Channels.SYNC_FULL, projectKey),
  syncAllProjects: () => ipcRenderer.invoke(Channels.SYNC_ALL_PROJECTS),

  // Epics
  getEpics: (projectKey?: string) => ipcRenderer.invoke(Channels.EPICS_LIST, projectKey),
  getEpicDetail: (epicKey: string, projectKey?: string) => ipcRenderer.invoke(Channels.EPIC_DETAIL, epicKey, projectKey),
  syncEpics: (projectKey?: string) => ipcRenderer.invoke(Channels.EPICS_SYNC, projectKey),

  // Timelines
  getTimelines: (projectKey?: string) => ipcRenderer.invoke(Channels.TIMELINE_LIST, projectKey),

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke(Channels.OPEN_EXTERNAL, url),

  // Update
  checkForUpdates: () => ipcRenderer.invoke(Channels.UPDATE_CHECK),
  downloadUpdate: () => ipcRenderer.invoke(Channels.UPDATE_DOWNLOAD),

  // AI
  getAiConfig: () => ipcRenderer.invoke(Channels.AI_CONFIG_GET),
  setAiConfig: (provider: string, apiKey: string) => ipcRenderer.invoke(Channels.AI_CONFIG_SET, provider, apiKey),
  deleteAiConfig: () => ipcRenderer.invoke(Channels.AI_CONFIG_DELETE),
  testAiConnection: () => ipcRenderer.invoke(Channels.AI_CONFIG_TEST),
  getAiSuggestions: (req: any) => ipcRenderer.invoke(Channels.AI_SUGGEST, req),

  // Persona-specific metrics
  getEmTeamMetrics: (period: string, projectKey?: string) => ipcRenderer.invoke(Channels.METRICS_EM_TEAM, period, projectKey),
  getEmIndividualMetrics: (period: string, projectKey?: string) => ipcRenderer.invoke(Channels.METRICS_EM_INDIVIDUAL, period, projectKey),
  getDmFlowMetrics: (period: string, projectKey?: string) => ipcRenderer.invoke(Channels.METRICS_DM_FLOW, period, projectKey),
  getDmForecastMetrics: (projectKey?: string) => ipcRenderer.invoke(Channels.METRICS_DM_FORECAST, projectKey),
  getIcPersonalMetrics: (period: string) => ipcRenderer.invoke(Channels.METRICS_IC_PERSONAL, period),
  getCtoOrgMetrics: (period: string) => ipcRenderer.invoke(Channels.METRICS_CTO_ORG, period),
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;
