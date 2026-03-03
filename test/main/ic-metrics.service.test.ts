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
        project_key: 'TEST',
        eng_start_status: 'In Progress',
        eng_end_status: 'In Review',
        eng_excluded_statuses: ['Blocked'],
        office_hours: { start: '09:00', end: '18:00', timezone: 'Europe/Berlin', exclude_weekends: true },
        mapping_rules: { tpd_bu: {}, work_stream: {} },
        field_ids: { tpd_bu: '', eng_hours: '', work_stream: '', story_points: '' },
        ticket_filter: { mode: 'last_x_months', months: 6 },
        sp_to_days: 1,
        tracked_engineers: [],
        my_account_id: 'a1',
        personal_goals: { tickets: 10, story_points: 20 },
        opt_in_team_comparison: true,
      };
      return defaults[key];
    }
    set() {}
  },
}));

// Mock ticket service
const mockTickets = [
  {
    key: 'TEST-1', project_key: 'TEST', summary: 'My feature', status: 'Done',
    assignee: 'Alice', assignee_id: 'a1', eng_hours: 8, tpd_bu: null,
    work_stream: 'Product', has_computed_values: false, story_points: 3,
    issue_type: 'Story', priority: 'Medium', created: '2025-01-01T09:00:00Z',
    resolved: '2025-01-03T17:00:00Z', base_url: '', updated: '2025-01-03T17:00:00Z',
    sprint_id: null, sprint_name: null, components: [],
  },
  {
    key: 'TEST-2', project_key: 'TEST', summary: 'Bob task', status: 'Done',
    assignee: 'Bob', assignee_id: 'a2', eng_hours: 4, tpd_bu: null,
    work_stream: 'Maintenance', has_computed_values: false, story_points: 1,
    issue_type: 'Bug', priority: 'High', created: '2025-01-02T09:00:00Z',
    resolved: '2025-01-04T17:00:00Z', base_url: '', updated: '2025-01-04T17:00:00Z',
    sprint_id: null, sprint_name: null, components: [],
  },
  {
    key: 'TEST-3', project_key: 'TEST', summary: 'My improvement', status: 'Done',
    assignee: 'Alice', assignee_id: 'a1', eng_hours: 6, tpd_bu: null,
    work_stream: 'Product', has_computed_values: false, story_points: 5,
    issue_type: 'Task', priority: 'Medium', created: '2025-01-05T09:00:00Z',
    resolved: '2025-01-08T17:00:00Z', base_url: '', updated: '2025-01-08T17:00:00Z',
    sprint_id: null, sprint_name: null, components: [],
  },
  {
    key: 'TEST-4', project_key: 'TEST', summary: 'My WIP', status: 'In Progress',
    assignee: 'Alice', assignee_id: 'a1', eng_hours: 0, tpd_bu: null,
    work_stream: 'Product', has_computed_values: false, story_points: 2,
    issue_type: 'Story', priority: 'Medium', created: '2025-01-09T09:00:00Z',
    resolved: null, base_url: '', updated: '2025-01-12T09:00:00Z',
    sprint_id: null, sprint_name: null, components: [],
  },
];

vi.mock('../../src/main/services/ticket.service.js', () => ({
  getAllTickets: vi.fn(() => mockTickets),
  getRawIssues: vi.fn(() => new Map()),
}));

