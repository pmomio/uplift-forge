import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ticket service
vi.mock('../../src/main/services/ticket.service.js', () => ({
  getAllTickets: vi.fn(() => []),
}));

// Mock timeline service
vi.mock('../../src/main/services/timeline.service.js', () => ({
  getTimelines: vi.fn(() => []),
}));

// Mock config service
vi.mock('../../src/main/services/config.service.js', () => ({
  getConfig: vi.fn(() => ({
    aging_thresholds: { warning_days: 5, critical_days: 10, escalation_days: 15 },
    done_statuses: ['Done', 'Resolved', 'Closed'],
    blocked_statuses: ['Blocked'],
    active_statuses: ['In Progress', 'Code Review', 'QA'],
    bug_type_names: ['bug', 'defect'],
  })),
}));

import { getEpicSummaries, getEpicDetail } from '../../src/main/services/epic.service.js';
import { getAllTickets } from '../../src/main/services/ticket.service.js';
import { getTimelines } from '../../src/main/services/timeline.service.js';
import { getConfig } from '../../src/main/services/config.service.js';
import type { ProcessedTicket, TicketTimeline } from '../../src/shared/types.js';

const mockGetAllTickets = vi.mocked(getAllTickets);
const mockGetTimelines = vi.mocked(getTimelines);
const mockGetConfig = vi.mocked(getConfig);

function makeTicket(overrides: Partial<ProcessedTicket> = {}): ProcessedTicket {
  return {
    key: 'T-1',
    project_key: 'PROJ',
    summary: 'Test ticket',
    status: 'In Progress',
    assignee: 'Alice',
    assignee_id: 'a1',
    issue_type: 'Story',
    story_points: 3,
    eng_hours: null,
    tpd_bu: null,
    work_stream: null,
    resolved: null,
    created: null,
    updated: null,
    priority: 'Medium',
    base_url: 'https://jira.test',
    has_computed_values: false,
    parent_key: undefined,
    parent_summary: undefined,
    labels: [],
    sprint_id: null,
    sprint_name: null,
    components: [],
    ...overrides,
  };
}

function makeTimeline(overrides: Partial<TicketTimeline> = {}): TicketTimeline {
  return {
    key: 'T-1',
    statusPeriods: [],
    cycleTimeHours: null,
    leadTimeHours: null,
    activeTimeHours: 0,
    waitTimeHours: 0,
    blockedTimeHours: 0,
    flowEfficiency: null,
    hasRework: false,
    reworkCount: 0,
    currentStatus: 'In Progress',
    daysInCurrentStatus: 0,
    ...overrides,
  };
}

