import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config
vi.mock('../../src/main/services/config.service.js', () => ({
  getConfig: vi.fn(() => ({
    active_statuses: ['In Progress'],
    blocked_statuses: ['Blocked'],
    done_statuses: ['Done'],
  })),
}));

// Mock ticket service
vi.mock('../../src/main/services/ticket.service.js', () => ({
  getAllTickets: vi.fn(() => []),
  FINAL_STATUSES: ['Done', 'Resolved', 'Closed'],
}));

// Mock timeline service
vi.mock('../../src/main/services/timeline.service.js', () => ({
  getTimelines: vi.fn(() => []),
}));

import { getEpicSummaries, getEpicDetail } from '../../src/main/services/epic.service.js';
import { getAllTickets } from '../../src/main/services/ticket.service.js';
import { getTimelines } from '../../src/main/services/timeline.service.js';
import type { ProcessedTicket, TicketTimeline } from '../../src/shared/types.js';

const mockGetAllTickets = vi.mocked(getAllTickets);
const mockGetTimelines = vi.mocked(getTimelines);

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
    tpd_bu: null,
    work_stream: null,
    resolved: null,
    created: '2025-01-01T10:00:00Z',
    updated: '2025-01-01T10:00:00Z',
    base_url: 'https://jira.test',
    has_computed_values: false,
    parent_key: undefined,
    parent_summary: undefined,
    sprint_id: null,
    sprint_name: null,
    components: [],
    ...overrides,
  };
}

function makeTimeline(key: string, cycleTimeHours: number | null = 10, activeTimeHours = 8): TicketTimeline {
  return {
    key,
    cycleTimeHours,
    activeTimeHours,
    waitTimeHours: 2,
    blockedTimeHours: 0,
    flowEfficiency: 80,
    hasRework: false,
    reworkCount: 0,
    statusPeriods: [],
    currentStatus: 'Done',
    daysInCurrentStatus: 0,
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
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', status: 'In Progress' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', status: 'Done' }),
        makeTicket({ key: 'T-3', parent_key: 'EPIC-1', status: 'Resolved' }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.totalTickets).toBe(3);
      expect(epic.resolvedTickets).toBe(2);
    });

    it('computes totalSP and resolvedSP correctly', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', status: 'In Progress', story_points: 5 }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', status: 'Done', story_points: 3 }),
        makeTicket({ key: 'T-3', parent_key: 'EPIC-1', status: 'Done', story_points: 8 }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.totalSP).toBe(16);
      expect(epic.resolvedSP).toBe(11);
    });

    it('computes avgCycleTime from timelines', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', status: 'Done' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', status: 'Done' }),
      ]);
      mockGetTimelines.mockReturnValue([
        makeTimeline('T-1', 10),
        makeTimeline('T-2', 20),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.avgCycleTime).toBe(15);
    });

    it('includes blocked factor in risk', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', status: 'Blocked' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', status: 'In Progress' }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.riskFactors.some(f => f.toLowerCase().includes('blocked'))).toBe(true);
    });

    it('includes bug factor when bug ratio is high', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', issue_type: 'Bug' }),
        makeTicket({ key: 'T-2', parent_key: 'EPIC-1', issue_type: 'Bug' }),
        makeTicket({ key: 'T-3', parent_key: 'EPIC-1', issue_type: 'Story' }),
      ]);
      const epic = getEpicSummaries().find(e => e.key === 'EPIC-1')!;
      expect(epic.riskFactors.some(f => f.toLowerCase().includes('bug'))).toBe(true);
    });
  });

  describe('getEpicDetail', () => {
    it('returns specific epic by key', () => {
      mockGetAllTickets.mockReturnValue([
        makeTicket({ key: 'T-1', parent_key: 'EPIC-1', parent_summary: 'Target Epic' }),
      ]);
      const detail = getEpicDetail('EPIC-1');
      expect(detail).not.toBeNull();
      expect(detail!.key).toBe('EPIC-1');
    });
  });
});
