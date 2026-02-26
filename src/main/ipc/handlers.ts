import { ipcMain, shell } from 'electron';
import { Channels } from '../../shared/channels.js';
import { startOAuthFlow } from '../auth/oauth.js';
import { clearTokens, isAuthenticated, getEmail, getCloudId } from '../auth/token-store.js';
import { getConfig, updateConfig } from '../services/config.service.js';
import * as jiraService from '../services/jira.service.js';
import * as ticketService from '../services/ticket.service.js';
import * as metricsService from '../services/metrics.service.js';
import type { AuthState } from '../../shared/types.js';

/**
 * Register all ipcMain.handle() handlers.
 */
export function registerIpcHandlers(): void {
  // ----- Auth -----
  ipcMain.handle(Channels.AUTH_LOGIN, async () => {
    await startOAuthFlow();
    return { status: 'authenticated', email: getEmail(), cloudId: getCloudId() };
  });

  ipcMain.handle(Channels.AUTH_LOGOUT, () => {
    clearTokens();
    return { status: 'unauthenticated' };
  });

  ipcMain.handle(Channels.AUTH_STATE, (): AuthState => {
    if (isAuthenticated()) {
      return { status: 'authenticated', email: getEmail() ?? undefined, cloudId: getCloudId() ?? undefined };
    }
    return { status: 'unauthenticated' };
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
    });

    const needsSync = projectKeyChanged || filterChanged;
    if (needsSync) {
      await ticketService.syncTickets();
    }

    if (rulesChanged && !needsSync) {
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
  ipcMain.handle(Channels.TICKETS_LIST, () => {
    return ticketService.getTickets();
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
  ipcMain.handle(Channels.SYNC_FULL, async () => {
    const count = await ticketService.syncTickets();
    return { status: 'success', count };
  });

  // ----- Metrics -----
  ipcMain.handle(Channels.METRICS_TEAM, (_event, period: string) => {
    return metricsService.getTeamMetrics(period);
  });

  ipcMain.handle(Channels.METRICS_INDIVIDUAL, (_event, period: string) => {
    return metricsService.getIndividualMetrics(period);
  });

  // ----- Shell -----
  ipcMain.handle(Channels.OPEN_EXTERNAL, (_event, url: string) => {
    return shell.openExternal(url);
  });
}
