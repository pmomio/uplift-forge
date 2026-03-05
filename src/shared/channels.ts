/** IPC channel name constants shared between main and renderer processes. */

export const Channels = {
  // Auth
  AUTH_LOGIN: 'auth:login',
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
  JIRA_FIELD_OPTIONS: 'jira:field-options',

  // Tickets
  TICKETS_LIST: 'tickets:list',
  TICKETS_UPDATE: 'tickets:update',
  TICKETS_SYNC_ONE: 'tickets:sync-one',
  TICKETS_CALC_HOURS: 'tickets:calc-hours',
  TICKETS_CALC_FIELDS: 'tickets:calc-fields',

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
} as const;

export type Channel = (typeof Channels)[keyof typeof Channels];
