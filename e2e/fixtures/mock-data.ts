/**
 * Canned JIRA REST API v3 response data for e2e tests.
 */

// --- Project ---
export const MOCK_PROJECT = {
  key: 'PROJ',
  name: 'Test Project',
  lead: { displayName: 'Test Lead' },
  avatarUrls: { '48x48': '' },
};

// --- Statuses ---
export const MOCK_STATUSES = [
  { id: '1', name: 'To Do', statusCategory: { key: 'new' } },
  { id: '2', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
  { id: '3', name: 'In Review', statusCategory: { key: 'indeterminate' } },
  { id: '4', name: 'Done', statusCategory: { key: 'done' } },
  { id: '5', name: 'Blocked', statusCategory: { key: 'indeterminate' } },
];

// --- Fields ---
export const MOCK_FIELDS = [
  { id: 'customfield_10001', name: 'TPD BU', schema: { type: 'string' } },
  { id: 'customfield_10002', name: 'Eng Hours', schema: { type: 'number' } },
  { id: 'customfield_10003', name: 'Work Stream', schema: { type: 'string' } },
  { id: 'customfield_10004', name: 'Story Points', schema: { type: 'number' } },
  { id: 'summary', name: 'Summary', schema: { type: 'string' } },
  { id: 'status', name: 'Status', schema: { type: 'status' } },
  { id: 'assignee', name: 'Assignee', schema: { type: 'user' } },
  { id: 'issuetype', name: 'Issue Type', schema: { type: 'issuetype' } },
  { id: 'priority', name: 'Priority', schema: { type: 'priority' } },
];

// --- Members ---
export const MOCK_MEMBERS = [
  { accountId: 'user-1', displayName: 'Alice Engineer', avatarUrls: { '48x48': '' }, active: true },
  { accountId: 'user-2', displayName: 'Bob Developer', avatarUrls: { '48x48': '' }, active: true },
  { accountId: 'user-3', displayName: 'Carol Tester', avatarUrls: { '48x48': '' }, active: true },
];

// --- Changelog helpers ---
function makeChangelog(transitions: Array<{ from: string; to: string; date: string }>) {
  return {
    histories: transitions.map((t, i) => ({
      id: String(1000 + i),
      created: t.date,
      items: [
        {
          field: 'status',
          fieldtype: 'jira',
          fromString: t.from,
          toString: t.to,
        },
      ],
    })),
  };
}

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

// --- Issues (5 tickets, 2 assignees, 1 epic parent) ---
export const MOCK_ISSUES = [
  {
    key: 'PROJ-1',
    fields: {
      summary: 'Implement login page',
      status: { name: 'Done' },
      assignee: { accountId: 'user-1', displayName: 'Alice Engineer' },
      issuetype: { name: 'Story' },
      priority: { name: 'High' },
      created: daysAgo(30),
      resolutiondate: daysAgo(25),
      updated: daysAgo(25),
      customfield_10001: 'B2C',
      customfield_10002: null,
      customfield_10003: 'Product',
      customfield_10004: 3,
      parent: { key: 'PROJ-100' },
      labels: ['frontend'],
    },
    changelog: makeChangelog([
      { from: 'To Do', to: 'In Progress', date: daysAgo(28) },
      { from: 'In Progress', to: 'In Review', date: daysAgo(26) },
      { from: 'In Review', to: 'Done', date: daysAgo(25) },
    ]),
  },
  {
    key: 'PROJ-2',
    fields: {
      summary: 'Fix auth token refresh bug',
      status: { name: 'Done' },
      assignee: { accountId: 'user-2', displayName: 'Bob Developer' },
      issuetype: { name: 'Bug' },
      priority: { name: 'Critical' },
      created: daysAgo(20),
      resolutiondate: daysAgo(18),
      updated: daysAgo(18),
      customfield_10001: 'B2C',
      customfield_10002: null,
      customfield_10003: 'Operational',
      customfield_10004: 2,
      parent: { key: 'PROJ-100' },
      labels: ['auth', 'bug'],
    },
    changelog: makeChangelog([
      { from: 'To Do', to: 'In Progress', date: daysAgo(19) },
      { from: 'In Progress', to: 'In Review', date: daysAgo(18) },
      { from: 'In Review', to: 'Done', date: daysAgo(18) },
    ]),
  },
  {
    key: 'PROJ-3',
    fields: {
      summary: 'Add metrics dashboard',
      status: { name: 'In Progress' },
      assignee: { accountId: 'user-1', displayName: 'Alice Engineer' },
      issuetype: { name: 'Story' },
      priority: { name: 'Medium' },
      created: daysAgo(10),
      resolutiondate: null,
      updated: daysAgo(2),
      customfield_10001: 'B2B',
      customfield_10002: null,
      customfield_10003: 'Product',
      customfield_10004: 5,
      parent: { key: 'PROJ-100' },
      labels: ['frontend', 'metrics'],
    },
    changelog: makeChangelog([
      { from: 'To Do', to: 'In Progress', date: daysAgo(8) },
    ]),
  },
  {
    key: 'PROJ-4',
    fields: {
      summary: 'Database migration script',
      status: { name: 'Done' },
      assignee: { accountId: 'user-2', displayName: 'Bob Developer' },
      issuetype: { name: 'Task' },
      priority: { name: 'Low' },
      created: daysAgo(15),
      resolutiondate: daysAgo(12),
      updated: daysAgo(12),
      customfield_10001: 'B2B',
      customfield_10002: null,
      customfield_10003: 'Tech Debt',
      customfield_10004: 1,
      parent: null,
      labels: ['backend'],
    },
    changelog: makeChangelog([
      { from: 'To Do', to: 'In Progress', date: daysAgo(14) },
      { from: 'In Progress', to: 'In Review', date: daysAgo(13) },
      { from: 'In Review', to: 'Done', date: daysAgo(12) },
    ]),
  },
  {
    key: 'PROJ-5',
    fields: {
      summary: 'Update API documentation',
      status: { name: 'Done' },
      assignee: { accountId: 'user-1', displayName: 'Alice Engineer' },
      issuetype: { name: 'Task' },
      priority: { name: 'Low' },
      created: daysAgo(5),
      resolutiondate: daysAgo(3),
      updated: daysAgo(3),
      customfield_10001: 'B2C',
      customfield_10002: null,
      customfield_10003: 'Operational',
      customfield_10004: 1,
      parent: { key: 'PROJ-100' },
      labels: ['docs'],
    },
    changelog: makeChangelog([
      { from: 'To Do', to: 'In Progress', date: daysAgo(4) },
      { from: 'In Progress', to: 'In Review', date: daysAgo(3) },
      { from: 'In Review', to: 'Done', date: daysAgo(3) },
    ]),
  },
];

/** JQL search response envelope */
export function makeSearchResponse(issues = MOCK_ISSUES) {
  return {
    startAt: 0,
    maxResults: 50,
    total: issues.length,
    issues,
  };
}

/** Single issue response (for /rest/api/3/issue/:key) */
export function findIssue(key: string) {
  return MOCK_ISSUES.find((i) => i.key === key) ?? null;
}
