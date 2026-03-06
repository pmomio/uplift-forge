import Store from 'electron-store';
import { getConfig } from './config.service.js';
import { getMappedFields } from './field-engine.service.js';
import * as jira from './jira.service.js';
import { getBaseUrl } from '../auth/token-store.js';
import { invalidateTimelineCache } from './timeline.service.js';
import type { ProcessedTicket, ProjectConfig, AppConfig, MappingRules } from '../../shared/types.js';

/**
 * Port of backend/routes/tickets.py — ticket caching, sync, and processing.
 *
 * Caches are per-project: each project key gets its own ticket + raw issue sub-cache.
 * When projectKey is omitted from getTickets/getAllTickets, all projects are aggregated.
 */

export const FINAL_STATUSES = ['Done', 'Rejected', 'Closed', 'Resolved', 'Cancelled'];

// In-memory caches — project-keyed
const projectTicketCaches = new Map<string, Map<string, ProcessedTicket>>();
const projectRawCaches = new Map<string, Map<string, Record<string, unknown>>>();

// Persistent store for cache across restarts
interface PersistedCacheV2 {
  projects: Record<string, {
    ticketCache: Record<string, ProcessedTicket>;
    rawIssueCache: Record<string, Record<string, unknown>>;
  }>;
}

// Legacy flat format for migration
interface PersistedCacheV1 {
  ticketCache: Record<string, ProcessedTicket>;
  rawIssueCache: Record<string, Record<string, unknown>>;
}

const cacheStore = new Store<PersistedCacheV2 & Partial<PersistedCacheV1>>({
  name: 'ticket-cache',
  defaults: {
    projects: {},
  },
});

function ensureProjectCache(projectKey: string): void {
  if (!projectTicketCaches.has(projectKey)) {
    projectTicketCaches.set(projectKey, new Map());
  }
  if (!projectRawCaches.has(projectKey)) {
    projectRawCaches.set(projectKey, new Map());
  }
}

// Load persisted caches on init, with migration from v1 flat format
function loadPersistedCaches(): void {
  // Check for legacy v1 flat format (root has 'ticketCache' key)
  const legacyTickets = cacheStore.get('ticketCache') as Record<string, ProcessedTicket> | undefined;
  if (legacyTickets && Object.keys(legacyTickets).length > 0) {
    // Migrate: wrap under primary project key
    const cfg = getConfig();
    const primaryKey = cfg.project_key || '_default';
    console.log(`[Tickets] Migrating v1 flat cache to per-project format under "${primaryKey}"`);

    const legacyRaw = (cacheStore.get('rawIssueCache') ?? {}) as Record<string, Record<string, unknown>>;

    ensureProjectCache(primaryKey);
    const ticketMap = projectTicketCaches.get(primaryKey)!;
    const rawMap = projectRawCaches.get(primaryKey)!;

    for (const [key, ticket] of Object.entries(legacyTickets)) {
      // Backfill project_key on migrated tickets
      ticket.project_key = ticket.project_key || primaryKey;
      ticketMap.set(key, ticket);
    }
    for (const [key, issue] of Object.entries(legacyRaw)) {
      rawMap.set(key, issue);
    }

    // Persist in v2 format and clear v1 keys
    persistCaches();
    cacheStore.delete('ticketCache' as keyof PersistedCacheV2);
    cacheStore.delete('rawIssueCache' as keyof PersistedCacheV2);

    const total = ticketMap.size;
    console.log(`[Tickets] Migrated ${total} tickets to per-project format`);
    return;
  }

  // v2 format: load per-project caches
  const persisted = cacheStore.get('projects') ?? {};
  let total = 0;
  for (const [projectKey, data] of Object.entries(persisted)) {
    ensureProjectCache(projectKey);
    const ticketMap = projectTicketCaches.get(projectKey)!;
    const rawMap = projectRawCaches.get(projectKey)!;

    for (const [key, ticket] of Object.entries(data.ticketCache ?? {})) {
      ticket.project_key = ticket.project_key || projectKey;
      ticketMap.set(key, ticket);
    }
    for (const [key, issue] of Object.entries(data.rawIssueCache ?? {})) {
      rawMap.set(key, issue);
    }
    total += ticketMap.size;
  }
  console.log(`[Tickets] Loaded ${total} cached tickets across ${Object.keys(persisted).length} projects from disk`);
}

