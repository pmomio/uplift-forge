import Store from 'electron-store';
import { getConfig } from './config.service.js';
import { calculateEngineeringHours, getMappedFields } from './field-engine.service.js';
import * as jira from './jira.service.js';
import type { ProcessedTicket } from '../../shared/types.js';

/**
 * Port of backend/routes/tickets.py — ticket caching, sync, and processing.
 */

export const FINAL_STATUSES = ['Done', 'Rejected', 'Closed', 'Resolved', 'Cancelled'];

// In-memory caches
const ticketCache = new Map<string, ProcessedTicket>();
const rawIssueCache = new Map<string, Record<string, unknown>>();

// Persistent store for cache across restarts
const cacheStore = new Store<{
  ticketCache: Record<string, ProcessedTicket>;
  rawIssueCache: Record<string, Record<string, unknown>>;
}>({
  name: 'ticket-cache',
  defaults: {
    ticketCache: {},
    rawIssueCache: {},
  },
});

// Load persisted caches on init
function loadPersistedCaches(): void {
  const persistedTickets = cacheStore.get('ticketCache');
  const persistedRaw = cacheStore.get('rawIssueCache');
  for (const [key, ticket] of Object.entries(persistedTickets)) {
    ticketCache.set(key, ticket);
  }
  for (const [key, issue] of Object.entries(persistedRaw)) {
    rawIssueCache.set(key, issue);
  }
  console.log(`[Tickets] Loaded ${ticketCache.size} cached tickets from disk`);
}

function persistCaches(): void {
  cacheStore.set('ticketCache', Object.fromEntries(ticketCache));
  cacheStore.set('rawIssueCache', Object.fromEntries(rawIssueCache));
}

// Load caches at module init
loadPersistedCaches();

/**
 * Process a single JIRA issue into the ticket cache.
 */
