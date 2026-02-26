import Store from 'electron-store';
import type { AppConfig, FieldIds, MappingRules, TicketFilter, TrackedEngineer } from '../../shared/types.js';

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

  return { projectKeyChanged, filterChanged, rulesChanged };
}

/** Expose store instance for ticket cache persistence. */
export { store };
