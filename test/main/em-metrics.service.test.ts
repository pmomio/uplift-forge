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
        tracked_engineers: [
          { accountId: 'a1', displayName: 'Alice' },
          { accountId: 'a2', displayName: 'Bob' },
        ],
      };
      return defaults[key];
    }
    set() {}
  },
}));

// Mock ticket service
const mockTickets = [
  {
    key: 'TEST-1', project_key: 'TEST', summary: 'Feature', status: 'Done',
    assignee: 'Alice', assignee_id: 'a1', eng_hours: 8, tpd_bu: null,
    work_stream: 'Product', has_computed_values: false, story_points: 3,
    issue_type: 'Story', priority: 'Medium', created: '2025-01-01T09:00:00Z',
    resolved: '2025-01-03T17:00:00Z', base_url: '', updated: '2025-01-03T17:00:00Z',
    sprint_id: null, sprint_name: null, components: [],
  },
  {
    key: 'TEST-2', project_key: 'TEST', summary: 'Bug fix', status: 'Done',
    assignee: 'Bob', assignee_id: 'a2', eng_hours: 4, tpd_bu: null,
    work_stream: 'Maintenance', has_computed_values: false, story_points: 1,
    issue_type: 'Bug', priority: 'High', created: '2025-01-02T09:00:00Z',
    resolved: '2025-01-04T17:00:00Z', base_url: '', updated: '2025-01-04T17:00:00Z',
    sprint_id: null, sprint_name: null, components: [],
  },
  {
    key: 'TEST-3', project_key: 'TEST', summary: 'Improvement', status: 'Done',
    assignee: 'Alice', assignee_id: 'a1', eng_hours: 6, tpd_bu: null,
    work_stream: 'Product', has_computed_values: false, story_points: 2,
    issue_type: 'Task', priority: 'Medium', created: '2025-01-03T09:00:00Z',
    resolved: '2025-01-05T17:00:00Z', base_url: '', updated: '2025-01-05T17:00:00Z',
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
      { status: 'Open', enteredAt: '2025-01-02T09:00:00Z', exitedAt: '2025-01-03T09:00:00Z', durationHours: 24, category: 'wait' },
      { status: 'In Progress', enteredAt: '2025-01-03T09:00:00Z', exitedAt: '2025-01-04T09:00:00Z', durationHours: 24, category: 'active' },
      { status: 'Done', enteredAt: '2025-01-04T09:00:00Z', exitedAt: '2025-01-04T17:00:00Z', durationHours: 8, category: 'done' },
    ],
    cycleTimeHours: 24, leadTimeHours: 48, activeTimeHours: 24, waitTimeHours: 24,
    blockedTimeHours: 0, flowEfficiency: 50, hasRework: false, reworkCount: 0,
    currentStatus: 'Done', daysInCurrentStatus: 0,
  },
  {
    key: 'TEST-3', statusPeriods: [
      { status: 'In Progress', enteredAt: '2025-01-03T09:00:00Z', exitedAt: '2025-01-04T09:00:00Z', durationHours: 24, category: 'active' },
      { status: 'Code Review', enteredAt: '2025-01-04T09:00:00Z', exitedAt: '2025-01-04T15:00:00Z', durationHours: 6, category: 'active' },
      { status: 'In Progress', enteredAt: '2025-01-04T15:00:00Z', exitedAt: '2025-01-05T09:00:00Z', durationHours: 18, category: 'active' },
      { status: 'Done', enteredAt: '2025-01-05T09:00:00Z', exitedAt: '2025-01-05T17:00:00Z', durationHours: 8, category: 'done' },
    ],
    cycleTimeHours: 48, leadTimeHours: 48, activeTimeHours: 48, waitTimeHours: 0,
    blockedTimeHours: 0, flowEfficiency: 100, hasRework: true, reworkCount: 1,
    currentStatus: 'Done', daysInCurrentStatus: 0,
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
  computeWeeklyThroughput: vi.fn(() => [
    { week: '1/1', count: 2, storyPoints: 4 },
    { week: '1/8', count: 1, storyPoints: 2 },
  ]),
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
  computeLeadTimeBreakdown: vi.fn((timelines: Array<{ leadTimeHours: number | null; activeTimeHours: number; waitTimeHours: number; blockedTimeHours: number }>) => {
    let totalActive = 0, totalWait = 0, totalBlocked = 0, count = 0;
    for (const tl of timelines) {
      if (tl.leadTimeHours == null || tl.leadTimeHours <= 0) continue;
      const total = tl.activeTimeHours + tl.waitTimeHours + tl.blockedTimeHours;
      if (total <= 0) continue;
      totalActive += tl.activeTimeHours / total; totalWait += tl.waitTimeHours / total; totalBlocked += tl.blockedTimeHours / total; count++;
    }
    return count === 0 ? null : { activePercent: (totalActive / count) * 100, waitPercent: (totalWait / count) * 100, blockedPercent: (totalBlocked / count) * 100 };
  }),
  computeWorkTypeDistribution: vi.fn((tickets: Array<{ issue_type: string }>) => {
    const byType = new Map<string, number>();
    for (const t of tickets) byType.set(t.issue_type, (byType.get(t.issue_type) ?? 0) + 1);
    const total = tickets.length;
    return Array.from(byType.entries()).map(([type, count]) => ({ type, count, percentage: total > 0 ? (count / total) * 100 : 0 })).sort((a, b) => b.count - a.count);
  }),
}));

