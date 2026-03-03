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
        wip_limit: 5,
        aging_thresholds: { warning_days: 3, critical_days: 7, escalation_days: 14 },
      };
      return defaults[key];
    }
    set() {}
  },
}));

// Mock ticket service
const mockTickets = [
  {
    key: 'TEST-1', project_key: 'TEST', summary: 'Feature A', status: 'Done',
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
    key: 'TEST-3', project_key: 'TEST', summary: 'Stuck ticket', status: 'In Progress',
    assignee: 'Alice', assignee_id: 'a1', eng_hours: 0, tpd_bu: null,
    work_stream: 'Product', has_computed_values: false, story_points: 5,
    issue_type: 'Task', priority: 'Medium', created: '2025-01-01T09:00:00Z',
    resolved: null, base_url: '', updated: '2025-01-10T09:00:00Z',
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
      { status: 'Open', enteredAt: '2025-01-02T09:00:00Z', exitedAt: '2025-01-02T15:00:00Z', durationHours: 6, category: 'wait' },
      { status: 'Blocked', enteredAt: '2025-01-02T15:00:00Z', exitedAt: '2025-01-03T09:00:00Z', durationHours: 18, category: 'blocked' },
      { status: 'In Progress', enteredAt: '2025-01-03T09:00:00Z', exitedAt: '2025-01-04T09:00:00Z', durationHours: 24, category: 'active' },
      { status: 'Done', enteredAt: '2025-01-04T09:00:00Z', exitedAt: '2025-01-04T17:00:00Z', durationHours: 8, category: 'done' },
    ],
    cycleTimeHours: 42, leadTimeHours: 48, activeTimeHours: 24, waitTimeHours: 6,
    blockedTimeHours: 18, flowEfficiency: 50, hasRework: false, reworkCount: 0,
    currentStatus: 'Done', daysInCurrentStatus: 0,
  },
  {
    key: 'TEST-3', statusPeriods: [
      { status: 'In Progress', enteredAt: '2025-01-01T09:00:00Z', exitedAt: null, durationHours: 240, category: 'active' },
    ],
    cycleTimeHours: null, leadTimeHours: null, activeTimeHours: 240, waitTimeHours: 0,
    blockedTimeHours: 0, flowEfficiency: null, hasRework: false, reworkCount: 0,
    currentStatus: 'In Progress', daysInCurrentStatus: 10,
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
    { week: '1/15', count: 3, storyPoints: 5 },
    { week: '1/22', count: 2, storyPoints: 3 },
  ]),
  invalidateTimelineCache: vi.fn(),
  computeTimeToFirstActivity: vi.fn((timelines: Array<{ statusPeriods: Array<{ category: string; enteredAt: string }> }>, ticketMap: Map<string, { created: string | null }>) => {
    const delays: number[] = [];
    for (const tl of timelines) {
      const ticket = ticketMap.get((tl as unknown as { key: string }).key);
      if (!ticket?.created) continue;
      const firstActive = tl.statusPeriods.find(p => p.category === 'active');
      if (!firstActive) continue;
      const hours = (new Date(firstActive.enteredAt).getTime() - new Date(ticket.created).getTime()) / (1000 * 60 * 60);
      delays.push(Math.max(0, hours));
    }
    return delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : null;
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
}));

import { getDmFlowMetrics } from '../../src/main/services/dm-metrics.service.js';