export function persistCaches(): void {
  const projects: PersistedCacheV2['projects'] = {};
  for (const [projectKey, ticketMap] of projectTicketCaches) {
    const rawMap = projectRawCaches.get(projectKey);
    projects[projectKey] = {
      ticketCache: Object.fromEntries(ticketMap),
      rawIssueCache: rawMap ? Object.fromEntries(rawMap) : {},
    };
  }
  cacheStore.set('projects', projects);
}

// Load caches at module init
loadPersistedCaches();

/**
 * Resolve project config for a given project key.
 * If it matches the primary project, returns primary config fields.
 * Otherwise searches the projects[] array. Falls back to primary config.
 */
function resolveProjectConfig(projectKey: string): {
  field_ids: AppConfig['field_ids'];
  mapping_rules: AppConfig['mapping_rules'];
  ticket_filter: AppConfig['ticket_filter'];
  sp_to_days: number;
} {
  const cfg = getConfig();

  if (projectKey === cfg.project_key) {
    return {
      field_ids: cfg.field_ids,
      mapping_rules: cfg.mapping_rules,
      ticket_filter: cfg.ticket_filter,
      sp_to_days: cfg.sp_to_days,
    };
  }

  // Search additional projects
  const additional = cfg.projects?.find(p => p.project_key === projectKey);
  if (additional) {
    return {
      field_ids: additional.field_ids,
      mapping_rules: additional.mapping_rules,
      ticket_filter: additional.ticket_filter ?? cfg.ticket_filter,
      sp_to_days: cfg.sp_to_days,
    };
  }

  // Fallback to primary config
  return {
    field_ids: cfg.field_ids,
    mapping_rules: cfg.mapping_rules,
    ticket_filter: cfg.ticket_filter,
    sp_to_days: cfg.sp_to_days,
  };
}

/**
 * Process a single JIRA issue into the ticket cache.
 * projectKey determines which project sub-cache to store in.
 * projectCfg provides field_ids, mapping_rules, and eng status config for that project.
 */