import { getEmTeamMetrics, getEmIndividualMetrics } from '../../src/main/services/em-metrics.service.js';

describe('em-metrics.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEmTeamMetrics', () => {
    it('returns cycle time distribution', () => {
      const result = getEmTeamMetrics('all');
      expect(result.cycleTime).toBeDefined();
      expect(result.cycleTime.p50).toBeGreaterThanOrEqual(0);
    });

    it('returns throughput by work stream', () => {
      const result = getEmTeamMetrics('all');
      expect(result.throughputByWorkStream).toHaveLength(2);
      expect(result.throughputByWorkStream.map(t => t.workStream)).toContain('Product');
      expect(result.throughputByWorkStream.map(t => t.workStream)).toContain('Maintenance');
    });

    it('returns weekly throughput', () => {
      const result = getEmTeamMetrics('all');
      expect(result.weeklyThroughput).toHaveLength(2);
    });

    it('returns contribution spread', () => {
      const result = getEmTeamMetrics('all');
      expect(result.contributionSpread).toHaveLength(2);
      const alice = result.contributionSpread.find(c => c.displayName === 'Alice');
      expect(alice).toBeDefined();
      expect(alice!.storyPoints).toBe(5); // 3 + 2
      expect(alice!.tickets).toBe(2);
    });

    it('computes rework rate', () => {
      const result = getEmTeamMetrics('all');
      // 1 out of 3 timelines has rework
      expect(result.reworkRate).toBeCloseTo(1 / 3, 2);
    });

    it('returns bug ratio by engineer', () => {
      const result = getEmTeamMetrics('all');
      expect(result.bugRatioByEngineer).toHaveLength(2);
      const bob = result.bugRatioByEngineer.find(e => e.displayName === 'Bob');
      expect(bob).toBeDefined();
      expect(bob!.bugRatio).toBe(1); // 1 bug out of 1 ticket
    });

    it('returns total tickets and story points', () => {
      const result = getEmTeamMetrics('all');
      expect(result.totalTickets).toBe(3);
      expect(result.totalStoryPoints).toBe(6); // 3 + 1 + 2
    });

    it('computes SP accuracy', () => {
      const result = getEmTeamMetrics('all');
      // All 3 tickets have SP and eng_hours, spAccuracy should be non-null
      expect(result.spAccuracy).not.toBeNull();
      expect(typeof result.spAccuracy).toBe('number');
    });

    it('computes first-time pass rate as complement of rework rate', () => {
      const result = getEmTeamMetrics('all');
      expect(result.firstTimePassRate).toBeCloseTo(1 - result.reworkRate, 5);
    });

    it('computes avg review duration', () => {
      const result = getEmTeamMetrics('all');
      // TEST-3 has a Code Review period of 6h — avgReviewDuration should be non-null
      expect(result.avgReviewDurationHours).not.toBeNull();
    });

    it('returns work type distribution', () => {
      const result = getEmTeamMetrics('all');
      expect(result.workTypeDistribution.length).toBeGreaterThan(0);
      const storyType = result.workTypeDistribution.find(d => d.type === 'Story');
      expect(storyType).toBeDefined();
    });

    it('computes unestimated ratio', () => {
      const result = getEmTeamMetrics('all');
      // All mock tickets have story_points, so ratio should be 0
      expect(result.unestimatedRatio).toBe(0);
    });

    it('computes lead time breakdown', () => {
      const result = getEmTeamMetrics('all');
      // Mock timelines have active and wait time, so breakdown should be non-null
      expect(result.leadTimeBreakdown).not.toBeNull();
      if (result.leadTimeBreakdown) {
        expect(result.leadTimeBreakdown.activePercent).toBeGreaterThanOrEqual(0);
        expect(result.leadTimeBreakdown.waitPercent).toBeGreaterThanOrEqual(0);
        expect(result.leadTimeBreakdown.blockedPercent).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getEmIndividualMetrics', () => {
    it('returns per-engineer metrics', () => {
      const result = getEmIndividualMetrics('all');
      expect(result.engineers).toHaveLength(2);
    });

    it('returns team averages', () => {
      const result = getEmIndividualMetrics('all');
      expect(result.teamAverages).toBeDefined();
      expect(result.teamAverages.tickets).toBe(3);
      expect(result.teamAverages.storyPoints).toBe(6);
    });

    it('computes per-engineer rework rate', () => {
      const result = getEmIndividualMetrics('all');
      const alice = result.engineers.find(e => e.displayName === 'Alice');
      expect(alice).toBeDefined();
      // Alice has TEST-1 (no rework) and TEST-3 (rework) = 50%
      expect(alice!.reworkRate).toBe(0.5);
    });

    it('computes per-engineer bug ratio', () => {
      const result = getEmIndividualMetrics('all');
      const bob = result.engineers.find(e => e.displayName === 'Bob');
      expect(bob).toBeDefined();
      expect(bob!.bugRatio).toBe(1); // 1 bug out of 1 total
    });

    it('computes complexity score (avg SP per ticket)', () => {
      const result = getEmIndividualMetrics('all');
      const alice = result.engineers.find(e => e.displayName === 'Alice');
      expect(alice!.complexityScore).toBe(2.5); // (3+2)/2
    });

    it('includes SP accuracy per engineer', () => {
      const result = getEmIndividualMetrics('all');
      const alice = result.engineers.find(e => e.displayName === 'Alice');
      expect(alice).toBeDefined();
      // Alice has tickets with SP and eng_hours
      expect(alice!.spAccuracy).not.toBeNull();
    });

    it('includes first-time pass rate per engineer', () => {
      const result = getEmIndividualMetrics('all');
      const alice = result.engineers.find(e => e.displayName === 'Alice');
      expect(alice).toBeDefined();
      // Alice reworkRate = 0.5, so firstTimePassRate = 0.5
      expect(alice!.firstTimePassRate).toBeCloseTo(0.5, 2);

      const bob = result.engineers.find(e => e.displayName === 'Bob');
      expect(bob).toBeDefined();
      // Bob has no rework
      expect(bob!.firstTimePassRate).toBe(1);
    });

    it('includes SP accuracy and first-time pass rate in team averages', () => {
      const result = getEmIndividualMetrics('all');
      expect(result.teamAverages.spAccuracy).not.toBeUndefined();
      expect(result.teamAverages.firstTimePassRate).toBeDefined();
      expect(result.teamAverages.firstTimePassRate).toBeCloseTo(1 - result.teamAverages.reworkRate, 5);
    });

    it('includes computation traces', () => {
      const result = getEmIndividualMetrics('all');
      expect(result.traces).toBeDefined();
      expect(result.traces!.teamAvg).toContain('timelines');
    });
  });

  describe('computation traces', () => {
    it('getEmTeamMetrics includes traces with expected keys', () => {
      const result = getEmTeamMetrics('all');
      expect(result.traces).toBeDefined();
      expect(result.traces!.totalTickets).toContain('total timelines');
      expect(result.traces!.cycleTimeP50).toContain('valid cycle time');
      expect(result.traces!.reworkRate).toContain('backward transitions');
      expect(result.traces!.spAccuracy).toContain('sp_to_days');
      expect(result.traces!.avgReviewDuration).toContain('timelines');
      expect(result.traces!.unestimatedRatio).toContain('SP = null');
    });

    it('getEmIndividualMetrics includes traces with teamAvg key', () => {
      const result = getEmIndividualMetrics('all');
      expect(result.traces).toBeDefined();
      expect(result.traces!.teamAvg).toBeDefined();
      expect(typeof result.traces!.teamAvg).toBe('string');
    });
  });
});
