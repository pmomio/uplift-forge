import { getAccessToken, getCloudId } from '../auth/token-store.js';
import type { JiraField, JiraStatus, JiraMember, ProjectInfo } from '../../shared/types.js';

/**
 * Port of backend/jira_client.py — JIRA REST API v3 with OAuth Bearer tokens.
 *
 * Uses Atlassian Cloud REST API via:
 *   https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...
 */

async function jiraFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const cloudId = getCloudId();
  if (!token || !cloudId) {
    throw new Error('Not authenticated — no access token or cloudId');
  }

  const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Try refreshing token and retry once
    const newToken = await getAccessToken(true);
    if (!newToken) throw new Error('Authentication expired — please log in again');

    const retryResponse = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${newToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!retryResponse.ok) {
      throw new Error(`JIRA API error ${retryResponse.status}: ${await retryResponse.text()}`);
    }
    return retryResponse;
  }

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
    jql += ` AND resolved >= "${dateStr}"`;
  }

  jql += ' ORDER BY updated DESC';
  console.log('[JIRA] JQL:', jql);

  const allIssues: unknown[] = [];
  let nextToken: string | undefined;
  const batchSize = 100;

  while (true) {
    const params = new URLSearchParams({
      jql,
      expand: 'changelog',
      maxResults: String(batchSize),
    });
    if (nextToken) params.set('nextPageToken', nextToken);

    const response = await jiraFetch(`/search?${params.toString()}`);
    const result = await response.json() as {
      issues?: unknown[];
      isLast?: boolean;
      nextPageToken?: string;
    };

    const issues = result.issues ?? [];
    allIssues.push(...issues);
    console.log(`[JIRA] Fetched batch: ${issues.length} issues (total: ${allIssues.length})`);

    if (result.isLast !== false || issues.length === 0) break;
    nextToken = result.nextPageToken;
    if (!nextToken) break;
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
  const params = new URLSearchParams({ jql, expand: 'changelog', maxResults: '10' });
  const response = await jiraFetch(`/search?${params.toString()}`);
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
