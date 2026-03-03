import { ipcMain, shell } from 'electron';
import { Channels } from '../../shared/channels.js';
import { saveCredentials, clearCredentials, isAuthenticated, getEmail, getBaseUrl, emitAuthStateChanged } from '../auth/token-store.js';
import { getConfig, updateConfig, resetConfig } from '../services/config.service.js';
import * as jiraService from '../services/jira.service.js';
import * as ticketService from '../services/ticket.service.js';
import * as metricsService from '../services/metrics.service.js';
import * as updateService from '../services/update.service.js';
import * as projectService from '../services/project.service.js';
import * as epicService from '../services/epic.service.js';
import * as timelineService from '../services/timeline.service.js';
import * as emMetricsService from '../services/em-metrics.service.js';
import * as dmMetricsService from '../services/dm-metrics.service.js';
import * as icMetricsService from '../services/ic-metrics.service.js';
import * as ctoMetricsService from '../services/cto-metrics.service.js';
import { saveAiConfig, getAiConfig, deleteAiConfig } from '../auth/ai-key-store.js';
import * as aiService from '../services/ai.service.js';
import type { AuthState, AiProvider, AiSuggestRequest, ProjectConfig } from '../../shared/types.js';

/**
 * Register all ipcMain.handle() handlers.
 */
