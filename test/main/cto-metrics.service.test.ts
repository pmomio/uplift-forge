import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron-store
vi.mock('electron-store', () => ({
  default: class MockStore {
    constructor() {}
    get(key: string) {
      const defaults: Record<string, unknown> = {
        active_statuses: ['In Progress', 'Code Review'],
        blocked_statuses: ['Blocked'],
        done_statuses: ['Done', 'Resolved'],
        project_key: 'ALPHA',
        eng_start_status: 'In Progress',
        eng_end_status: 'In Review',
        eng_excluded_statuses: ['Blocked'],
        office_hours: { start: '09:00', end: '18:00', timezone: 'Europe/Berlin', exclude_weekends: true },
        mapping_rules: { tpd_bu: {}, work_stream: {} },
        field_ids: { tpd_bu: '', eng_hours: '', work_stream: '', story_points: '' },
        ticket_filter: { mode: 'last_x_months', months: 6 },
        sp_to_days: 1,
        tracked_engineers: [
          { accountId: 'a1', displayName: 'Alice' },
          { accountId: 'a2', displayName: 'Bob' },
        ],
        persona: 'management',
        projects: [{ project_key: 'BETA', project_name: 'Beta Project' }],
      };
      return defaults[key];
    }
    set() {}
  },
}));

// Mock tickets — two projects
const alphaTickets = [
  {
    key: 'ALPHA-1', project_key: 'ALPHA', summary: 'Feature A', status: 'Done',
    assignee: 'Alice', assignee_id: 'a1', eng_hours: 8, tpd_bu: null,
    work_stream: 'Product', has_computed_values: false, story_points: 3,
    issue_type: 'Story', priority: 'Medium', created: '2025-01-01T09:00:00Z',
    resolved: '2025-01-03T17:00:00Z', base_url: '', updated: '2025-01-03T17:00:00Z',
    sprint_id: null, sprint_name: null, components: [], labels: [],
  },
  {
    key: 'ALPHA-2', project_key: 'ALPHA', summary: 'Bug A', status: 'Done',
    assignee: 'Bob', assignee_id: 'a2', eng_hours: 4, tpd_bu: null,
    work_stream: 'Maintenance', has_computed_values: false, story_points: 1,
    issue_type: 'Bug', priority: 'High', created: '2025-01-02T09:00:00Z',
    resolved: '2025-01-04T17:00:00Z', base_url: '', updated: '2025-01-04T17:00:00Z',
    sprint_id: null, sprint_name: null, components: [], labels: [],
  },
];

const betaTickets = [
  {
    key: 'BETA-1', project_key: 'BETA', summary: 'Feature B', status: 'Done',
    assignee: 'Charlie', assignee_id: 'a3', eng_hours: 10, tpd_bu: null,
    work_stream: 'Product', has_computed_values: false, story_points: 5,
    issue_type: 'Task', priority: 'Medium', created: '2025-01-01T09:00:00Z',
    resolved: '2025-01-05T17:00:00Z', base_url: '', updated: '2025-01-05T17:00:00Z',
    sprint_id: null, sprint_name: null, components: [], labels: ['tech-debt'],
  },
];

vi.mock('../../src/main/services/ticket.service.js', () => ({
  getAllTickets: vi.fn((projectKey?: string) => {
    if (projectKey === 'ALPHA') return alphaTickets;
    if (projectKey === 'BETA') return betaTickets;
    return [...alphaTickets, ...betaTickets];
  }),
  getRawIssues: vi.fn(() => new Map()),
}));

