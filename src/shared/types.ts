/** Shared TypeScript interfaces used by both main and renderer processes. */

export interface Rule {
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'in';
  value: string;
}

/** Rule[][] — inner arrays are AND-blocks, outer array OR's them. */
export type RuleBlocks = Rule[][];

export interface MappingRules {
  tpd_bu: Record<string, RuleBlocks>;
  work_stream: Record<string, RuleBlocks>;
}

export interface FieldIds {
  tpd_bu: string;
  eng_hours: string;
  work_stream: string;
  story_points?: string;
}

export interface OfficeHoursConfig {
  start: string;       // "09:00"
  end: string;         // "18:00"
  timezone: string;    // "Europe/Berlin"
  exclude_weekends: boolean;
}

export interface TicketFilter {
  mode: 'last_x_months' | 'missing_fields';
  months?: number;
}

export interface TrackedEngineer {
  accountId: string;
  displayName: string;
  avatar?: string;
}

export interface AppConfig {
  project_key: string;
  office_hours: OfficeHoursConfig;
  field_ids: FieldIds;
  mapping_rules: MappingRules;
  eng_start_status: string;
  eng_end_status: string;
  eng_excluded_statuses: string[];
  ticket_filter: TicketFilter;
  sp_to_days: number;
  tracked_engineers: TrackedEngineer[];
}

export interface ProcessedTicket {
  key: string;
  summary: string;
  status: string;
  assignee: string;
  eng_hours: number | null;
  tpd_bu: string | null;
  work_stream: string | null;
  has_computed_values: boolean;
  story_points: number | null;
  issue_type: string;
  priority: string;
  created: string | null;
  resolved: string | null;
  base_url: string;
  updated: string | null;
}

export interface MetricsSummary {
  total_tickets: number;
  total_story_points: number;
  total_eng_hours: number;
  estimation_accuracy: number | null;
  avg_eng_hours_per_sp: number | null;
  avg_cycle_time_hours: number | null;
  bug_count: number;
  bug_ratio: number;
  bug_eng_hours_pct: number;
}

export interface BreakdownEntry {
  tickets: number;
  story_points: number;
  eng_hours: number;
}

export interface MonthlyTrendEntry {
  month: string;
  tickets: number;
  story_points: number;
  eng_hours: number;
  bug_count: number;
}

export interface TeamMetricsResponse {
  summary: MetricsSummary | Record<string, never>;
  prev_summary: MetricsSummary | Record<string, never>;
  by_business_unit: Record<string, BreakdownEntry>;
  prev_by_business_unit: Record<string, BreakdownEntry>;
  by_work_stream: Record<string, BreakdownEntry>;
  prev_by_work_stream: Record<string, BreakdownEntry>;
  monthly_trend: MonthlyTrendEntry[];
  issue_type_breakdown: Record<string, BreakdownEntry>;
  prev_issue_type_breakdown: Record<string, BreakdownEntry>;
  period: string;
}

export interface IndividualSummary {
  total_tickets: number;
  total_story_points: number;
  total_eng_hours: number;
  avg_cycle_time_hours: number | null;
  avg_eng_hours_per_sp: number | null;
  estimation_accuracy: number | null;
  bug_ratio: number;
  complexity_score: number | null;
  focus_ratio: number | null;
}

export interface EngineerMetrics {
  accountId: string;
  displayName: string;
  avatar?: string;
  metrics: IndividualSummary;
  prev_metrics: IndividualSummary;
}

export interface IndividualMetricsResponse {
  engineers: EngineerMetrics[];
  team_averages: IndividualSummary;
  prev_team_averages: IndividualSummary;
  period: string;
}

export interface ProjectInfo {
  key: string;
  name: string;
  lead: string | null;
  avatar: string | null;
  error?: string;
}

export interface JiraField {
  id: string;
  name: string;
  type: string;
}

export interface JiraStatus {
  id: string;
  name: string;
}

export interface JiraMember {
  accountId: string;
  displayName: string;
  avatar?: string;
  active: boolean;
}

export interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  email?: string;
  baseUrl?: string;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  releaseNotes: string | null;
  downloadUrl: string | null;
}

// --- AI-Powered Suggestions ---

export type AiProvider = 'openai' | 'claude';

export interface AiConfig {
  provider: AiProvider;
  hasKey: boolean;
}

export interface AiSuggestRequest {
  metricKey: string;
  metricLabel: string;
  currentValue: number | null;
  previousValue: number | null;
  trendDirection: 'up' | 'down' | 'flat' | null;
  trendPct: number | null;
  helpContent: string;
  context: 'team' | 'individual';
  engineerName?: string;
  teamAverageValue?: number | null;
}

export interface AiSuggestResponse {
  suggestions: string[];
  error?: string;
}