export function registerIpcHandlers(): void {
  // ----- Auth -----
  ipcMain.handle(Channels.AUTH_LOGIN, async (_event, baseUrl: string, email: string, apiToken: string) => {
    saveCredentials(baseUrl, email, apiToken);
    emitAuthStateChanged();
    return { status: 'authenticated', email, baseUrl } as AuthState;
  });

  ipcMain.handle(Channels.AUTH_LOGOUT, () => {
    clearCredentials();
    return { status: 'unauthenticated' };
  });

  ipcMain.handle(Channels.AUTH_STATE, (): AuthState => {
    if (isAuthenticated()) {
      return { status: 'authenticated', email: getEmail() ?? undefined, baseUrl: getBaseUrl() ?? undefined };
    }
    return { status: 'unauthenticated' };
  });

  ipcMain.handle(Channels.AUTH_RESET, () => {
    // Full reset — clears everything (auth + config + caches + timelines).
    // User goes back to login page.
    clearCredentials();
    resetConfig();
    ticketService.clearAllCaches();
    timelineService.invalidateTimelineCache();
    deleteAiConfig();
    return { status: 'reset' };
  });

  // ----- Config -----
  ipcMain.handle(Channels.CONFIG_GET, () => {
    return getConfig();
  });

  ipcMain.handle(Channels.CONFIG_SAVE, async (_event, payload: Record<string, unknown>) => {
    const { projectKeyChanged, filterChanged, rulesChanged } = updateConfig({
      project_key: payload.project_key as string | undefined,
      field_ids: payload.field_ids as ReturnType<typeof getConfig>['field_ids'] | undefined,
      eng_start_status: payload.eng_start_status as string | undefined,
      eng_end_status: payload.eng_end_status as string | undefined,
      eng_excluded_statuses: payload.eng_excluded_statuses as string[] | undefined,
      ticket_filter: payload.ticket_filter as ReturnType<typeof getConfig>['ticket_filter'] | undefined,
      mapping_rules: payload.mapping_rules as ReturnType<typeof getConfig>['mapping_rules'] | undefined,
      sp_to_days: payload.sp_to_days as number | undefined,
      tracked_engineers: payload.tracked_engineers as ReturnType<typeof getConfig>['tracked_engineers'] | undefined,
      persona: payload.persona as ReturnType<typeof getConfig>['persona'] | undefined,
      metric_preferences: payload.metric_preferences as ReturnType<typeof getConfig>['metric_preferences'] | undefined,
      projects: payload.projects as ReturnType<typeof getConfig>['projects'] | undefined,
    });

    // Check if additional projects were added/changed
    const projectsChanged = payload.projects != null;
    const needsSync = projectKeyChanged || filterChanged;
    if (needsSync || projectsChanged) {
      await ticketService.syncAllProjects();
    }

    if (rulesChanged && !needsSync && !projectsChanged) {
      ticketService.reprocessCache();
    }

    const visible = ticketService.getVisibleTicketCount();
    return { status: 'success', sync_triggered: needsSync, ticket_count: visible };
  });

  // ----- JIRA metadata -----
  ipcMain.handle(Channels.JIRA_PROJECT, async () => {
    const cfg = getConfig();
    if (!cfg.project_key) return { error: 'No project key configured' };
    return jiraService.getProject(cfg.project_key);
  });

  ipcMain.handle(Channels.JIRA_FIELDS, async () => {
    return jiraService.getAllFields();
  });

  ipcMain.handle(Channels.JIRA_STATUSES, async () => {
    return jiraService.getAllStatuses();
  });

  ipcMain.handle(Channels.JIRA_MEMBERS, () => {
    return ticketService.getJiraMembers();
  });

  // ----- Tickets -----
  ipcMain.handle(Channels.TICKETS_LIST, (_event, projectKey?: string) => {
    return ticketService.getTickets(projectKey);
  });

  ipcMain.handle(Channels.TICKETS_UPDATE, async (_event, key: string, fields: Record<string, unknown>) => {
    return ticketService.updateTicket(key, fields);
  });

  ipcMain.handle(Channels.TICKETS_SYNC_ONE, async (_event, key: string) => {
    return ticketService.syncSingleTicket(key);
  });

  ipcMain.handle(Channels.TICKETS_CALC_HOURS, async (_event, key: string) => {
    return ticketService.calculateTicketHours(key);
  });

  ipcMain.handle(Channels.TICKETS_CALC_FIELDS, async (_event, key: string) => {
    return ticketService.calculateTicketFields(key);
  });

  // ----- Sync -----
  ipcMain.handle(Channels.SYNC_FULL, async (_event, projectKey?: string) => {
    const count = await ticketService.syncTickets(projectKey);
    return { status: 'success', count };
  });

  // ----- Metrics -----
  ipcMain.handle(Channels.METRICS_TEAM, (_event, period: string, projectKey?: string) => {
    return metricsService.getTeamMetrics(period, projectKey);
  });

  ipcMain.handle(Channels.METRICS_INDIVIDUAL, (_event, period: string, projectKey?: string) => {
    return metricsService.getIndividualMetrics(period, projectKey);
  });

  // ----- Shell -----
  ipcMain.handle(Channels.OPEN_EXTERNAL, (_event, url: string) => {
    return shell.openExternal(url);
  });

  // ----- Update -----
  ipcMain.handle(Channels.UPDATE_CHECK, () => updateService.checkForUpdates());
  ipcMain.handle(Channels.UPDATE_DOWNLOAD, () => updateService.downloadUpdate());

  // ----- AI Suggestions -----
  ipcMain.handle(Channels.AI_CONFIG_GET, () => getAiConfig());

  ipcMain.handle(Channels.AI_CONFIG_SET, (_event, provider: AiProvider, apiKey: string) => {
    saveAiConfig(provider, apiKey);
    return { status: 'success' };
  });

  ipcMain.handle(Channels.AI_CONFIG_DELETE, () => {
    deleteAiConfig();
    return { status: 'success' };
  });

  ipcMain.handle(Channels.AI_CONFIG_TEST, () => aiService.testAiConnection());

  ipcMain.handle(Channels.AI_SUGGEST, (_event, req: AiSuggestRequest) => aiService.getAiSuggestions(req));

  // ----- Multi-Project -----
  ipcMain.handle(Channels.PROJECT_LIST, () => projectService.listProjects());

  ipcMain.handle(Channels.PROJECT_ADD, (_event, project: ProjectConfig) => projectService.addProject(project));

  ipcMain.handle(Channels.PROJECT_UPDATE, (_event, projectKey: string, updates: Partial<ProjectConfig>) =>
    projectService.updateProject(projectKey, updates));

  ipcMain.handle(Channels.PROJECT_REMOVE, (_event, projectKey: string) => projectService.removeProject(projectKey));

  ipcMain.handle(Channels.PROJECT_SYNC, async (_event, projectKey: string) => {
    const count = await projectService.syncProject(projectKey);
    return { status: 'success', count };
  });

  ipcMain.handle(Channels.METRICS_CROSS_PROJECT, (_event, period: string) =>
    projectService.getCrossProjectMetrics(period));

  // ----- Sync All Projects -----
  ipcMain.handle(Channels.SYNC_ALL_PROJECTS, async () => {
    const results = await ticketService.syncAllProjects();
    return { status: 'success', results };
  });

  // ----- Epics -----
  ipcMain.handle(Channels.EPICS_LIST, (_event, projectKey?: string) => epicService.getEpicSummaries(projectKey));

  ipcMain.handle(Channels.EPIC_DETAIL, (_event, epicKey: string, projectKey?: string) => epicService.getEpicDetail(epicKey, projectKey));

  ipcMain.handle(Channels.EPICS_SYNC, async (_event, projectKey?: string) => {
    if (projectKey) {
      await ticketService.syncTickets(projectKey);
    } else {
      await ticketService.syncAllProjects();
    }
    return epicService.getEpicSummaries(projectKey);
  });

  // ----- Timeline -----
  ipcMain.handle(Channels.TIMELINE_LIST, (_event, projectKey?: string) =>
    timelineService.getTimelines(projectKey));

  // ----- Persona-specific metrics (stubs — wired in Phase 2-4) -----
  ipcMain.handle(Channels.METRICS_EM_TEAM, (_event, period: string, projectKey?: string) => {
    const persona = getConfig().persona;
    if (persona !== 'engineering_manager') return { error: 'Unauthorized: EM metrics require engineering_manager persona' };
    return emMetricsService.getEmTeamMetrics(period, projectKey);
  });

  ipcMain.handle(Channels.METRICS_EM_INDIVIDUAL, (_event, period: string, projectKey?: string) => {
    const persona = getConfig().persona;
    if (persona !== 'engineering_manager') return { error: 'Unauthorized: EM metrics require engineering_manager persona' };
    return emMetricsService.getEmIndividualMetrics(period, projectKey);
  });

  ipcMain.handle(Channels.METRICS_DM_FLOW, (_event, period: string, projectKey?: string) => {
    const persona = getConfig().persona;
    if (persona !== 'delivery_manager') return { error: 'Unauthorized: DM metrics require delivery_manager persona' };
    return dmMetricsService.getDmFlowMetrics(period, projectKey);
  });

  ipcMain.handle(Channels.METRICS_DM_FORECAST, (_event, projectKey?: string) => {
    const persona = getConfig().persona;
    if (persona !== 'delivery_manager') return { error: 'Unauthorized: DM metrics require delivery_manager persona' };
    // Forecast is part of flow metrics — use the Monte Carlo section
    return dmMetricsService.getDmFlowMetrics('all', projectKey);
  });

  ipcMain.handle(Channels.METRICS_IC_PERSONAL, (_event, period: string) => {
    const persona = getConfig().persona;
    if (persona !== 'individual') return { error: 'Unauthorized: IC metrics require individual persona' };
    return icMetricsService.getIcPersonalMetrics(period);
  });

  ipcMain.handle(Channels.METRICS_CTO_ORG, (_event, period: string) => {
    const persona = getConfig().persona;
    if (persona !== 'management') return { error: 'Unauthorized: Management metrics require management persona' };
    return ctoMetricsService.getCtoOrgMetrics(period);
  });
}
