import Store from 'electron-store';
import type { AppConfig, FieldIds, MappingRules, TicketFilter, TrackedEngineer, Persona, MetricPreferences, ProjectConfig, AgingThresholds } from '../../shared/types.js';

const defaults: AppConfig = {
  project_key: '',
  office_hours: {
    start: '09:00',
    end: '18:00',
    timezone: 'Europe/Berlin',
    exclude_weekends: true,
  },
  field_ids: {
    tpd_bu: '',
    eng_hours: '',
    work_stream: '',
    story_points: '',
  },
  mapping_rules: {
    tpd_bu: {},
    work_stream: {},
  },
  eng_start_status: 'In Progress',
  eng_end_status: 'In Review',
  eng_excluded_statuses: ['Blocked'],
  ticket_filter: { mode: 'last_x_months', months: 6 },
  sp_to_days: 1,
  tracked_engineers: [],
  active_statuses: ['In Progress', 'Code Review', 'QA'],
  blocked_statuses: ['Blocked'],
  done_statuses: ['Done', 'Resolved', 'Closed', 'Rejected', 'Cancelled'],
};

const store = new Store<AppConfig>({
  name: 'config',
  defaults,
});

export function getConfig(): AppConfig {
  return {
    project_key: store.get('project_key'),
    office_hours: store.get('office_hours'),
    field_ids: store.get('field_ids'),
    mapping_rules: store.get('mapping_rules'),
    eng_start_status: store.get('eng_start_status'),
    eng_end_status: store.get('eng_end_status'),
    eng_excluded_statuses: store.get('eng_excluded_statuses'),
    ticket_filter: store.get('ticket_filter'),
    sp_to_days: store.get('sp_to_days'),
    tracked_engineers: store.get('tracked_engineers'),
    persona: store.get('persona') as Persona | undefined,
    metric_preferences: store.get('metric_preferences') as MetricPreferences | undefined,
    projects: store.get('projects') as ProjectConfig[] | undefined,
    active_statuses: store.get('active_statuses') ?? defaults.active_statuses,
    blocked_statuses: store.get('blocked_statuses') ?? defaults.blocked_statuses,
    done_statuses: store.get('done_statuses') ?? defaults.done_statuses,
    wip_limit: store.get('wip_limit') as number | undefined,
    aging_thresholds: store.get('aging_thresholds') as AgingThresholds | undefined,
    my_account_id: store.get('my_account_id') as string | undefined,
    personal_goals: store.get('personal_goals') as Record<string, number> | undefined,
    opt_in_team_comparison: store.get('opt_in_team_comparison') as boolean | undefined,
    seniority_field_id: store.get('seniority_field_id') as string | undefined,
  };
}

export interface ConfigUpdate {
  project_key?: string;
  field_ids?: FieldIds;
  eng_start_status?: string;
  eng_end_status?: string;
  eng_excluded_statuses?: string[];
  ticket_filter?: TicketFilter;
  mapping_rules?: MappingRules;
  sp_to_days?: number;
  tracked_engineers?: TrackedEngineer[];
  persona?: Persona;
  metric_preferences?: MetricPreferences;
  projects?: ProjectConfig[];
  active_statuses?: string[];
  blocked_statuses?: string[];
  done_statuses?: string[];
  wip_limit?: number;
  aging_thresholds?: AgingThresholds;
  my_account_id?: string;
  personal_goals?: Record<string, number>;
  opt_in_team_comparison?: boolean;
  seniority_field_id?: string;
}

export function updateConfig(patch: ConfigUpdate): { projectKeyChanged: boolean; filterChanged: boolean; rulesChanged: boolean } {
  const current = getConfig();

  const projectKeyChanged = !!patch.project_key && patch.project_key !== current.project_key;
  const filterChanged = patch.ticket_filter != null && JSON.stringify(patch.ticket_filter) !== JSON.stringify(current.ticket_filter);
  const rulesChanged = patch.mapping_rules != null && JSON.stringify(patch.mapping_rules) !== JSON.stringify(current.mapping_rules);

  if (patch.project_key) store.set('project_key', patch.project_key);
  if (patch.field_ids) store.set('field_ids', patch.field_ids);
  if (patch.eng_start_status) store.set('eng_start_status', patch.eng_start_status);
  if (patch.eng_end_status) store.set('eng_end_status', patch.eng_end_status);
  if (patch.eng_excluded_statuses != null) store.set('eng_excluded_statuses', patch.eng_excluded_statuses);
  if (patch.ticket_filter != null) store.set('ticket_filter', patch.ticket_filter);
  if (patch.mapping_rules != null) store.set('mapping_rules', patch.mapping_rules);
  if (patch.sp_to_days != null) store.set('sp_to_days', Number(patch.sp_to_days));
  if (patch.tracked_engineers != null) store.set('tracked_engineers', patch.tracked_engineers);
  if (patch.persona != null) store.set('persona', patch.persona);
  if (patch.metric_preferences != null) store.set('metric_preferences', patch.metric_preferences);
  if (patch.projects != null) store.set('projects', patch.projects);
  if (patch.active_statuses != null) store.set('active_statuses', patch.active_statuses);
  if (patch.blocked_statuses != null) store.set('blocked_statuses', patch.blocked_statuses);
  if (patch.done_statuses != null) store.set('done_statuses', patch.done_statuses);
  if (patch.wip_limit != null) store.set('wip_limit', patch.wip_limit);
  if (patch.aging_thresholds != null) store.set('aging_thresholds', patch.aging_thresholds);
  if (patch.my_account_id != null) store.set('my_account_id', patch.my_account_id);
  if (patch.personal_goals != null) store.set('personal_goals', patch.personal_goals);
  if (patch.opt_in_team_comparison != null) store.set('opt_in_team_comparison', patch.opt_in_team_comparison);
  if (patch.seniority_field_id != null) store.set('seniority_field_id', patch.seniority_field_id);

  return { projectKeyChanged, filterChanged, rulesChanged };
}

/**
 * Reset all config to defaults (preserves nothing).
 * Used by "Reset App" to return to onboarding.
 */
export function resetConfig(): void {
  store.clear();
}

/** Expose store instance for ticket cache persistence. */
export { store };