// Mock timeline service
const alphaTimelines = [
  {
    key: 'ALPHA-1',
    statusPeriods: [
      { status: 'In Progress', enteredAt: '2025-01-02T09:00:00Z', exitedAt: '2025-01-03T09:00:00Z', durationHours: 24, category: 'active' },
      { status: 'Done', enteredAt: '2025-01-03T09:00:00Z', exitedAt: null, durationHours: 8, category: 'done' },
    ],
    cycleTimeHours: 24, leadTimeHours: 48, activeTimeHours: 24, waitTimeHours: 24,
    blockedTimeHours: 0, flowEfficiency: 50, hasRework: false, reworkCount: 0,
    currentStatus: 'Done', daysInCurrentStatus: 0,
  },
  {
    key: 'ALPHA-2',
    statusPeriods: [
      { status: 'In Progress', enteredAt: '2025-01-03T09:00:00Z', exitedAt: '2025-01-04T09:00:00Z', durationHours: 24, category: 'active' },
      { status: 'Done', enteredAt: '2025-01-04T09:00:00Z', exitedAt: null, durationHours: 8, category: 'done' },
    ],
    cycleTimeHours: 24, leadTimeHours: 48, activeTimeHours: 24, waitTimeHours: 24,
    blockedTimeHours: 0, flowEfficiency: 50, hasRework: false, reworkCount: 0,
    currentStatus: 'Done', daysInCurrentStatus: 0,
  },
];

const betaTimelines = [
  {
    key: 'BETA-1',
    statusPeriods: [
      { status: 'In Progress', enteredAt: '2025-01-01T09:00:00Z', exitedAt: '2025-01-04T09:00:00Z', durationHours: 72, category: 'active' },
      { status: 'Done', enteredAt: '2025-01-04T09:00:00Z', exitedAt: null, durationHours: 8, category: 'done' },
    ],
    cycleTimeHours: 72, leadTimeHours: 96, activeTimeHours: 72, waitTimeHours: 24,
    blockedTimeHours: 0, flowEfficiency: 75, hasRework: false, reworkCount: 0,
    currentStatus: 'Done', daysInCurrentStatus: 0,
  },
];

