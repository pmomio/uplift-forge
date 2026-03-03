import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron-store
vi.mock('electron-store', () => ({
  default: class MockStore {
    constructor() {}
    get(key: string) {
      const defaults: Record<string, unknown> = {
        active_statuses: ['In Progress', 'Code Review', 'QA'],
        blocked_statuses: ['Blocked'],
        done_statuses: ['Done', 'Resolved', 'Closed', 'Rejected', 'Cancelled'],
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
      };
      return defaults[key];
    }
    set() {}
  },
}));

// Mock ticket service (timeline imports getRawIssues)
vi.mock('../../src/main/services/ticket.service.js', () => ({
  getRawIssues: vi.fn(() => new Map()),
}));

import {
  classifyStatus,
  extractTimeline,
  computePercentiles,
  computeWeeklyThroughput,
  invalidateTimelineCache,
  computeSpAccuracy,
  computeReviewDuration,
  computeTimeToFirstActivity,
  computeLeadTimeBreakdown,
  computeWorkTypeDistribution,
} from '../../src/main/services/timeline.service.js';
import type { StatusClassification, ProcessedTicket, TicketTimeline } from '../../src/shared/types.js';

const classification: StatusClassification = {
  active_statuses: ['In Progress', 'Code Review', 'QA'],
  blocked_statuses: ['Blocked'],
  done_statuses: ['Done', 'Resolved', 'Closed', 'Rejected', 'Cancelled'],
};

function makeIssue(key: string, histories: unknown[] = [], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    key,
    fields: {
      summary: `Issue ${key}`,
      status: { name: 'Done' },
      assignee: { displayName: 'Alice', accountId: 'a1' },
      issuetype: { name: 'Story' },
      priority: { name: 'Medium' },
      created: '2025-01-01T09:00:00Z',
      resolutiondate: '2025-01-05T17:00:00Z',
      updated: '2025-01-05T18:00:00Z',
      ...overrides,
    },
    changelog: { histories },
  };
}

function makeTransition(from: string, to: string, timestamp: string) {
  return {
    created: timestamp,
    items: [{ field: 'status', fromString: from, toString: to }],
  };
}

