import { processIssue, persistCaches, clearAllCaches } from './ticket.service.js';
import { updateConfig, resetConfig } from './config.service.js';
import { saveCredentials, clearCredentials, emitAuthStateChanged } from '../auth/token-store.js';
import { invalidateTimelineCache } from './timeline.service.js';
import { deleteAiConfig } from '../auth/ai-key-store.js';

const DEMO_PROJECTS = ['APP', 'WEB'];
const ENGINEERS = [
  { accountId: 'e1', displayName: 'Alice Chen' },
  { accountId: 'e2', displayName: 'Bob Smith' },
  { accountId: 'e3', displayName: 'Charlie Davis' },
  { accountId: 'e4', displayName: 'Diana Prince' },
  { accountId: 'e5', displayName: 'Ethan Hunt' },
];

const ISSUE_TYPES = ['Story', 'Task', 'Bug'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const COMPONENTS = ['Frontend', 'Backend', 'Database', 'API', 'UI'];
const LABELS = ['B2C', 'B2B', 'TechDebt', 'Hotfix', 'Q3_Goal'];

// Simulate time passing
function randomDateBetween(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function generateHistory(createdDate: Date, isDone: boolean, hasRework: boolean, hasBlocker: boolean) {
  const histories = [];
  let currentDate = createdDate;

  // Transition to In Progress
  currentDate = addHours(currentDate, Math.random() * 24 + 2); // 2-26 hours to pick up
  histories.push({
    created: currentDate.toISOString(),
    items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress' }],
  });

  if (hasBlocker) {
    currentDate = addHours(currentDate, Math.random() * 48 + 12);
    histories.push({
      created: currentDate.toISOString(),
      items: [{ field: 'status', fromString: 'In Progress', toString: 'Blocked' }],
    });
    currentDate = addHours(currentDate, Math.random() * 72 + 24);
    histories.push({
      created: currentDate.toISOString(),
      items: [{ field: 'status', fromString: 'Blocked', toString: 'In Progress' }],
    });
  }

  // Code Review
  currentDate = addHours(currentDate, Math.random() * 72 + 10); // Dev time
  histories.push({
    created: currentDate.toISOString(),
    items: [{ field: 'status', fromString: 'In Progress', toString: 'Code Review' }],
  });

  if (hasRework) {
    currentDate = addHours(currentDate, Math.random() * 12 + 2);
    histories.push({
      created: currentDate.toISOString(),
      items: [{ field: 'status', fromString: 'Code Review', toString: 'In Progress' }],
    });
    // Back to CR
    currentDate = addHours(currentDate, Math.random() * 24 + 10);
    histories.push({
      created: currentDate.toISOString(),
      items: [{ field: 'status', fromString: 'In Progress', toString: 'Code Review' }],
    });
  }

  // QA
  currentDate = addHours(currentDate, Math.random() * 24 + 2);
  histories.push({
    created: currentDate.toISOString(),
    items: [{ field: 'status', fromString: 'Code Review', toString: 'QA' }],
  });

  if (isDone) {
    currentDate = addHours(currentDate, Math.random() * 48 + 4);
    histories.push({
      created: currentDate.toISOString(),
      items: [{ field: 'status', fromString: 'QA', toString: 'Done' }],
    });
  }

  return { histories, lastDate: currentDate };
}

export async function setupDemoMode() {
  console.log('[Demo] Initializing demo mode...');
  
  // 1. Wipe existing state (full reset)
  clearCredentials();
  resetConfig();
  clearAllCaches();
  invalidateTimelineCache();
  deleteAiConfig();
  
  // 2. Set mock credentials
  saveCredentials('https://demo.atlassian.net', 'demo@example.com', 'demo-token');
  emitAuthStateChanged();

  // 3. Configure App settings
  updateConfig({
    project_key: 'APP',
    projects: [
      { project_key: 'APP', project_name: 'Mobile App', field_ids: { story_points: 'customfield_sp' } },
      { project_key: 'WEB', project_name: 'Web Platform', field_ids: { story_points: 'customfield_sp' } },
    ],
    field_ids: { story_points: 'customfield_sp' },
    active_statuses: ['In Progress', 'Code Review', 'QA'],
    blocked_statuses: ['Blocked'],
    done_statuses: ['Done', 'Resolved', 'Closed'],
    tracked_engineers: ENGINEERS,
    sp_to_days: 1,
    my_account_id: 'e1',
  });

  // 4. Generate 200 tickets
  let ticketId = 1;
  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Generate Epics
  const epics = [];
  for (const proj of DEMO_PROJECTS) {
    for (let i = 1; i <= 5; i++) {
      epics.push({
        key: `${proj}-E${i}`,
        summary: `Strategic Epic ${i} for ${proj}`,
        proj
      });
    }
  }

  for (let i = 0; i < 200; i++) {
    const proj = Math.random() > 0.4 ? 'APP' : 'WEB';
    const epic = epics.filter(e => e.proj === proj)[Math.floor(Math.random() * 5)];
    const assignee = ENGINEERS[Math.floor(Math.random() * ENGINEERS.length)];
    const issueType = ISSUE_TYPES[Math.floor(Math.random() * ISSUE_TYPES.length)];
    const priority = PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)];
    const component = COMPONENTS[Math.floor(Math.random() * COMPONENTS.length)];
    const label = LABELS[Math.floor(Math.random() * LABELS.length)];
    
    // 85% done, 15% open/active
    const isDone = Math.random() > 0.15;
    const hasRework = Math.random() > 0.8;
    const hasBlocker = Math.random() > 0.85;

    const createdDate = randomDateBetween(threeMonthsAgo, new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
    
    const { histories, lastDate } = generateHistory(createdDate, isDone, hasRework, hasBlocker);

    const issue = {
      key: `${proj}-${ticketId++}`,
      fields: {
        summary: `Implement ${component} feature ${ticketId} [Demo]`,
        status: { name: isDone ? 'Done' : (histories.length > 0 ? histories[histories.length - 1].items[0].toString : 'To Do') },
        assignee: { displayName: assignee.displayName, accountId: assignee.accountId },
        issuetype: { name: issueType },
        priority: { name: priority },
        created: createdDate.toISOString(),
        resolutiondate: isDone ? lastDate.toISOString() : null,
        updated: lastDate.toISOString(),
        customfield_sp: Math.floor(Math.random() * 8) + 1,
        parent: { key: epic.key, fields: { summary: epic.summary } },
        components: [{ name: component }],
        labels: [label],
      },
      changelog: { histories },
    };

    processIssue(issue, true, proj);
  }

  persistCaches();
  console.log('[Demo] Generated 200+ tickets and populated cache.');
}