export function processIssue(
  issue: Record<string, unknown>,
  storeRaw = true,
  projectKey?: string,
  projectCfg?: ReturnType<typeof resolveProjectConfig>,
): void {
  try {
    const key = issue.key as string;
    const resolvedProjectKey = projectKey ?? getConfig().project_key;
    const cfg = projectCfg ?? resolveProjectConfig(resolvedProjectKey);

    ensureProjectCache(resolvedProjectKey);
    const ticketMap = projectTicketCaches.get(resolvedProjectKey)!;
    const rawMap = projectRawCaches.get(resolvedProjectKey)!;

    if (storeRaw) {
      rawMap.set(key, issue);
    }

    const fields = (issue.fields ?? {}) as Record<string, unknown>;
    const summary = (fields.summary as string) ?? 'No Summary';
    const statusObj = fields.status as Record<string, unknown> | null;
    const status = statusObj ? (statusObj.name as string) ?? 'Unknown' : 'Unknown';
    const assigneeObj = fields.assignee as Record<string, unknown> | null;
    const assignee = assigneeObj ? (assigneeObj.displayName as string) ?? 'Unassigned' : 'Unassigned';

    // JIRA custom field values
    const tpdBuField = cfg.field_ids.tpd_bu;
    const workStreamField = cfg.field_ids.work_stream;

    let jiraTpdBu: string | null = null;
    if (tpdBuField) {
      const raw = fields[tpdBuField] as unknown;
      if (Array.isArray(raw) && raw.length > 0) {
        jiraTpdBu = (raw[0] as Record<string, string>).value ?? null;
      } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        jiraTpdBu = (raw as Record<string, string>).value ?? null;
      }
    }

    let jiraWorkStream: string | null = null;
    if (workStreamField) {
      const raw = fields[workStreamField] as unknown;
      if (Array.isArray(raw) && raw.length > 0) {
        jiraWorkStream = (raw[0] as Record<string, string>).value ?? null;
      } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        jiraWorkStream = (raw as Record<string, string>).value ?? null;
      }
    }

    // Compute values from rules using project-specific config
    const [compTpdBu, compWorkStream] = getMappedFields(issue, cfg.mapping_rules);

    const usesComputedTpdBu = !jiraTpdBu && !!compTpdBu;
    const usesComputedWorkStream = !jiraWorkStream && !!compWorkStream;

    // Story points
    const spField = cfg.field_ids.story_points;
    let storyPoints: number | null = null;
    if (spField) {
      const raw = fields[spField];
      if (raw != null) {
        const parsed = Number(raw);
        if (!isNaN(parsed)) storyPoints = parsed;
      }
    }
    if (storyPoints == null) {
      const raw = fields.story_points;
      if (raw != null) {
        const parsed = Number(raw);
        if (!isNaN(parsed)) storyPoints = parsed;
      }
    }

    // Issue type and priority
    const issueTypeObj = fields.issuetype as Record<string, unknown> | null;
    const issueType = issueTypeObj ? (issueTypeObj.name as string) ?? 'Unknown' : 'Unknown';
    const priorityObj = fields.priority as Record<string, unknown> | null;
    const priority = priorityObj ? (priorityObj.name as string) ?? 'Unknown' : 'Unknown';

    // Get base URL from auth
    const baseUrl = getBaseUrl() ?? '';

    // Extract parent epic info (JIRA v3 includes parent in issue response)
    const parentObj = fields.parent as Record<string, unknown> | null;
    const parentKey = parentObj ? (parentObj.key as string) ?? undefined : undefined;
    const parentFields = parentObj ? (parentObj.fields as Record<string, unknown>) ?? {} : {};
    const parentSummary = parentFields.summary as string | undefined;

    // Extract labels
    const rawLabels = fields.labels as string[] | null;
    const labels = rawLabels && rawLabels.length > 0 ? rawLabels : undefined;

    // Extract assignee_id
    const assigneeId = assigneeObj ? (assigneeObj.accountId as string) ?? null : null;

    // Extract sprint info (last sprint from sprint field array)
    let sprintId: string | null = null;
    let sprintName: string | null = null;
    const sprintField = fields.sprint as Array<Record<string, unknown>> | Record<string, unknown> | null;
    if (Array.isArray(sprintField) && sprintField.length > 0) {
      const lastSprint = sprintField[sprintField.length - 1];
      sprintId = lastSprint.id != null ? String(lastSprint.id) : null;
      sprintName = (lastSprint.name as string) ?? null;
    } else if (sprintField && typeof sprintField === 'object' && !Array.isArray(sprintField)) {
      sprintId = sprintField.id != null ? String(sprintField.id) : null;
      sprintName = (sprintField.name as string) ?? null;
    }

    // Extract components
    const rawComponents = fields.components as Array<Record<string, unknown>> | null;
    const components = rawComponents
      ? rawComponents.map(c => (c.name as string) ?? '').filter(Boolean)
      : [];

    ticketMap.set(key, {
      key,
      project_key: resolvedProjectKey,
      summary,
      status,
      assignee,
      tpd_bu: jiraTpdBu ?? compTpdBu,
      work_stream: jiraWorkStream ?? compWorkStream,
      has_computed_values: usesComputedTpdBu || usesComputedWorkStream,
      story_points: storyPoints,
      issue_type: issueType,
      priority,
      created: fields.created as string | null,
      resolved: fields.resolutiondate as string | null,
      base_url: baseUrl,
      updated: fields.updated as string | null,
      parent_key: parentKey,
      parent_summary: parentSummary,
      labels,
      assignee_id: assigneeId,
      sprint_id: sprintId,
      sprint_name: sprintName,
      components,
    });
  } catch (e) {
    console.error(`[Tickets] Error processing issue ${(issue as Record<string, unknown>).key}:`, e);
  }
}

/**
 * Re-run processIssue on all cached raw issues (after rule changes).
 * Iterates per-project using each project's config.
 */
export function reprocessCache(): void {
  let total = 0;
  for (const [projectKey, rawMap] of projectRawCaches) {
    const cfg = resolveProjectConfig(projectKey);
    console.log(`[Tickets] Reprocessing ${rawMap.size} cached issues for project "${projectKey}"...`);
    for (const issue of rawMap.values()) {
      processIssue(issue, false, projectKey, cfg);
    }
    total += rawMap.size;
  }
  persistCaches();
  invalidateTimelineCache();
  console.log(`[Tickets] Reprocessing complete. ${total} issues across ${projectRawCaches.size} projects.`);
}