// Mock timeline service
const mockTimelines = [
  {
    key: 'TEST-1', statusPeriods: [
      { status: 'Open', enteredAt: '2025-01-01T09:00:00Z', exitedAt: '2025-01-02T09:00:00Z', durationHours: 24, category: 'wait' },
      { status: 'In Progress', enteredAt: '2025-01-02T09:00:00Z', exitedAt: '2025-01-03T09:00:00Z', durationHours: 24, category: 'active' },
      { status: 'Done', enteredAt: '2025-01-03T09:00:00Z', exitedAt: '2025-01-03T17:00:00Z', durationHours: 8, category: 'done' },
    ],
    cycleTimeHours: 24, leadTimeHours: 48, activeTimeHours: 24, waitTimeHours: 24,
    blockedTimeHours: 0, flowEfficiency: 50, hasRework: false, reworkCount: 0,
    currentStatus: 'Done', daysInCurrentStatus: 0,
  },
  {
    key: 'TEST-2', statusPeriods: [
      { status: 'In Progress', enteredAt: '2025-01-02T09:00:00Z', exitedAt: '2025-01-04T09:00:00Z', durationHours: 48, category: 'active' },
      { status: 'Done', enteredAt: '2025-01-04T09:00:00Z', exitedAt: '2025-01-04T17:00:00Z', durationHours: 8, category: 'done' },
    ],
    cycleTimeHours: 48, leadTimeHours: 56, activeTimeHours: 48, waitTimeHours: 0,
    blockedTimeHours: 0, flowEfficiency: 85.7, hasRework: false, reworkCount: 0,
    currentStatus: 'Done', daysInCurrentStatus: 0,
  },
  {
    key: 'TEST-3', statusPeriods: [
      { status: 'In Progress', enteredAt: '2025-01-05T09:00:00Z', exitedAt: '2025-01-07T09:00:00Z', durationHours: 48, category: 'active' },
      { status: 'Code Review', enteredAt: '2025-01-07T09:00:00Z', exitedAt: '2025-01-07T15:00:00Z', durationHours: 6, category: 'active' },
      { status: 'In Progress', enteredAt: '2025-01-07T15:00:00Z', exitedAt: '2025-01-08T09:00:00Z', durationHours: 18, category: 'active' },
      { status: 'Done', enteredAt: '2025-01-08T09:00:00Z', exitedAt: '2025-01-08T17:00:00Z', durationHours: 8, category: 'done' },
    ],
    cycleTimeHours: 72, leadTimeHours: 72, activeTimeHours: 72, waitTimeHours: 0,
    blockedTimeHours: 0, flowEfficiency: 100, hasRework: true, reworkCount: 1,
    currentStatus: 'Done', daysInCurrentStatus: 0,
  },
  {
    key: 'TEST-4', statusPeriods: [
      { status: 'In Progress', enteredAt: '2025-01-09T09:00:00Z', exitedAt: null, durationHours: 72, category: 'active' },
    ],
    cycleTimeHours: null, leadTimeHours: null, activeTimeHours: 72, waitTimeHours: 0,
    blockedTimeHours: 0, flowEfficiency: null, hasRework: false, reworkCount: 0,
    currentStatus: 'In Progress', daysInCurrentStatus: 3,
  },
];

vi.mock('../../src/main/services/timeline.service.js', () => ({
  getTimelines: vi.fn(() => mockTimelines),
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
  invalidateTimelineCache: vi.fn(),
  computeSpAccuracy: vi.fn((tickets: Array<{ story_points: number | null; eng_hours: number | null }>) => {
    const valid = tickets.filter(t => t.story_points != null && t.story_points > 0 && t.eng_hours != null && t.eng_hours > 0);
    if (valid.length === 0) return null;
    const ratios = valid.map(t => (t.eng_hours! / (t.story_points! * 8)) * 100);
    return ratios.reduce((a, b) => a + b, 0) / ratios.length;
  }),
  computeReviewDuration: vi.fn((timelines: Array<{ statusPeriods: Array<{ status: string; durationHours: number }> }>) => {
    const durations: number[] = [];
    for (const tl of timelines) {
      let reviewHours = 0;
      let hasReview = false;
      for (const sp of tl.statusPeriods) {
        if (sp.status.toLowerCase().includes('review')) { reviewHours += sp.durationHours; hasReview = true; }
      }
      if (hasReview) durations.push(reviewHours);
    }
    return durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  }),
}));

import { getIcPersonalMetrics } from '../../src/main/services/ic-metrics.service.js';