describe('timeline.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTimelineCache();
  });

  describe('classifyStatus', () => {
    it('classifies active statuses', () => {
      expect(classifyStatus('In Progress', classification)).toBe('active');
      expect(classifyStatus('Code Review', classification)).toBe('active');
      expect(classifyStatus('QA', classification)).toBe('active');
    });

    it('classifies blocked statuses', () => {
      expect(classifyStatus('Blocked', classification)).toBe('blocked');
    });

    it('classifies done statuses', () => {
      expect(classifyStatus('Done', classification)).toBe('done');
      expect(classifyStatus('Resolved', classification)).toBe('done');
      expect(classifyStatus('Closed', classification)).toBe('done');
    });

    it('classifies unknown statuses as wait', () => {
      expect(classifyStatus('Open', classification)).toBe('wait');
      expect(classifyStatus('To Do', classification)).toBe('wait');
      expect(classifyStatus('Backlog', classification)).toBe('wait');
    });

    it('is case-insensitive', () => {
      expect(classifyStatus('in progress', classification)).toBe('active');
      expect(classifyStatus('BLOCKED', classification)).toBe('blocked');
      expect(classifyStatus('done', classification)).toBe('done');
    });
  });

  describe('extractTimeline', () => {
    it('handles issue with no transitions', () => {
      const issue = makeIssue('TEST-1');
      const tl = extractTimeline(issue, classification);

      expect(tl.key).toBe('TEST-1');
      expect(tl.statusPeriods).toHaveLength(1);
      expect(tl.statusPeriods[0].status).toBe('Done');
      expect(tl.statusPeriods[0].category).toBe('done');
      expect(tl.currentStatus).toBe('Done');
    });

    it('builds status periods from transitions', () => {
      const histories = [
        makeTransition('Open', 'In Progress', '2025-01-02T09:00:00Z'),
        makeTransition('In Progress', 'Code Review', '2025-01-03T09:00:00Z'),
        makeTransition('Code Review', 'Done', '2025-01-04T09:00:00Z'),
      ];
      const issue = makeIssue('TEST-2', histories);
      const tl = extractTimeline(issue, classification);

      // Initial (Open) + 3 transitions = 4 periods
      expect(tl.statusPeriods).toHaveLength(4);
      expect(tl.statusPeriods[0].status).toBe('Open');
      expect(tl.statusPeriods[0].category).toBe('wait');
      expect(tl.statusPeriods[1].status).toBe('In Progress');
      expect(tl.statusPeriods[1].category).toBe('active');
      expect(tl.statusPeriods[2].status).toBe('Code Review');
      expect(tl.statusPeriods[2].category).toBe('active');
      expect(tl.statusPeriods[3].status).toBe('Done');
      expect(tl.statusPeriods[3].category).toBe('done');
    });

    it('computes cycle time from first active to done', () => {
      const histories = [
        makeTransition('Open', 'In Progress', '2025-01-02T09:00:00Z'),
        makeTransition('In Progress', 'Done', '2025-01-04T09:00:00Z'),
      ];
      const issue = makeIssue('TEST-3', histories);
      const tl = extractTimeline(issue, classification);

      // Cycle time: In Progress (Jan 2 09:00) -> Done (Jan 4 09:00) = 48 hours
      expect(tl.cycleTimeHours).toBe(48);
    });

    it('computes lead time from created to done', () => {
      const histories = [
        makeTransition('Open', 'In Progress', '2025-01-02T09:00:00Z'),
        makeTransition('In Progress', 'Done', '2025-01-04T09:00:00Z'),
      ];
      const issue = makeIssue('TEST-4', histories);
      const tl = extractTimeline(issue, classification);

      // Lead time: Created (Jan 1 09:00) -> Done (Jan 4 09:00) = 72 hours
      expect(tl.leadTimeHours).toBe(72);
    });

    it('computes active/wait/blocked time', () => {
      const histories = [
        makeTransition('Open', 'In Progress', '2025-01-02T09:00:00Z'),
        makeTransition('In Progress', 'Blocked', '2025-01-03T09:00:00Z'),
        makeTransition('Blocked', 'In Progress', '2025-01-04T09:00:00Z'),
        makeTransition('In Progress', 'Done', '2025-01-05T09:00:00Z'),
      ];
      const issue = makeIssue('TEST-5', histories);
      const tl = extractTimeline(issue, classification);

      // Active: In Progress (24h) + In Progress (24h) = 48h
      expect(tl.activeTimeHours).toBe(48);
      // Blocked: 24h
      expect(tl.blockedTimeHours).toBe(24);
      // Wait: Open (24h)
      expect(tl.waitTimeHours).toBe(24);
    });

    it('computes flow efficiency', () => {
      const histories = [
        makeTransition('Open', 'In Progress', '2025-01-02T09:00:00Z'),
        makeTransition('In Progress', 'Done', '2025-01-04T09:00:00Z'),
      ];
      const issue = makeIssue('TEST-6', histories);
      const tl = extractTimeline(issue, classification);

      // Active: 48h, Lead: 72h, Flow efficiency: 48/72*100 = 66.67%
      expect(tl.flowEfficiency).toBeCloseTo(66.67, 1);
    });

    it('detects rework (backward transitions)', () => {
      const histories = [
        makeTransition('Open', 'In Progress', '2025-01-02T09:00:00Z'),
        makeTransition('In Progress', 'Code Review', '2025-01-03T09:00:00Z'),
        makeTransition('Code Review', 'In Progress', '2025-01-04T09:00:00Z'), // Rework!
        makeTransition('In Progress', 'Done', '2025-01-05T09:00:00Z'),
      ];
      const issue = makeIssue('TEST-7', histories);
      const tl = extractTimeline(issue, classification);

      expect(tl.hasRework).toBe(true);
      expect(tl.reworkCount).toBe(1);
    });

    it('does not count forward transitions as rework', () => {
      const histories = [
        makeTransition('Open', 'In Progress', '2025-01-02T09:00:00Z'),
        makeTransition('In Progress', 'Code Review', '2025-01-03T09:00:00Z'),
        makeTransition('Code Review', 'Done', '2025-01-04T09:00:00Z'),
      ];
      const issue = makeIssue('TEST-8', histories);
      const tl = extractTimeline(issue, classification);

      expect(tl.hasRework).toBe(false);
      expect(tl.reworkCount).toBe(0);
    });

    it('returns null cycle/lead time for tickets not yet done', () => {
      const histories = [
        makeTransition('Open', 'In Progress', '2025-01-02T09:00:00Z'),
      ];
      const issue = makeIssue('TEST-9', histories, {
        status: { name: 'In Progress' },
        resolutiondate: null,
      });
      const tl = extractTimeline(issue, classification);

      expect(tl.cycleTimeHours).toBeNull();
      expect(tl.leadTimeHours).toBeNull();
      expect(tl.flowEfficiency).toBeNull();
    });

    it('computes daysInCurrentStatus', () => {
      const histories = [
        makeTransition('Open', 'In Progress', '2025-01-02T09:00:00Z'),
      ];
      const issue = makeIssue('TEST-10', histories, {
        status: { name: 'In Progress' },
        resolutiondate: null,
      });
      const tl = extractTimeline(issue, classification);

      // daysInCurrentStatus should be > 0
      expect(tl.daysInCurrentStatus).toBeGreaterThan(0);
      expect(tl.currentStatus).toBe('In Progress');
    });
  });

  describe('computePercentiles', () => {
    it('computes p50/p85/p95 from values', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = computePercentiles(values);

      expect(result.p50).toBeCloseTo(5.5, 1);
      expect(result.p85).toBeCloseTo(8.65, 1);
      expect(result.p95).toBeCloseTo(9.55, 1);
    });

    it('returns 0 for empty array', () => {
      const result = computePercentiles([]);
      expect(result.p50).toBe(0);
      expect(result.p85).toBe(0);
      expect(result.p95).toBe(0);
    });

    it('handles single value', () => {
      const result = computePercentiles([42]);
      expect(result.p50).toBe(42);
      expect(result.p85).toBe(42);
      expect(result.p95).toBe(42);
    });

    it('supports custom percentiles', () => {
      const values = [10, 20, 30, 40, 50];
      const result = computePercentiles(values, [25, 75]);
      expect(result.p25).toBe(20);
      expect(result.p75).toBe(40);
    });
  });

  describe('computeWeeklyThroughput', () => {
    it('returns entries for specified number of weeks', () => {
      const result = computeWeeklyThroughput([], 4);
      expect(result).toHaveLength(4);
    });

    it('returns 8 weeks by default', () => {
      const result = computeWeeklyThroughput([]);
      expect(result).toHaveLength(8);
    });

    it('each entry has week label, count, and storyPoints', () => {
      const result = computeWeeklyThroughput([], 1);
      expect(result[0]).toHaveProperty('week');
      expect(result[0]).toHaveProperty('count');
      expect(result[0]).toHaveProperty('storyPoints');
    });
  });

  // --- Shared metric helper tests ---

  describe('computeSpAccuracy', () => {
    const makeTicket = (overrides: Partial<ProcessedTicket> = {}): ProcessedTicket => ({
      key: 'T-1', project_key: 'P', summary: 'test', status: 'Done', assignee: 'A',
      eng_hours: 8, tpd_bu: null, work_stream: null, has_computed_values: false,
      story_points: 1, issue_type: 'Story', priority: 'Medium',
      created: '2025-01-01T00:00:00Z', resolved: '2025-01-02T00:00:00Z',
      base_url: '', updated: null, assignee_id: 'a1', sprint_id: null, sprint_name: null, components: [],
      ...overrides,
    });

    it('returns 100 when actual equals estimated', () => {
      // SP=1, spToDays=1, estimated = 1*1*8 = 8h, eng_hours=8 → ratio = 100
      const result = computeSpAccuracy([makeTicket()], [], 1);
      expect(result).toBe(100);
    });

    it('returns >100 when under-estimated', () => {
      // eng_hours=16, estimated=8 → 200%
      const result = computeSpAccuracy([makeTicket({ eng_hours: 16 })], [], 1);
      expect(result).toBe(200);
    });

    it('returns null when no tickets have both SP and eng_hours', () => {
      const result = computeSpAccuracy([makeTicket({ story_points: null })], [], 1);
      expect(result).toBeNull();
    });

    it('skips tickets with zero SP', () => {
      const result = computeSpAccuracy([makeTicket({ story_points: 0 })], [], 1);
      expect(result).toBeNull();
    });

    it('averages across multiple tickets', () => {
      const t1 = makeTicket({ key: 'T-1', eng_hours: 8, story_points: 1 }); // 100%
      const t2 = makeTicket({ key: 'T-2', eng_hours: 16, story_points: 1 }); // 200%
      const result = computeSpAccuracy([t1, t2], [], 1);
      expect(result).toBe(150);
    });
  });

  describe('computeReviewDuration', () => {
    const makeTl = (periods: Array<{ status: string; durationHours: number; category: 'active' | 'wait' | 'blocked' | 'done' }>): TicketTimeline => ({
      key: 'T-1', statusPeriods: periods.map(p => ({ ...p, enteredAt: '2025-01-01T00:00:00Z', exitedAt: '2025-01-02T00:00:00Z' })),
      cycleTimeHours: 48, leadTimeHours: 72, activeTimeHours: 24, waitTimeHours: 24, blockedTimeHours: 0,
      flowEfficiency: 33, hasRework: false, reworkCount: 0, currentStatus: 'Done', daysInCurrentStatus: 0,
    });

    it('computes average review duration', () => {
      const tl = makeTl([
        { status: 'In Progress', durationHours: 24, category: 'active' },
        { status: 'Code Review', durationHours: 8, category: 'active' },
        { status: 'Done', durationHours: 0, category: 'done' },
      ]);
      const result = computeReviewDuration([tl]);
      expect(result).toBe(8);
    });

    it('returns null when no review periods exist', () => {
      const tl = makeTl([
        { status: 'In Progress', durationHours: 24, category: 'active' },
        { status: 'Done', durationHours: 0, category: 'done' },
      ]);
      const result = computeReviewDuration([tl]);
      expect(result).toBeNull();
    });

    it('matches review statuses case-insensitively', () => {
      const tl = makeTl([
        { status: 'IN REVIEW', durationHours: 12, category: 'active' },
      ]);
      const result = computeReviewDuration([tl]);
      expect(result).toBe(12);
    });
  });

  describe('computeTimeToFirstActivity', () => {
    it('computes average time from created to first active period', () => {
      const tl: TicketTimeline = {
        key: 'T-1',
        statusPeriods: [
          { status: 'Open', enteredAt: '2025-01-01T09:00:00Z', exitedAt: '2025-01-02T09:00:00Z', durationHours: 24, category: 'wait' },
          { status: 'In Progress', enteredAt: '2025-01-02T09:00:00Z', exitedAt: '2025-01-03T09:00:00Z', durationHours: 24, category: 'active' },
        ],
        cycleTimeHours: 24, leadTimeHours: 48, activeTimeHours: 24, waitTimeHours: 24, blockedTimeHours: 0,
        flowEfficiency: 50, hasRework: false, reworkCount: 0, currentStatus: 'Done', daysInCurrentStatus: 0,
      };
      const ticket: ProcessedTicket = {
        key: 'T-1', project_key: 'P', summary: 'test', status: 'Done', assignee: 'A',
        eng_hours: null, tpd_bu: null, work_stream: null, has_computed_values: false,
        story_points: null, issue_type: 'Story', priority: 'Medium',
        created: '2025-01-01T09:00:00Z', resolved: '2025-01-03T09:00:00Z',
        base_url: '', updated: null, assignee_id: 'a1', sprint_id: null, sprint_name: null, components: [],
      };
      const ticketMap = new Map([['T-1', ticket]]);
      const result = computeTimeToFirstActivity([tl], ticketMap);
      // Created Jan 1 09:00 → First active Jan 2 09:00 = 24 hours
      expect(result).toBe(24);
    });

    it('returns null when no active periods exist', () => {
      const tl: TicketTimeline = {
        key: 'T-1',
        statusPeriods: [{ status: 'Open', enteredAt: '2025-01-01T09:00:00Z', exitedAt: null, durationHours: 48, category: 'wait' }],
        cycleTimeHours: null, leadTimeHours: null, activeTimeHours: 0, waitTimeHours: 48, blockedTimeHours: 0,
        flowEfficiency: null, hasRework: false, reworkCount: 0, currentStatus: 'Open', daysInCurrentStatus: 2,
      };
      const ticket: ProcessedTicket = {
        key: 'T-1', project_key: 'P', summary: 'test', status: 'Open', assignee: 'A',
        eng_hours: null, tpd_bu: null, work_stream: null, has_computed_values: false,
        story_points: null, issue_type: 'Story', priority: 'Medium',
        created: '2025-01-01T09:00:00Z', resolved: null,
        base_url: '', updated: null, assignee_id: 'a1', sprint_id: null, sprint_name: null, components: [],
      };
      const result = computeTimeToFirstActivity([tl], new Map([['T-1', ticket]]));
      expect(result).toBeNull();
    });
  });

  describe('computeLeadTimeBreakdown', () => {
    const makeTl = (active: number, wait: number, blocked: number): TicketTimeline => ({
      key: 'T-1', statusPeriods: [],
      cycleTimeHours: active + wait + blocked, leadTimeHours: active + wait + blocked,
      activeTimeHours: active, waitTimeHours: wait, blockedTimeHours: blocked,
      flowEfficiency: 50, hasRework: false, reworkCount: 0, currentStatus: 'Done', daysInCurrentStatus: 0,
    });

    it('computes average breakdown percentages', () => {
      const tl = makeTl(40, 40, 20); // 100h total: 40% active, 40% wait, 20% blocked
      const result = computeLeadTimeBreakdown([tl]);
      expect(result).not.toBeNull();
      expect(result!.activePercent).toBe(40);
      expect(result!.waitPercent).toBe(40);
      expect(result!.blockedPercent).toBe(20);
    });

    it('returns null for empty timelines', () => {
      expect(computeLeadTimeBreakdown([])).toBeNull();
    });

    it('returns null when all lead times are zero', () => {
      const tl = makeTl(0, 0, 0);
      tl.leadTimeHours = 0;
      expect(computeLeadTimeBreakdown([tl])).toBeNull();
    });
  });

  describe('computeWorkTypeDistribution', () => {
    const makeTicket = (type: string): ProcessedTicket => ({
      key: 'T-1', project_key: 'P', summary: 'test', status: 'Done', assignee: 'A',
      eng_hours: null, tpd_bu: null, work_stream: null, has_computed_values: false,
      story_points: null, issue_type: type, priority: 'Medium',
      created: null, resolved: null, base_url: '', updated: null,
      assignee_id: null, sprint_id: null, sprint_name: null, components: [],
    });

    it('groups tickets by issue_type', () => {
      const tickets = [makeTicket('Story'), makeTicket('Story'), makeTicket('Bug')];
      const result = computeWorkTypeDistribution(tickets);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('Story');
      expect(result[0].count).toBe(2);
      expect(result[0].percentage).toBeCloseTo(66.67, 0);
      expect(result[1].type).toBe('Bug');
      expect(result[1].count).toBe(1);
    });

    it('returns empty array for no tickets', () => {
      expect(computeWorkTypeDistribution([])).toHaveLength(0);
    });
  });
});