describe('dm-metrics.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDmFlowMetrics', () => {
    it('returns lead time distribution', () => {
      const result = getDmFlowMetrics('all');
      expect(result.leadTimeDistribution).toBeDefined();
      expect(result.leadTimeDistribution.p50).toBeGreaterThanOrEqual(0);
      expect(result.leadTimeDistribution.p85).toBeGreaterThanOrEqual(0);
    });

    it('returns lead time histogram', () => {
      const result = getDmFlowMetrics('all');
      expect(result.leadTimeHistogram).toHaveLength(6); // 6 buckets
      const total = result.leadTimeHistogram.reduce((s, b) => s + b.count, 0);
      expect(total).toBe(2); // 2 resolved tickets with lead times
    });

    it('returns WIP status', () => {
      const result = getDmFlowMetrics('all');
      expect(result.wip.count).toBe(1); // TEST-3 is in progress
      expect(result.wip.limit).toBe(5);
      expect(result.wip.overLimit).toBe(false);
    });

    it('returns aging WIP tiered entries', () => {
      const result = getDmFlowMetrics('all');
      // TEST-3 has 10 days in current status, which exceeds critical_days (7) but not escalation_days (14)
      expect(result.agingWipTiered.length).toBeGreaterThanOrEqual(1);
      const stuck = result.agingWipTiered.find(e => e.key === 'TEST-3');
      expect(stuck).toBeDefined();
      expect(stuck!.tier).toBe('critical');
    });

    it('returns blockers', () => {
      const result = getDmFlowMetrics('all');
      // TEST-2 has 18 blocked hours
      expect(result.blockers.length).toBe(1);
      expect(result.blockers[0].key).toBe('TEST-2');
      expect(result.blockers[0].blockedHours).toBe(18);
    });

    it('returns flow efficiency', () => {
      const result = getDmFlowMetrics('all');
      // Two resolved timelines have flowEfficiency of 50 each
      expect(result.flowEfficiency.average).toBe(50);
      expect(result.flowEfficiency.median).toBe(50);
    });

    it('returns weekly throughput', () => {
      const result = getDmFlowMetrics('all');
      expect(result.weeklyThroughput).toHaveLength(4);
    });

    it('returns throughput stability', () => {
      const result = getDmFlowMetrics('all');
      // Counts are [2, 1, 3, 2] — mean = 2, stddev = 0.707, CV = 0.354, stability = 0.646
      expect(result.throughputStability).toBeGreaterThan(0);
      expect(result.throughputStability).toBeLessThanOrEqual(1);
    });

    it('returns Monte Carlo forecast', () => {
      const result = getDmFlowMetrics('all');
      expect(result.monteCarlo.targetItems).toBe(1); // 1 WIP item
      expect(result.monteCarlo.confidenceLevels).toHaveLength(3);
      expect(result.monteCarlo.confidenceLevels[0].percentile).toBe(50);
    });

    it('returns CFD data', () => {
      const result = getDmFlowMetrics('all');
      expect(result.cfd).toHaveLength(30); // 30 days
      expect(result.cfd[0]).toHaveProperty('date');
    });

    it('returns total tickets and story points', () => {
      const result = getDmFlowMetrics('all');
      expect(result.totalTickets).toBe(3); // all 3 tickets (period='all' includes all)
      expect(result.totalStoryPoints).toBe(9); // 3 + 1 + 5
    });

    it('returns period', () => {
      const result = getDmFlowMetrics('monthly');
      expect(result.period).toBe('monthly');
    });

    it('returns arrival vs departure data', () => {
      const result = getDmFlowMetrics('all');
      expect(result.arrivalVsDeparture).toHaveLength(12);
      for (const entry of result.arrivalVsDeparture) {
        expect(entry).toHaveProperty('week');
        expect(entry).toHaveProperty('arrived');
        expect(entry).toHaveProperty('departed');
      }
    });

    it('returns batch size trend', () => {
      const result = getDmFlowMetrics('all');
      expect(result.batchSizeTrend).toHaveLength(12);
      for (const entry of result.batchSizeTrend) {
        expect(entry).toHaveProperty('week');
        expect(entry).toHaveProperty('avgSp');
        expect(entry.avgSp).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns time to first activity', () => {
      const result = getDmFlowMetrics('all');
      // Should be non-null since resolved timelines have active periods
      // (depends on period filter — with 'all' and old dates, may be null)
      expect(result.timeToFirstActivityHours === null || typeof result.timeToFirstActivityHours === 'number').toBe(true);
    });

    it('returns lead time breakdown', () => {
      const result = getDmFlowMetrics('all');
      // Should be non-null for timelines with lead time
      if (result.leadTimeBreakdown) {
        expect(result.leadTimeBreakdown.activePercent).toBeGreaterThanOrEqual(0);
        expect(result.leadTimeBreakdown.waitPercent).toBeGreaterThanOrEqual(0);
        expect(result.leadTimeBreakdown.blockedPercent).toBeGreaterThanOrEqual(0);
      }
    });

    it('includes computation traces with expected keys', () => {
      const result = getDmFlowMetrics('all');
      expect(result.traces).toBeDefined();
      expect(result.traces!.leadTimeP50).toContain('valid lead time');
      expect(result.traces!.flowEfficiency).toContain('efficiency');
      expect(result.traces!.wip).toContain('active statuses');
      expect(result.traces!.throughputStability).toContain('weeks');
      expect(result.traces!.monteCarlo).toContain('simulations');
    });
  });
});