/**
 * Full sync: fetch all issues from JIRA and rebuild caches for a project.
 * If projectKey is omitted, syncs the primary project (backward compatible).
 */
export async function syncTickets(projectKey?: string): Promise<number> {
  const cfg = getConfig();
  const targetKey = projectKey ?? cfg.project_key;
  const projectCfg = resolveProjectConfig(targetKey);

  console.log(`[Tickets] Starting sync for project: ${targetKey}`);
  try {
    const tf = projectCfg.ticket_filter;
    let months = tf.months ?? 6;
    // Cap at 12 months; treat legacy "all" mode as 12 months
    if ((tf.mode as string) === 'all' || months == null) {
      months = 12;
    }
    months = Math.min(months, 12);

    const issues = await jira.getIssues(targetKey, months);
    console.log(`[Tickets] Fetched ${issues.length} issues from JIRA for project "${targetKey}".`);

    // Clear only this project's caches
    ensureProjectCache(targetKey);
    projectTicketCaches.get(targetKey)!.clear();
    projectRawCaches.get(targetKey)!.clear();

    for (const issue of issues) {
      processIssue(issue as Record<string, unknown>, true, targetKey, projectCfg);
    }

    persistCaches();
    invalidateTimelineCache(targetKey);
    const ticketCount = projectTicketCaches.get(targetKey)!.size;
    console.log(`[Tickets] Sync complete for "${targetKey}". ${ticketCount} tickets cached.`);
    return issues.length;
  } catch (e) {
    console.error(`[Tickets] Sync failed for "${targetKey}":`, e);
    throw e;
  }
}

/**
 * Sync all configured projects sequentially.
 * Returns a map of project_key → ticket count.
 */
export async function syncAllProjects(): Promise<Record<string, number>> {
  const cfg = getConfig();
  const results: Record<string, number> = {};

  // Always sync primary project
  if (cfg.project_key) {
    results[cfg.project_key] = await syncTickets(cfg.project_key);
  }

  // Sync additional projects
  if (cfg.projects) {
    for (const p of cfg.projects) {
      if (p.project_key && p.project_key !== cfg.project_key) {
        results[p.project_key] = await syncTickets(p.project_key);
      }
    }
  }

  return results;
}

/**
 * Sync a single ticket from JIRA.
 */
export async function syncSingleTicket(key: string): Promise<ProcessedTicket | null> {
  const issues = await jira.searchIssues(`key = "${key}"`);
  if (issues.length === 0) throw new Error('Ticket not found in JIRA');
  // Infer project from ticket key prefix (e.g., "PROJ-123" → "PROJ")
  const projectKey = key.split('-')[0];
  const cfg = resolveProjectConfig(projectKey);
  processIssue(issues[0] as Record<string, unknown>, true, projectKey, cfg);
  persistCaches();
  const ticketMap = projectTicketCaches.get(projectKey);
  return ticketMap?.get(key) ?? null;
}

/**
 * Calculate mapped fields for a single ticket.
 */
export async function calculateTicketFields(key: string): Promise<{ tpd_bu: string | null; work_stream: string | null }> {
  const issues = await jira.searchIssues(`key = "${key}"`);
  if (issues.length === 0) throw new Error('Ticket not found');
  const projectKey = key.split('-')[0];
  const cfg = resolveProjectConfig(projectKey);
  const [tpdBu, workStream] = getMappedFields(issues[0] as Record<string, unknown>, cfg.mapping_rules);
  return { tpd_bu: tpdBu, work_stream: workStream };
}

/**
 * Get filtered tickets from cache.
 * If projectKey is provided, returns only that project's tickets.
 * If omitted, aggregates across all projects.
 */
export function getTickets(projectKey?: string): ProcessedTicket[] {
  const cfg = getConfig();
  let allTickets: ProcessedTicket[];

  if (projectKey) {
    const ticketMap = projectTicketCaches.get(projectKey);
    allTickets = ticketMap ? Array.from(ticketMap.values()) : [];
  } else {
    // Aggregate across all projects
    allTickets = [];
    for (const ticketMap of projectTicketCaches.values()) {
      allTickets.push(...ticketMap.values());
    }
  }

  let filtered = allTickets.filter((t) => FINAL_STATUSES.includes(t.status));

  if (cfg.ticket_filter.mode === 'missing_fields') {
    filtered = filtered.filter((t) => !t.tpd_bu || !t.work_stream);
  }

  return filtered.sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? ''));
}

