/** Shared TypeScript interfaces used by both main and renderer processes. */

// --- Persona Types ---
export type Persona = 'engineering_manager' | 'individual' | 'delivery_manager' | 'management';

export interface MetricPreferences {
  visible: string[];
  hidden: string[];
}

// --- Multi-Project Types ---
export interface ProjectConfig {
  project_key: string;
  project_name?: string;
  field_ids: FieldIds;
  ticket_filter?: TicketFilter;
}

// --- Epic Types ---
export interface EpicSummary {
  key: string;
  summary: string;
  totalTickets: number;
  resolvedTickets: number;
  totalSP: number;
  resolvedSP: number;
  progressPct: number;
  avgCycleTime: number | null;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  childTickets: ProcessedTicket[];
}

export interface FieldIds {
  story_points?: string;
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

export interface StatusClassification {
  active_statuses: string[];
  blocked_statuses: string[];
  done_statuses: string[];
}

export interface AgingThresholds {
  warning_days: number;
  critical_days: number;
  escalation_days: number;
}

export interface AppConfig {
  project_key: string;
  field_ids: FieldIds;
  ticket_filter: TicketFilter;
  sp_to_days: number;
  tracked_engineers: TrackedEngineer[];
  persona?: Persona;
  metric_preferences?: MetricPreferences;
  projects?: ProjectConfig[];
  active_statuses: string[];
  blocked_statuses: string[];
  done_statuses: string[];
  wip_limit?: number;
  aging_thresholds?: AgingThresholds;
  my_account_id?: string;
  personal_goals?: Record<string, number>;
  opt_in_team_comparison?: boolean;
  seniority_field_id?: string;
}

export interface ProcessedTicket {
  key: string;
  project_key: string;
  summary: string;
  status: string;
  assignee: string;
  story_points: number | null;
  issue_type: string;
  priority: string;
  created: string | null;
  resolved: string | null;
  base_url: string;
  updated: string | null;
  parent_key?: string;
  parent_summary?: string;
  labels?: string[];
  assignee_id: string | null;
  sprint_id: string | null;
  sprint_name: string | null;
  components: string[];
}

export interface StatusPeriod {
  status: string;
  enteredAt: string;
  exitedAt: string | null;
  durationHours: number;
  category: 'active' | 'wait' | 'blocked' | 'done';
}

export interface TicketTimeline {
  key: string;
  statusPeriods: StatusPeriod[];
  cycleTimeHours: number | null;
  leadTimeHours: number | null;
  activeTimeHours: number;
  waitTimeHours: number;
  blockedTimeHours: number;
  flowEfficiency: number | null;
  hasRework: boolean;
  reworkCount: number;
  currentStatus: string;
  daysInCurrentStatus: number;
}

export interface MetricsSummary {
  total_tickets: number;
  total_story_points: number;
  estimation_accuracy: number | null;
  avg_cycle_time_hours: number | null;
  bug_count: number;
  bug_ratio: number;
}

export interface BreakdownEntry {
  tickets: number;
  story_points: number;
}

export interface MonthlyTrendEntry {
  month: string;
  tickets: number;
  story_points: number;
  bug_count: number;
}

export interface TeamMetricsResponse {
  summary: MetricsSummary | Record<string, never>;
  prev_summary: MetricsSummary | Record<string, never>;
  monthly_trend: MonthlyTrendEntry[];
  issue_type_breakdown: Record<string, BreakdownEntry>;
  prev_issue_type_breakdown: Record<string, BreakdownEntry>;
  period: string;
}

export interface IndividualSummary {
  total_tickets: number;
  total_story_points: number;
  avg_cycle_time_hours: number | null;
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

// --- EM Metrics ---

export interface CycleTimeDistribution {
  p50: number;
  p85: number;
  p95: number;
  trend: Array<{ week: string; p50: number; p85: number }>;
}

export interface WorkStreamThroughput {
  workStream: string;
  count: number;
  storyPoints: number;
}

export interface ContributionEntry {
  accountId: string;
  displayName: string;
  avatar?: string;
  storyPoints: number;
  tickets: number;
  normalizedScore: number;
}

export interface AgingWipEntry {
  key: string;
  summary: string;
  assignee: string;
  status: string;
  daysInStatus: number;
  storyPoints: number | null;
  severity: 'warning' | 'critical' | 'escalation';
}

export interface EngineerBugRatio {
  accountId: string;
  displayName: string;
  bugCount: number;
  totalCount: number;
  bugRatio: number;
}

export interface EmTeamMetricsResponse {
  cycleTime: CycleTimeDistribution;
  weeklyThroughput: Array<{ week: string; count: number; storyPoints: number }>;
  contributionSpread: ContributionEntry[];
  agingWip: AgingWipEntry[];
  bugRatioByEngineer: EngineerBugRatio[];
  reworkRate: number;
  spAccuracy: number | null;
  firstTimePassRate: number;
  avgReviewDurationHours: number | null;
  workTypeDistribution: Array<{ type: string; count: number; percentage: number }>;
  unestimatedRatio: number;
  leadTimeBreakdown: { activePercent: number; waitPercent: number; blockedPercent: number } | null;
  totalTickets: number;
  totalStoryPoints: number;
  period: string;
  traces?: Record<string, string>;
}

export interface EmEngineerDetail {
  accountId: string;
  displayName: string;
  avatar?: string;
  cycleTimeP50: number | null;
  cycleTimeP85: number | null;
  reworkRate: number;
  bugRatio: number;
  tickets: number;
  storyPoints: number;
  complexityScore: number | null;
  focusRatio: number | null;
  spAccuracy: number | null;
  firstTimePassRate: number;
}

export interface EmIndividualMetricsResponse {
  engineers: EmEngineerDetail[];
  teamAverages: {
    cycleTimeP50: number | null;
    reworkRate: number;
    bugRatio: number;
    tickets: number;
    storyPoints: number;
    spAccuracy: number | null;
    firstTimePassRate: number;
  };
  period: string;
  traces?: Record<string, string>;
}

// --- DM Metrics ---

export interface CfdDataPoint {
  date: string;
  [status: string]: number | string;  // status name -> count
}

export interface LeadTimeHistogramBucket {
  range: string;       // e.g. "0-1d", "1-3d", "3-7d"
  count: number;
}

export interface WipStatus {
  count: number;
  limit: number | null;
  overLimit: boolean;
  byStatus: Array<{ status: string; count: number }>;
}

export interface TieredAgingEntry {
  key: string;
  summary: string;
  assignee: string;
  status: string;
  daysInStatus: number;
  storyPoints: number | null;
  tier: 'warning' | 'critical' | 'escalation';
}

export interface BlockerEntry {
  key: string;
  summary: string;
  assignee: string;
  blockedHours: number;
  currentStatus: string;
}

export interface MonteCarloResult {
  targetItems: number;
  confidenceLevels: Array<{ percentile: number; weeks: number }>;
}

export interface DmFlowMetricsResponse {
  cfd: CfdDataPoint[];
  leadTimeDistribution: { p50: number; p85: number; p95: number };
  leadTimeHistogram: LeadTimeHistogramBucket[];
  wip: WipStatus;
  agingWipTiered: TieredAgingEntry[];
  blockers: BlockerEntry[];
  flowEfficiency: { average: number; median: number };
  throughputStability: number;      // 0-1, higher is more stable
  weeklyThroughput: Array<{ week: string; count: number; storyPoints: number }>;
  monteCarlo: MonteCarloResult;
  arrivalVsDeparture: Array<{ week: string; arrived: number; departed: number }>;
  batchSizeTrend: Array<{ week: string; avgSp: number }>;
  timeToFirstActivityHours: number | null;
  leadTimeBreakdown: { activePercent: number; waitPercent: number; blockedPercent: number } | null;
  totalTickets: number;
  totalStoryPoints: number;
  period: string;
  traces?: Record<string, string>;
  error?: string;
}

// --- IC Metrics ---

export interface IcWeeklyTrend {
  week: string;
  value: number;
}

export interface IcTimeInStatus {
  status: string;
  hours: number;
  percentage: number;
}

export interface IcAgingItem {
  key: string;
  summary: string;
  status: string;
  daysInStatus: number;
  storyPoints: number | null;
}

export interface IcTeamComparison {
  metric: string;
  myValue: number;
  teamMedian: number;
}

export interface IcPersonalMetricsResponse {
  cycleTimeTrend: IcWeeklyTrend[];
  cycleTimeP50: number | null;
  throughput: IcWeeklyTrend[];
  agingWip: IcAgingItem[];
  timeInStatus: IcTimeInStatus[];
  reworkRate: number;
  reworkTrend: IcWeeklyTrend[];
  scopeTrajectory: Array<{ month: string; avgSp: number }>;
  spAccuracy: number | null;
  firstTimePassRate: number;
  avgReviewWaitHours: number | null;
  focusScore: number | null;
  totalTickets: number;
  totalStoryPoints: number;
  teamComparison: IcTeamComparison[] | null;  // null if not opted in
  goalProgress: Array<{ metric: string; current: number; target: number }> | null;
  period: string;
  traces?: Record<string, string>;
  error?: string;
}

// --- Management Metrics ---

export interface ProjectThroughputTrend {
  projectKey: string;
  projectName: string;
  weeks: Array<{ week: string; count: number; storyPoints: number }>;
}

export interface ProjectCycleTime {
  projectKey: string;
  projectName: string;
  p50: number;
  p85: number;
  p95: number;
}

export interface CtoOrgMetricsResponse {
  throughputByProject: ProjectThroughputTrend[];
  cycleTimeByProject: ProjectCycleTime[];
  bugEscapeRate: number;
  techDebtRatio: number;
  flowEfficiency: { average: number; median: number };
  headcountNormalizedThroughput: number | null;
  weeklyThroughput: Array<{ week: string; count: number; storyPoints: number }>;
  deliveryPredictability: Array<{ projectKey: string; projectName: string; coefficientOfVariation: number }>;
  workTypeByProject: Array<{ projectKey: string; projectName: string; types: Array<{ type: string; count: number }> }>;
  totalTickets: number;
  totalStoryPoints: number;
  totalProjects: number;
  period: string;
  traces?: Record<string, string>;
  error?: string;
}
