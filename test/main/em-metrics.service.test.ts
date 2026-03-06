import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config
vi.mock('../../src/main/services/config.service.js', () => ({
  getConfig: vi.fn(() => ({
    tracked_engineers: [],
    sp_to_days: 1,
    active_statuses: ['In Progress'],
    blocked_statuses: ['Blocked'],
    done_statuses: ['Done'],
  })),
}));

// Mock ticket service
vi.mock('../../src/main/services/ticket.service.js', () => ({
  getTickets: vi.fn(),
  getRawIssues: vi.fn(() => ({})),
}));

// Mock timeline service
vi.mock('../../src/main/services/timeline.service.js', () => ({
  getTimelines: vi.fn(),
  computeSpAccuracy: vi.fn(() => 80),
  computeReviewDuration: vi.fn(() => 2),
  computeLeadTimeBreakdown: vi.fn(() => ({ activePercent: 60, waitPercent: 30, blockedPercent: 10 })),
  computeWorkTypeDistribution: vi.fn(() => [{ type: 'Story', count: 1, percentage: 100 }]),
  computePercentiles: vi.fn(() => ({ p50: 10, p85: 20, p95: 30 })),
}));

import { getEmTeamMetrics, getEmIndividualMetrics } from '../../src/main/services/em-metrics.service.js';
import { getTickets } from '../../src/main/services/ticket.service.js';
import { getTimelines } from '../../src/main/services/timeline.service.js';

function makeTicket(key: string, overrides: any = {}) {
  return {
    key,
    assignee: 'Alice',
    assignee_id: 'a1',
    status: 'Done',
    issue_type: 'Story',
    story_points: 3,
    resolved: '2025-01-10T10:00:00Z',
    work_stream: 'Product',
    ...overrides,
  };
}

describe('em-metrics.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEmTeamMetrics', () => {
    it('returns team summary', () => {
      vi.mocked(getTickets).mockReturnValue([makeTicket('T-1')]);
      vi.mocked(getTimelines).mockReturnValue([{ key: 'T-1', cycleTimeHours: 10, statusPeriods: [] }] as any);

      const res = getEmTeamMetrics('all');
      expect(res.totalTickets).toBe(1);
      expect(res.cycleTime.p50).toBe(10);
    });
  });

  describe('getEmIndividualMetrics', () => {
    it('returns per-engineer metrics', () => {
      vi.mocked(getTickets).mockReturnValue([makeTicket('T-1')]);
      vi.mocked(getTimelines).mockReturnValue([{ key: 'T-1', cycleTimeHours: 10, statusPeriods: [] }] as any);

      const res = getEmIndividualMetrics('all');
      expect(res.engineers).toHaveLength(1);
      expect(res.engineers[0].displayName).toBe('Alice');
      expect(res.engineers[0].cycleTimeP50).toBe(10);
    });
  });
});
