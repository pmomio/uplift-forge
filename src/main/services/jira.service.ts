import { getAuthHeader, getBaseUrl } from '../auth/token-store.js';
import type { JiraField, JiraFieldOption, JiraStatus, JiraMember, ProjectInfo } from '../../shared/types.js';

/**
 * JIRA REST API v3 with Basic auth (email + API token).
 *
 * Uses the user-provided base URL:
 *   {baseUrl}/rest/api/3/...
 */

async function jiraFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const authHeader = getAuthHeader();
  const baseUrl = getBaseUrl();
  if (!authHeader || !baseUrl) {
    throw new Error('Not authenticated — no credentials configured');
  }

  const url = `${baseUrl}/rest/api/3${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`JIRA API error ${response.status}: ${await response.text()}`);
  }
  return response;
}

/**
 * Fetch issues using JQL with pagination (nextPageToken/isLast).
 */
export async function getIssues(projectKey: string, months?: number): Promise<unknown[]> {
  let jql = `project = "${projectKey}"`;

  if (months) {
    const now = new Date();
    let m = now.getMonth() + 1 - months; // 1-indexed
    let y = now.getFullYear();
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    // Clamp day to valid range for target month
    const maxDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of m
    const d = Math.min(now.getDate(), maxDay);
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    jql += ` AND (resolved >= "${dateStr}" OR resolution = EMPTY)`;
  }

  jql += ' ORDER BY updated DESC';
  console.log('[JIRA] JQL:', jql);

  const allIssues: unknown[] = [];
  let nextToken: string | undefined;
  const batchSize = 100;

  while (true) {
    const params = new URLSearchParams({
      jql,
      fields: '*all',
      expand: 'changelog',
      maxResults: String(batchSize),
    });
    if (nextToken) params.set('nextPageToken', nextToken);

    const response = await jiraFetch(`/search/jql?${params.toString()}`);
    const result = await response.json() as {
      issues?: unknown[];
      nextPageToken?: string;
    };

    const issues = result.issues ?? [];
    allIssues.push(...issues);
    console.log(`[JIRA] Fetched batch: ${issues.length} issues (total: ${allIssues.length})`);

    if (issues.length === 0 || !result.nextPageToken) break;
    nextToken = result.nextPageToken;
  }

  return allIssues;
}

/**
 * Update fields on a JIRA issue.
 */
export async function updateIssueFields(issueKey: string, fields: Record<string, unknown>): Promise<void> {
  await jiraFetch(`/issue/${issueKey}`, {
    method: 'PUT',
    body: JSON.stringify({ fields }),
  });
}

/**
 * Fetch a single issue with changelog.
 */
export async function getIssueChangelog(issueKey: string): Promise<{ histories: unknown[] }> {
  const response = await jiraFetch(`/issue/${issueKey}?expand=changelog`);
  const issue = await response.json() as Record<string, unknown>;
  const changelog = (issue.changelog ?? { histories: [] }) as { histories: unknown[] };
  return changelog;
}

/**
 * Fetch a single issue with changelog (full issue object).
 */
export async function getIssueWithChangelog(issueKey: string): Promise<Record<string, unknown>> {
  const response = await jiraFetch(`/issue/${issueKey}?expand=changelog`);
  return response.json() as Promise<Record<string, unknown>>;
}

/**
 * Search issues by JQL (without changelog, for single-ticket lookups).
 */
export async function searchIssues(jql: string): Promise<unknown[]> {
  const params = new URLSearchParams({ jql, fields: '*all', expand: 'changelog', maxResults: '10' });
  const response = await jiraFetch(`/search/jql?${params.toString()}`);
  const result = await response.json() as { issues?: unknown[] };
  return result.issues ?? [];
}

/**
 * Get all custom fields.
 */
export async function getAllFields(): Promise<JiraField[]> {
  const response = await jiraFetch('/field');
  const fields = await response.json() as Array<{
    id: string;
    name: string;
    schema?: { type?: string };
  }>;
  return fields.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.schema?.type ?? 'unknown',
  }));
}

/**
 * Get all workflow statuses.
 */
export async function getAllStatuses(): Promise<JiraStatus[]> {
  const response = await jiraFetch('/status');
  const statuses = await response.json() as Array<{ id: string; name: string }>;
  const seen = new Set<string>();
  const result: JiraStatus[] = [];
  for (const status of statuses) {
    if (status.name && !seen.has(status.name)) {
      seen.add(status.name);
      result.push({ id: status.id, name: status.name });
    }
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

/**
 * Fetch allowed values (options) for a custom select/multi-select field.
 * Uses the JIRA REST API v3 custom field context + options endpoints.
 * Returns a deduplicated array of { id, value } objects.
 */
export async function getFieldOptions(fieldId: string): Promise<JiraFieldOption[]> {
  try {
    // Step 1: Get contexts for the field
    const ctxResponse = await jiraFetch(`/field/${fieldId}/context`);
    const ctxResult = await ctxResponse.json() as {
      values?: Array<{ id: string }>;
    };

    const contexts = ctxResult.values ?? [];
    if (contexts.length === 0) return [];

    // Step 2: For each context, fetch options (with pagination)
    const seen = new Set<string>();
    const options: JiraFieldOption[] = [];

    for (const ctx of contexts) {
      let startAt = 0;
      const maxResults = 1000;

      while (true) {
        const params = new URLSearchParams({
          startAt: String(startAt),
          maxResults: String(maxResults),
        });
        const optResponse = await jiraFetch(`/field/${fieldId}/context/${ctx.id}/option?${params.toString()}`);
        const optResult = await optResponse.json() as {
          values?: Array<{ id: string; value: string; disabled?: boolean }>;
          isLast?: boolean;
          total?: number;
        };

        const values = optResult.values ?? [];
        for (const opt of values) {
          if (!opt.disabled && opt.value && !seen.has(opt.value)) {
            seen.add(opt.value);
            options.push({ id: opt.id, value: opt.value });
          }
        }

        if (values.length === 0 || optResult.isLast !== false) break;
        startAt += values.length;
      }
    }

    options.sort((a, b) => a.value.localeCompare(b.value));
    return options;
  } catch (e) {
    console.warn(`[JIRA] Failed to fetch field options for ${fieldId}:`, e);
    return [];
  }
}

/**
 * Fetch project details (name, lead, avatar).
 */
export async function getProject(projectKey: string): Promise<ProjectInfo> {
  try {
    const response = await jiraFetch(`/project/${projectKey}`);
    const project = await response.json() as {
      key?: string;
      name?: string;
      lead?: { displayName?: string };
      avatarUrls?: Record<string, string>;
    };
    return {
      key: project.key ?? projectKey,
      name: project.name ?? projectKey,
      lead: project.lead?.displayName ?? null,
      avatar: project.avatarUrls?.['48x48'] ?? null,
    };
  } catch (e) {
    return { key: projectKey, name: projectKey, lead: null, avatar: null, error: String(e) };
  }
}