/**
 * Update a ticket inline (cache + JIRA write-back).
 */
export async function updateTicket(
  key: string,
  fields: Record<string, unknown>,
): Promise<ProcessedTicket | null> {
  const projectKey = key.split('-')[0];
  const cfg = resolveProjectConfig(projectKey);

  // Map frontend field names to JIRA custom field IDs
  const jiraPayload: Record<string, unknown> = {};
  if ('tpd_bu' in fields) {
    const fieldId = cfg.field_ids.tpd_bu;
    if (fieldId) {
      jiraPayload[fieldId] = fields.tpd_bu ? [{ value: fields.tpd_bu }] : [];
    }
  }
  if ('work_stream' in fields) {
    const fieldId = cfg.field_ids.work_stream;
    if (fieldId) {
      jiraPayload[fieldId] = fields.work_stream ? { value: fields.work_stream } : null;
    }
  }

  if (Object.keys(jiraPayload).length > 0) {
    await jira.updateIssueFields(key, jiraPayload);
  }

  // Find ticket in the right project cache
  const ticketMap = projectTicketCaches.get(projectKey);
  const ticket = ticketMap?.get(key);
  if (ticket) {
    Object.assign(ticket, fields);
    ticket.has_computed_values = false;
    persistCaches();
  }
  return ticket ?? null;
}

/**
 * Get all tickets from cache (regardless of status or filter).
 * Used by epic service for comprehensive epic analysis.
 * If projectKey is provided, returns only that project's tickets.
 * If omitted, aggregates across all projects.
 */
export function getAllTickets(projectKey?: string): ProcessedTicket[] {
  if (projectKey) {
    const ticketMap = projectTicketCaches.get(projectKey);
    return ticketMap ? Array.from(ticketMap.values()) : [];
  }
  // Aggregate across all projects
  const allTickets: ProcessedTicket[] = [];
  for (const ticketMap of projectTicketCaches.values()) {
    allTickets.push(...ticketMap.values());
  }
  return allTickets;
}

/**
 * Get count of visible tickets (for config save response).
 */
export function getVisibleTicketCount(): number {
  return getTickets().length;
}

/**
 * Get unique assignees from raw issue cache (actual team members).
 * Aggregates across all projects.
 */
export function getJiraMembers(): Array<{ accountId: string; displayName: string; avatar?: string; active: boolean }> {
  const members: Array<{ accountId: string; displayName: string; avatar?: string; active: boolean }> = [];
  const seen = new Set<string>();

  for (const rawMap of projectRawCaches.values()) {
    for (const issue of rawMap.values()) {
      const fields = (issue.fields ?? {}) as Record<string, unknown>;
      const assigneeObj = fields.assignee as Record<string, unknown> | null;
      if (!assigneeObj) continue;
      const accountId = assigneeObj.accountId as string;
      if (!accountId || seen.has(accountId)) continue;
      seen.add(accountId);
      const avatarUrls = (assigneeObj.avatarUrls ?? {}) as Record<string, string>;
      members.push({
        accountId,
        displayName: (assigneeObj.displayName as string) ?? 'Unknown',
        avatar: avatarUrls['48x48'],
        active: (assigneeObj.active as boolean) ?? true,
      });
    }
  }

  members.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return members;
}

/**
 * Get raw JIRA issues from cache.
 * If projectKey is provided, returns that project's raw map.
 * If omitted, returns a record of all project -> raw maps.
 */
export function getRawIssues(projectKey?: string): Map<string, Record<string, unknown>> | Record<string, Map<string, Record<string, unknown>>> {
  if (projectKey) {
    return projectRawCaches.get(projectKey) ?? new Map();
  }
  // Return all project raw caches
  const result: Record<string, Map<string, Record<string, unknown>>> = {};
  for (const [pk, rawMap] of projectRawCaches) {
    result[pk] = rawMap;
  }
  return result;
}

/**
 * Clear all in-memory and persisted ticket caches.
 * Used by "Reset App" to wipe data.
 */
export function clearAllCaches(): void {
  projectTicketCaches.clear();
  projectRawCaches.clear();
  cacheStore.clear();
}