describe('epic.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTimelines.mockReturnValue([]);
    mockGetConfig.mockReturnValue({
      aging_thresholds: { warning_days: 5, critical_days: 10, escalation_days: 15 },
      done_statuses: ['Done', 'Resolved', 'Closed'],
      blocked_statuses: ['Blocked'],
      active_statuses: ['In Progress', 'Code Review', 'QA'],
      bug_type_names: ['bug', 'defect'],
    } as any);
  });

  describe('getEpicSummaries', () => {
    it('returns empty array when no tickets have parent_key', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1' }),
        makeTicket({ key: 'T-2' }),
      ]);
      const result = getEpicSummaries();
      expect(result).toEqual([]);
    });

    it('groups tickets by parent_key', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'Epic One' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'Epic One' }),
        makeTicket({ key: 'T-3', parent_key: 'EPIC-2', parent_summary: 'Epic Two' }),
      ]);
      const result = getEpicSummaries();
      expect(result).toHaveLength(2);
      const keys = result.map(e => e.key);
      expect(keys).toContain('EPIC-1');
      expect(keys).toContain('EPIC-2');
    });

    it('computes totalTickets and resolvedTickets correctly', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'Epic', status: 'In Progress' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'Epic', status: 'Done' }),
        makeTicket({ key: 'T-3', parent_key: 'EPIC-1', parent_summary: 'Epic', status: 'Resolved' }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.totalTickets).toBe(3);
      expect(epic.resolvedTickets).toBe(2);
    });

    it('computes totalSP and resolvedSP correctly', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress', story_points: 5 }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done', story_points: 3 }),
        makeTicket({ key: 'T-3', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done', story_points: 8 }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.totalSP).toBe(16);
      expect(epic.resolvedSP).toBe(11);
    });

    it('computes progressPct correctly', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
        makeTicket({ key: 'T-3', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
        makeTicket({ key: 'T-4', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.progressPct).toBe(0.25);
    });

    it('computes avgCycleTime from timeline cycleTimeHours', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
        makeTicket({ key: 'T-3', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
      ]);
      mockGetTimelines.mockReturnValue([
        makeTimeline({ key: 'T-1', cycleTimeHours: 24 }),
        makeTimeline({ key: 'T-2', cycleTimeHours: 48 }),
        makeTimeline({ key: 'T-3', cycleTimeHours: null, activeTimeHours: 10 }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.avgCycleTime).toBe(36); // (24 + 48) / 2
    });

    it('returns null avgCycleTime when no resolved tickets have timeline cycle time', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
      ]);
      mockGetTimelines.mockReturnValue([
        makeTimeline({ key: 'T-1', cycleTimeHours: null }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.avgCycleTime).toBeNull();
    });

    it('computes inProgressTickets count', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
        makeTicket({ key: 'T-3', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Code Review' }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.inProgressTickets).toBe(2);
    });

    it('computes avgLeadTime from timeline', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
      ]);
      mockGetTimelines.mockReturnValue([
        makeTimeline({ key: 'T-1', leadTimeHours: 100 }),
        makeTimeline({ key: 'T-2', leadTimeHours: 200 }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.avgLeadTime).toBe(150);
    });

    it('computes reworkCount from timelines', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
      ]);
      mockGetTimelines.mockReturnValue([
        makeTimeline({ key: 'T-1', reworkCount: 2, hasRework: true }),
        makeTimeline({ key: 'T-2', reworkCount: 1, hasRework: true }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.reworkCount).toBe(3);
    });

    it('computes agingWipCount from timelines', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
        makeTicket({ key: 'T-3', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
      ]);
      mockGetTimelines.mockReturnValue([
        makeTimeline({ key: 'T-1', daysInCurrentStatus: 7 }), // >= 5 → aging
        makeTimeline({ key: 'T-2', daysInCurrentStatus: 2 }), // < 5 → not aging
        makeTimeline({ key: 'T-3', daysInCurrentStatus: 20 }), // Done → not counted
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.agingWipCount).toBe(1);
    });

    it('computes avgFlowEfficiency from resolved timelines', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
      ]);
      mockGetTimelines.mockReturnValue([
        makeTimeline({ key: 'T-1', flowEfficiency: 60 }),
        makeTimeline({ key: 'T-2', flowEfficiency: 80 }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.avgFlowEfficiency).toBe(70);
    });

    it('assigns low risk for high progress', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
        makeTicket({ key: 'T-3', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.riskLevel).toBe('low');
      expect(epic.riskScore).toBeLessThanOrEqual(0.3);
    });

    it('assigns higher risk for low progress', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
        makeTicket({ key: 'T-3', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
        makeTicket({ key: 'T-4', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      // 0% progress → factor = 1.0 * 0.25 = 0.25
      expect(epic.riskScore).toBeGreaterThan(0);
      expect(epic.riskFactors.length).toBeGreaterThan(0);
    });

    it('includes blocked factor using timeline blockedTimeHours', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
      ]);
      mockGetTimelines.mockReturnValue([
        makeTimeline({ key: 'T-1', blockedTimeHours: 10 }),
        makeTimeline({ key: 'T-2', blockedTimeHours: 0 }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.riskFactors.some(f => f.includes('blocked'))).toBe(true);
    });

    it('falls back to status string for blocked when no timeline', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Blocked' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
      ]);
      // No timelines → fallback to status string matching
      mockGetTimelines.mockReturnValue([]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.riskFactors.some(f => f.includes('blocked'))).toBe(true);
    });

    it('includes bug factor when bug ratio is high', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress', issue_type: 'Bug' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress', issue_type: 'Bug' }),
        makeTicket({ key: 'T-3', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress', issue_type: 'Story' }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.riskFactors.some(f => f.includes('Bug ratio'))).toBe(true);
    });

    it('includes rework factor from timeline data', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
      ]);
      mockGetTimelines.mockReturnValue([
        makeTimeline({ key: 'T-1', hasRework: true, reworkCount: 2 }),
        makeTimeline({ key: 'T-2', hasRework: false, reworkCount: 0 }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.riskFactors.some(f => f.includes('rework'))).toBe(true);
    });

    it('includes aging WIP factor from timeline data', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
      ]);
      mockGetTimelines.mockReturnValue([
        makeTimeline({ key: 'T-1', daysInCurrentStatus: 10 }), // >= 5 threshold
        makeTimeline({ key: 'T-2', daysInCurrentStatus: 10 }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.riskFactors.some(f => f.includes('aging'))).toBe(true);
    });

    it('includes reopen factor for tickets with resolved date but not final', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress', resolved: '2025-01-01' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.riskFactors.some(f => f.includes('reopened'))).toBe(true);
    });

    it('uses overdue factor from timeline activeTimeHours for WIP tickets', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
      ]);
      mockGetTimelines.mockReturnValue([
        makeTimeline({ key: 'T-1', cycleTimeHours: 10 }),
        makeTimeline({ key: 'T-2', cycleTimeHours: null, activeTimeHours: 25 }), // > 2x avg (10)
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.riskFactors.some(f => f.includes('exceeded 2x'))).toBe(true);
    });

    it('sorts epics by riskScore descending', () => {
      mockGetAllTickets.mockReturnValue([
        // EPIC-1: all done → low risk
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'Low Risk', status: 'Done' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'Low Risk', status: 'Done' }),
        // EPIC-2: all in progress → higher risk
        makeTicket({ key: 'T-3', parent_key: 'EPIC-2', parent_summary: 'High Risk', status: 'In Progress' }),
        makeTicket({ key: 'T-4', parent_key: 'EPIC-2', parent_summary: 'High Risk', status: 'In Progress' }),
      ]);
      const result = getEpicSummaries();
      expect(result[0].key).toBe('EPIC-2');
      expect(result[1].key).toBe('EPIC-1');
    });

    it('uses parent_key as summary when parent_summary is missing', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: undefined }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.summary).toBe('EPIC-1');
    });

    it('includes childTickets in the result', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E' }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.childTickets).toHaveLength(2);
      expect(epic.childTickets.map(t => t.key)).toEqual(['T-1', 'T-2']);
    });

    it('handles null story_points gracefully', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', story_points: null }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', story_points: 5 }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.totalSP).toBe(5);
    });

    it('defaults agingThresholdDays to 5 when no config', () => {
      mockGetConfig.mockReturnValue({
        done_statuses: ['Done', 'Resolved', 'Closed'],
        blocked_statuses: ['Blocked'],
        active_statuses: ['In Progress', 'Code Review', 'QA'],
        bug_type_names: ['bug', 'defect'],
      } as any);
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
      ]);
      mockGetTimelines.mockReturnValue([
        makeTimeline({ key: 'T-1', daysInCurrentStatus: 6 }), // >= 5 default
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.agingWipCount).toBe(1);
    });
  });

  describe('getEpicDetail', () => {
    it('returns specific epic by key', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'Target Epic' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-2', parent_summary: 'Other Epic' }),
      ]);
      const detail = getEpicDetail('EPIC-1');
      expect(detail).not.toBeNull();
      expect(detail!.key).toBe('EPIC-1');
      expect(detail!.summary).toBe('Target Epic');
    });

    it('returns null for unknown epic key', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E' }),
      ]);
      const detail = getEpicDetail('EPIC-999');
      expect(detail).toBeNull();
    });
  });

  describe('cross-project support', () => {
    it('passes projectKey to getAllTickets when provided', () => {
      mockGetAllTickets.mockReturnValue([]);
      getEpicSummaries('PROJ-A');
      expect(mockGetAllTickets).toHaveBeenCalledWith('PROJ-A');
    });

    it('calls getAllTickets without projectKey for cross-project aggregation', () => {
      mockGetAllTickets.mockReturnValue([]);
      getEpicSummaries();
      expect(mockGetAllTickets).toHaveBeenCalledWith(undefined);
    });

    it('passes projectKey to getAllTickets in getEpicDetail', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E' }),
      ]);
      getEpicDetail('EPIC-1', 'PROJ-B');
      expect(mockGetAllTickets).toHaveBeenCalledWith('PROJ-B');
    });

    it('passes projectKey to getTimelines when provided', () => {
      mockGetAllTickets.mockReturnValue([]);
      getEpicSummaries('PROJ-A');
      expect(mockGetTimelines).toHaveBeenCalledWith('PROJ-A');
    });

    it('groups tickets from different project keys under same epic', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'PROJ-A-1', parent_key: 'EPIC-1', parent_summary: 'Shared Epic' }),
        makeTicket({ key: 'PROJ-B-1', parent_key: 'EPIC-1', parent_summary: 'Shared Epic' }),
      ]);
      const result = getEpicSummaries();
      expect(result).toHaveLength(1);
      expect(result[0].childTickets).toHaveLength(2);
    });
  });
});
