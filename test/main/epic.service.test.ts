import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ticket service
vi.mock('../../src/main/services/ticket.service.js', () => ({
  getAllTickets: vi.fn(() => []),
  FINAL_STATUSES: ['Done', 'Resolved', 'Closed'],
}));

import { getEpicSummaries, getEpicDetail } from '../../src/main/services/epic.service.js';
import { getAllTickets } from '../../src/main/services/ticket.service.js';
import type { ProcessedTicket } from '../../src/shared/types.js';

const mockGetAllTickets = vi.mocked(getAllTickets);

function makeTicket(overrides: Partial<ProcessedTicket> = {}): ProcessedTicket {
  return {
    key: 'T-1',
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
    has_computed_values: false,
    parent_key: undefined,
    parent_summary: undefined,
    ...overrides,
  };
}

describe('epic.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it('computes avgCycleTime from resolved tickets with eng_hours', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done', eng_hours: 10 }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done', eng_hours: 20 }),
        makeTicket({ key: 'T-3', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress', eng_hours: 5 }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.avgCycleTime).toBe(15); // (10 + 20) / 2
    });

    it('returns null avgCycleTime when no resolved tickets have hours', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done', eng_hours: null }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.avgCycleTime).toBeNull();
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
      // 0% progress → factor = 1.0 * 0.3 = 0.3 → medium or high
      expect(epic.riskScore).toBeGreaterThan(0);
      expect(epic.riskFactors.length).toBeGreaterThan(0);
    });

    it('includes blocked factor in risk', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Blocked' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress' }),
      ]);
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

    it('includes reopen factor for tickets with resolved date but not final', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'E', status: 'In Progress', resolved: '2025-01-01' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'E', status: 'Done' }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.riskFactors.some(f => f.includes('reopened'))).toBe(true);
    });

    it('sorts epics by riskScore descending', () => {
      mockGetAllTickets.mockReturnValue([
        // EPIC-1: all done → low risk
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'Low Risk', status: 'Done' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', parent_summary: 'Low Risk', status: 'Done' }),
        // EPIC-2: all in progress → higher risk
        makeTicket({ key: 'T-3', parent_key: 'EPIC-2', parent_summary: 'High Risk', status: 'In Progress' }),
        makeTicket({ key: 'T-4', parent_key: 'EPIC-2', parent_summary: 'High Risk', status: 'Blocked' }),
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
