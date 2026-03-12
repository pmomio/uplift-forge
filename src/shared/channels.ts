/** IPC channel name constants shared between main and renderer processes. */

export const Channels = {
  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_DEMO: 'auth:demo',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_STATE: 'auth:state',
  AUTH_STATE_CHANGED: 'auth:state-changed',
  AUTH_RESET: 'auth:reset',

  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SAVE: 'config:save',

  // JIRA metadata
  JIRA_PROJECT: 'jira:project',
  JIRA_FIELDS: 'jira:fields',
  JIRA_STATUSES: 'jira:statuses',
  JIRA_MEMBERS: 'jira:members',

  // Tickets
  TICKETS_LIST: 'tickets:list',
  TICKETS_UPDATE: 'tickets:update',
  TICKETS_SYNC_ONE: 'tickets:sync-one',

  // Sync
  SYNC_FULL: 'sync:full',
  SYNC_PROGRESS: 'sync:progress',

  // Metrics
  METRICS_TEAM: 'metrics:team',
  METRICS_INDIVIDUAL: 'metrics:individual',

  // Shell
  OPEN_EXTERNAL: 'shell:open-external',

  // Update
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_STATUS: 'update:status',

  // AI Suggestions
  AI_SUGGEST: 'ai:suggest',
  AI_CONFIG_GET: 'ai:config-get',
  AI_CONFIG_SET: 'ai:config-set',
  AI_CONFIG_DELETE: 'ai:config-delete',
  AI_CONFIG_TEST: 'ai:config-test',

  // Multi-Project
  SYNC_ALL_PROJECTS: 'sync:all-projects',
  PROJECT_LIST: 'project:list',
  PROJECT_ADD: 'project:add',
  PROJECT_UPDATE: 'project:update',
  PROJECT_REMOVE: 'project:remove',
  PROJECT_SYNC: 'project:sync',
  METRICS_CROSS_PROJECT: 'metrics:cross-project',

  // Epics
  EPICS_LIST: 'epics:list',
  EPIC_DETAIL: 'epics:detail',
  EPICS_SYNC: 'epics:sync',

  // Timeline
  TIMELINE_LIST: 'timeline:list',

  // Persona-specific metrics
  METRICS_EM_TEAM: 'metrics:em-team',
  METRICS_EM_INDIVIDUAL: 'metrics:em-individual',
  METRICS_DM_FLOW: 'metrics:dm-flow',
  METRICS_DM_FORECAST: 'metrics:dm-forecast',
  METRICS_IC_PERSONAL: 'metrics:ic-personal',
  METRICS_CTO_ORG: 'metrics:cto-org',
} as const;

export type Channel = (typeof Channels)[keyof typeof Channels];