export function processIssue(issue: Record<string, unknown>, storeRaw = true): void {
  try {
    const key = issue.key as string;
    if (storeRaw) {
      rawIssueCache.set(key, issue);
    }

    const cfg = getConfig();
    const fields = (issue.fields ?? {}) as Record<string, unknown>;
    const summary = (fields.summary as string) ?? 'No Summary';
    const statusObj = fields.status as Record<string, unknown> | null;
    const status = statusObj ? (statusObj.name as string) ?? 'Unknown' : 'Unknown';
    const assigneeObj = fields.assignee as Record<string, unknown> | null;
    const assignee = assigneeObj ? (assigneeObj.displayName as string) ?? 'Unassigned' : 'Unassigned';

    // JIRA custom field values
    const tpdBuField = cfg.field_ids.tpd_bu;
    const engHoursField = cfg.field_ids.eng_hours;
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

    let jiraEngHours: number | null = null;
    if (engHoursField) {
      const raw = fields[engHoursField];
      if (raw != null) jiraEngHours = Number(raw);
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

    // Compute values from changelog/rules
    const changelog = (issue.changelog ?? {}) as { histories?: unknown[] };
    const histories = (changelog.histories ?? []) as Array<{
      created: string;
      items: Array<{ field: string; toString?: string; fromString?: string }>;
    }>;
    const compEngHours = calculateEngineeringHours(histories);
    const [compTpdBu, compWorkStream] = getMappedFields(issue);

    const usesComputedEngHours = jiraEngHours == null && compEngHours != null;
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
    const baseUrl = ''; // Will be populated from cloud ID in renderer

    // Extract parent epic info (JIRA v3 includes parent in issue response)
    const parentObj = fields.parent as Record<string, unknown> | null;
    const parentKey = parentObj ? (parentObj.key as string) ?? undefined : undefined;
    const parentFields = parentObj ? (parentObj.fields as Record<string, unknown>) ?? {} : {};
    const parentSummary = parentFields.summary as string | undefined;

    // Extract labels
    const rawLabels = fields.labels as string[] | null;
    const labels = rawLabels && rawLabels.length > 0 ? rawLabels : undefined;

    ticketCache.set(key, {
      key,
      summary,
      status,
      assignee,
      eng_hours: jiraEngHours ?? compEngHours,
      tpd_bu: jiraTpdBu ?? compTpdBu,
      work_stream: jiraWorkStream ?? compWorkStream,
      has_computed_values: usesComputedEngHours || usesComputedTpdBu || usesComputedWorkStream,
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
    });
  } catch (e) {
    console.error(`[Tickets] Error processing issue ${(issue as Record<string, unknown>).key}:`, e);
  }
}

/**
 * Re-run process_issue on all cached raw issues (after rule changes).
 */
export function reprocessCache(): void {
  console.log(`[Tickets] Reprocessing ${rawIssueCache.size} cached issues with updated rules...`);
  for (const issue of rawIssueCache.values()) {
    processIssue(issue, false);
  }
  persistCaches();
  console.log('[Tickets] Reprocessing complete.');
}

/**
 * Full sync: fetch all issues from JIRA and rebuild caches.
 */
export async function syncTickets(): Promise<number> {
  const cfg = getConfig();
  console.log(`[Tickets] Starting sync for project: ${cfg.project_key}`);
  try {
    const tf = cfg.ticket_filter;
    let months = tf.months ?? 6;
    // Cap at 12 months; treat legacy "all" mode as 12 months
    if ((tf.mode as string) === 'all' || months == null) {
      months = 12;
    }
    months = Math.min(months, 12);

    const issues = await jira.getIssues(cfg.project_key, months);
    console.log(`[Tickets] Fetched ${issues.length} issues from JIRA.`);

    // Clear caches
    ticketCache.clear();
    rawIssueCache.clear();

    for (const issue of issues) {
      processIssue(issue as Record<string, unknown>);
    }

    persistCaches();
    console.log(`[Tickets] Sync complete. ${ticketCache.size} tickets cached.`);
    return issues.length;
  } catch (e) {
    console.error('[Tickets] Sync failed:', e);
    return 0;
  }
}

/**
 * Sync a single ticket from JIRA.
 */
export async function syncSingleTicket(key: string): Promise<ProcessedTicket | null> {
  const issues = await jira.searchIssues(`key = "${key}"`);
  if (issues.length === 0) throw new Error('Ticket not found in JIRA');
  processIssue(issues[0] as Record<string, unknown>);
  persistCaches();
  return ticketCache.get(key) ?? null;
}

/**
 * Calculate engineering hours for a single ticket from changelog.
 * Returns hours + diagnostics so the UI can explain why calculation failed.
 */
export async function calculateTicketHours(key: string): Promise<{
  hours: number | null;
  diagnostics?: {
    configuredStart: string;
    configuredEnd: string;
    statusTransitions: Array<{ from: string; to: string; created: string }>;
    rawFirstItem?: Record<string, unknown>;
  };
}> {
  const cfg = getConfig();
  const changelog = await jira.getIssueChangelog(key);
  const histories = (changelog.histories ?? []) as Array<{
    created: string;
    items: Array<{ field: string; toString?: string; fromString?: string }>;
  }>;

  // Collect all status transitions for diagnostics
  const statusTransitions: Array<{ from: string; to: string; created: string }> = [];
  let rawFirstItem: Record<string, unknown> | undefined;
  for (const history of histories) {
    for (const item of history.items) {
      if (item.field === 'status') {
        const raw = item as Record<string, unknown>;
        if (!rawFirstItem) {
          rawFirstItem = { ...raw };
          console.log(`[Tickets] Raw changelog item keys for ${key}:`, Object.keys(raw));
          console.log(`[Tickets] Raw changelog item for ${key}:`, JSON.stringify(raw));
        }
        // Use bracket notation to safely read own properties
        // (avoids collision with Object.prototype.toString)
        statusTransitions.push({
          from: String(raw['fromString'] ?? ''),
          to: String(raw['toString'] ?? ''),
          created: history.created,
        });
      }
    }
  }

  const hours = calculateEngineeringHours(histories);

  if (hours === null) {
    console.log(`[Tickets] Hours calc failed for ${key}. Config: start="${cfg.eng_start_status}", end="${cfg.eng_end_status}". Transitions:`, statusTransitions);
  }

  return {
    hours,
    diagnostics: {
      configuredStart: cfg.eng_start_status,
      configuredEnd: cfg.eng_end_status,
      statusTransitions,
      rawFirstItem,
    },
  };
}

/**
 * Calculate mapped fields for a single ticket.
 */
export async function calculateTicketFields(key: string): Promise<{ tpd_bu: string | null; work_stream: string | null }> {
  const issues = await jira.searchIssues(`key = "${key}"`);
  if (issues.length === 0) throw new Error('Ticket not found');
  const [tpdBu, workStream] = getMappedFields(issues[0] as Record<string, unknown>);
  return { tpd_bu: tpdBu, work_stream: workStream };
}

/**
 * Get filtered tickets from cache.
 */
export function getTickets(): ProcessedTicket[] {
  const cfg = getConfig();
  let filtered = Array.from(ticketCache.values()).filter((t) => FINAL_STATUSES.includes(t.status));

  if (cfg.ticket_filter.mode === 'missing_fields') {
    filtered = filtered.filter((t) => !t.tpd_bu || t.eng_hours == null || !t.work_stream);
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
  const cfg = getConfig();

  // Map frontend field names to JIRA custom field IDs
  const jiraPayload: Record<string, unknown> = {};
  if ('tpd_bu' in fields) {
    const fieldId = cfg.field_ids.tpd_bu;
    if (fieldId) {
      jiraPayload[fieldId] = fields.tpd_bu ? [{ value: fields.tpd_bu }] : [];
    }
  }
  if ('eng_hours' in fields) {
    const fieldId = cfg.field_ids.eng_hours;
    if (fieldId) {
      jiraPayload[fieldId] = fields.eng_hours != null ? Number(fields.eng_hours) : null;
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

  const ticket = ticketCache.get(key);
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
 */
export function getAllTickets(): ProcessedTicket[] {
  return Array.from(ticketCache.values());
}

/**
 * Get count of visible tickets (for config save response).
 */
export function getVisibleTicketCount(): number {
  return getTickets().length;
}

/**
 * Get unique assignees from raw issue cache (actual team members).
 */
export function getJiraMembers(): Array<{ accountId: string; displayName: string; avatar?: string; active: boolean }> {
  const members: Array<{ accountId: string; displayName: string; avatar?: string; active: boolean }> = [];
  const seen = new Set<string>();

  for (const issue of rawIssueCache.values()) {
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

  members.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return members;
}