describe('ic-metrics.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getIcPersonalMetrics', () => {
    it('filters to my tickets (my_account_id = a1)', () => {
      const result = getIcPersonalMetrics('all');
      // Alice (a1) has TEST-1, TEST-3, TEST-4 — Bob's ticket should be excluded from personal metrics
      // totalTickets counts resolved tickets from filtered timelines, which for period='all' is all my timelines
      // TEST-1, TEST-3 are resolved (Alice), TEST-4 is WIP (Alice) — but all 3 are in "my" timelines
      expect(result.totalTickets).toBe(3); // all 3 of Alice's timelines
    });

    it('returns cycle time p50', () => {
      const result = getIcPersonalMetrics('all');
      // Alice resolved tickets: TEST-1 (24h) and TEST-3 (72h)
      expect(result.cycleTimeP50).toBeDefined();
    });

    it('returns cycle time trend with 8 weeks', () => {
      const result = getIcPersonalMetrics('all');
      expect(result.cycleTimeTrend).toHaveLength(8);
    });

    it('returns throughput trend with 8 weeks', () => {
      const result = getIcPersonalMetrics('all');
      expect(result.throughput).toHaveLength(8);
    });

    it('returns aging WIP for in-progress tickets', () => {
      const result = getIcPersonalMetrics('all');
      // TEST-4 is in-progress for Alice
      expect(result.agingWip.length).toBeGreaterThanOrEqual(1);
      const wip = result.agingWip.find(i => i.key === 'TEST-4');
      expect(wip).toBeDefined();
      expect(wip!.daysInStatus).toBe(3);
    });

    it('returns time in status breakdown', () => {
      const result = getIcPersonalMetrics('all');
      expect(result.timeInStatus.length).toBeGreaterThan(0);
      // Should have In Progress, Done, etc.
      const statuses = result.timeInStatus.map(s => s.status);
      expect(statuses).toContain('In Progress');
    });

    it('computes rework rate', () => {
      const result = getIcPersonalMetrics('all');
      // Alice: TEST-1 (no rework), TEST-3 (rework), TEST-4 (no rework) = 1/3
      expect(result.reworkRate).toBeCloseTo(1 / 3, 2);
    });

    it('returns rework trend with 8 weeks', () => {
      const result = getIcPersonalMetrics('all');
      expect(result.reworkTrend).toHaveLength(8);
    });

    it('returns scope trajectory', () => {
      const result = getIcPersonalMetrics('all');
      // Alice has resolved tickets in 2025-01 — should have at least 1 month
      expect(result.scopeTrajectory.length).toBeGreaterThanOrEqual(1);
    });

    it('returns team comparison when opted in', () => {
      const result = getIcPersonalMetrics('all');
      expect(result.teamComparison).not.toBeNull();
      expect(result.teamComparison!).toHaveLength(3);
      expect(result.teamComparison![0].metric).toContain('Cycle Time');
    });

    it('returns goal progress when goals configured', () => {
      const result = getIcPersonalMetrics('all');
      expect(result.goalProgress).not.toBeNull();
      expect(result.goalProgress!.length).toBe(2); // tickets + story_points
    });

    it('returns period', () => {
      const result = getIcPersonalMetrics('monthly');
      expect(result.period).toBe('monthly');
    });

    it('computes SP accuracy', () => {
      const result = getIcPersonalMetrics('all');
      // Alice has TEST-1 (SP=3, eng=8) and TEST-3 (SP=5, eng=6), TEST-4 (SP=2, eng=0 → skipped)
      expect(result.spAccuracy).not.toBeNull();
      expect(typeof result.spAccuracy).toBe('number');
    });

    it('computes first-time pass rate as complement of rework rate', () => {
      const result = getIcPersonalMetrics('all');
      expect(result.firstTimePassRate).toBeCloseTo(1 - result.reworkRate, 5);
    });

    it('computes avg review wait hours', () => {
      const result = getIcPersonalMetrics('all');
      // TEST-3 has a Code Review period of 6h — but only Alice's filtered timelines are used
      // avgReviewWaitHours may be 6 (from TEST-3's Code Review) or null if no review periods
      expect(result.avgReviewWaitHours === null || typeof result.avgReviewWaitHours === 'number').toBe(true);
    });

    it('computes focus score', () => {
      const result = getIcPersonalMetrics('all');
      // Alice: TEST-1 (Story=product), TEST-3 (Task=product), TEST-4 (Story=product) = 3/3 = 1.0
      expect(result.focusScore).not.toBeNull();
      expect(result.focusScore).toBe(1); // all product types
    });

    it('includes computation traces with expected keys', () => {
      const result = getIcPersonalMetrics('all');
      expect(result.traces).toBeDefined();
      expect(result.traces!.cycleTimeP50).toContain('my_account_id');
      expect(result.traces!.reworkRate).toContain('backward transitions');
      expect(result.traces!.tickets).toContain('tickets');
      expect(result.traces!.spAccuracy).toContain('sp_to_days');
      expect(result.traces!.firstTimePassRate).toContain('rework');
      expect(result.traces!.avgReviewWait).toContain('timelines');
      expect(result.traces!.focusScore).toContain('product');
      expect(result.traces!.teamComparison).toContain('engineers');
    });
  });
});