vi.mock('../../src/main/services/timeline.service.js', () => ({
  getTimelines: vi.fn((projectKey?: string) => {
    if (projectKey === 'ALPHA') return alphaTimelines;
    if (projectKey === 'BETA') return betaTimelines;
    return [...alphaTimelines, ...betaTimelines];
  }),
  computePercentiles: vi.fn((values: number[], percentiles: number[] = [50, 85, 95]) => {
    if (values.length === 0) {
      const result: Record<string, number> = {};
      for (const p of percentiles) result[`p${p}`] = 0;
      return result;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const result: Record<string, number> = {};
    for (const p of percentiles) {
      const index = (p / 100) * (sorted.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      result[`p${p}`] = lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
    }
    return result;
  }),
  computeWeeklyThroughput: vi.fn(() => [
    { week: '1/1', count: 2, storyPoints: 4 },
    { week: '1/8', count: 1, storyPoints: 5 },
  ]),
  invalidateTimelineCache: vi.fn(),
}));

// Mock project service
vi.mock('../../src/main/services/project.service.js', () => ({
  listProjects: vi.fn(() => [
    {
      project_key: 'ALPHA', project_name: 'Alpha Project',
      field_ids: { tpd_bu: '', eng_hours: '', work_stream: '', story_points: '' },
      mapping_rules: { tpd_bu: {}, work_stream: {} },
      eng_start_status: 'In Progress', eng_end_status: 'In Review',
    },
    {
      project_key: 'BETA', project_name: 'Beta Project',
      field_ids: { tpd_bu: '', eng_hours: '', work_stream: '', story_points: '' },
      mapping_rules: { tpd_bu: {}, work_stream: {} },
      eng_start_status: 'In Progress', eng_end_status: 'In Review',
    },
  ]),
}));

import { getCtoOrgMetrics } from '../../src/main/services/cto-metrics.service.js';

describe('cto-metrics.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns metrics for all configured projects', () => {
    const result = getCtoOrgMetrics('all');
    expect(result.totalProjects).toBe(2);
  });

  it('returns throughput by project', () => {
    const result = getCtoOrgMetrics('all');
    expect(result.throughputByProject).toHaveLength(2);
    expect(result.throughputByProject.map(p => p.projectKey)).toContain('ALPHA');
    expect(result.throughputByProject.map(p => p.projectKey)).toContain('BETA');
  });

  it('returns cycle time by project', () => {
    const result = getCtoOrgMetrics('all');
    expect(result.cycleTimeByProject).toHaveLength(2);
    const alpha = result.cycleTimeByProject.find(p => p.projectKey === 'ALPHA');
    expect(alpha).toBeDefined();
    expect(alpha!.p85).toBeGreaterThanOrEqual(0);
  });

  it('computes bug escape rate', () => {
    const result = getCtoOrgMetrics('all');
    // 1 bug (ALPHA-2) out of 2 non-bugs (ALPHA-1 story + BETA-1 task) = 0.5
    expect(result.bugEscapeRate).toBe(0.5);
  });

  it('computes tech debt ratio', () => {
    const result = getCtoOrgMetrics('all');
    // ALPHA-2 (bug) + BETA-1 (tech-debt label) = 2 out of 3 = ~0.667
    expect(result.techDebtRatio).toBeCloseTo(2 / 3, 2);
  });

  it('computes flow efficiency', () => {
    const result = getCtoOrgMetrics('all');
    // ALPHA-1: 50%, ALPHA-2: 50%, BETA-1: 75% => avg = 58.33%
    expect(result.flowEfficiency.average).toBeCloseTo((50 + 50 + 75) / 3, 1);
  });

  it('computes headcount-normalized throughput', () => {
    const result = getCtoOrgMetrics('all');
    // 3 tickets / 2 tracked engineers = 1.5
    expect(result.headcountNormalizedThroughput).toBe(1.5);
  });

  it('returns aggregate weekly throughput', () => {
    const result = getCtoOrgMetrics('all');
    expect(result.weeklyThroughput).toHaveLength(2);
  });

  it('returns total tickets and story points', () => {
    const result = getCtoOrgMetrics('all');
    expect(result.totalTickets).toBe(3);
    expect(result.totalStoryPoints).toBe(9); // 3 + 1 + 5
  });

  it('returns period in response', () => {
    const result = getCtoOrgMetrics('monthly');
    expect(result.period).toBe('monthly');
  });

  it('returns delivery predictability per project', () => {
    const result = getCtoOrgMetrics('all');
    expect(result.deliveryPredictability).toBeDefined();
    expect(Array.isArray(result.deliveryPredictability)).toBe(true);
    // ALPHA has 2 cycle times (24, 24) — CoV = 0 (identical values)
    const alpha = result.deliveryPredictability.find(p => p.projectKey === 'ALPHA');
    if (alpha) {
      expect(alpha.coefficientOfVariation).toBeGreaterThanOrEqual(0);
    }
    // BETA has only 1 cycle time — needs >=2 for CoV, so may not appear
  });

  it('returns work type distribution per project', () => {
    const result = getCtoOrgMetrics('all');
    expect(result.workTypeByProject).toBeDefined();
    expect(result.workTypeByProject).toHaveLength(2);
    const alpha = result.workTypeByProject.find(p => p.projectKey === 'ALPHA');
    expect(alpha).toBeDefined();
    expect(alpha!.types.length).toBeGreaterThan(0);
    // ALPHA has Story and Bug
    const storyType = alpha!.types.find(t => t.type === 'Story');
    expect(storyType).toBeDefined();
  });

  it('includes computation traces with expected keys', () => {
    const result = getCtoOrgMetrics('all');
    expect(result.traces).toBeDefined();
    expect(result.traces!.totalTickets).toContain('projects');
    expect(result.traces!.bugEscapeRate).toContain('Bug');
    expect(result.traces!.techDebtRatio).toContain('tech-debt');
    expect(result.traces!.flowEfficiency).toContain('efficiency');
    expect(result.traces!.headcount).toContain('tracked engineers');
  });
});
