import { getConfig, updateConfig } from './config.service.js';
import * as ticketService from './ticket.service.js';
import * as metricsService from './metrics.service.js';
import type { ProjectConfig, TeamMetricsResponse, MetricsSummary } from '../../shared/types.js';

/**
 * Multi-project management: CRUD for project configs,
 * per-project ticket sync, and cross-project metric aggregation.
 */

export function listProjects(): ProjectConfig[] {
  const cfg = getConfig();
  const projects: ProjectConfig[] = [];

  // Primary project (from flat config fields)
  if (cfg.project_key) {
    projects.push({
      project_key: cfg.project_key,
      project_name: cfg.project_key,
      field_ids: cfg.field_ids,
      mapping_rules: cfg.mapping_rules,
      eng_start_status: cfg.eng_start_status,
      eng_end_status: cfg.eng_end_status,
      eng_excluded_statuses: cfg.eng_excluded_statuses,
      ticket_filter: cfg.ticket_filter,
    });
  }

  // Additional projects
  if (cfg.projects) {
    projects.push(...cfg.projects);
  }

  return projects;
}

export function addProject(project: ProjectConfig): ProjectConfig[] {
  const cfg = getConfig();
  const projects = cfg.projects || [];
  projects.push(project);
  updateConfig({ projects });
  return listProjects();
}

export function updateProject(projectKey: string, updates: Partial<ProjectConfig>): ProjectConfig[] {
  const cfg = getConfig();

  // If updating the primary project, update flat config fields
  if (projectKey === cfg.project_key) {
    const patch: Record<string, unknown> = {};
    if (updates.field_ids) patch.field_ids = updates.field_ids;
    if (updates.mapping_rules) patch.mapping_rules = updates.mapping_rules;
    if (updates.eng_start_status) patch.eng_start_status = updates.eng_start_status;
    if (updates.eng_end_status) patch.eng_end_status = updates.eng_end_status;
    if (updates.eng_excluded_statuses != null) patch.eng_excluded_statuses = updates.eng_excluded_statuses;
    if (updates.ticket_filter != null) patch.ticket_filter = updates.ticket_filter;
    updateConfig(patch as Parameters<typeof updateConfig>[0]);
  } else {
    // Update in projects array
    const projects = cfg.projects || [];
    const idx = projects.findIndex(p => p.project_key === projectKey);
    if (idx >= 0) {
      projects[idx] = { ...projects[idx], ...updates };
      updateConfig({ projects });
    }
  }

  return listProjects();
}

export function removeProject(projectKey: string): ProjectConfig[] {
  const cfg = getConfig();
  const projects = (cfg.projects || []).filter(p => p.project_key !== projectKey);
  updateConfig({ projects });
  return listProjects();
}

export async function syncProject(projectKey: string): Promise<number> {
  // For now, sync uses the primary project's sync mechanism.
  // Future: per-project sync with scoped caches.
  return ticketService.syncTickets();
}

/**
 * Aggregate metrics across all configured projects.
 * For now, returns the primary project's metrics.
 * Full cross-project aggregation would require per-project caches.
 */
export function getCrossProjectMetrics(period = 'all'): TeamMetricsResponse {
  return metricsService.getTeamMetrics(period);
}
