import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config
vi.mock('../../src/main/services/config.service.js', () => ({
  getConfig: vi.fn(() => ({
    sp_to_days: 1,
  })),
}));

// Mock ticket service
vi.mock('../../src/main/services/ticket.service.js', () => ({
  getTickets: vi.fn(),
}));

// Mock timeline service
vi.mock('../../src/main/services/timeline.service.js', () => ({
  getTimelines: vi.fn(),
  computeSpAccuracy: vi.fn(() => 85),
}));

import { getTeamMetrics, getIndividualMetrics } from '../../src/main/services/metrics.service.js';
import { getTickets } from '../../src/main/services/ticket.service.js';
import { getTimelines } from '../../src/main/services/timeline.service.js';

function makeTicket(key: string, overrides: any = {}) {
  return {
    key,
    summary: `Summary ${key}`,
    status: 'Done',
    assignee: 'Alice',
    assignee_id: 'a1',
    story_points: 3,
    issue_type: 'Story',
    resolved: '2025-01-10T10:00:00Z',
    updated: '2025-01-10T12:00:00Z',
    ...overrides,
  };
}

function makeTimeline(key: string, cycleTime = 24) {
  return {
    key,
    cycleTimeHours: cycleTime,
    statusPeriods: [{ category: 'done', enteredAt: '2025-01-10T10:00:00Z' }],
  };
}

describe('metrics.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTeamMetrics', () => {
    it('aggregates summary metrics', () => {
      const tickets = [
        makeTicket('T-1', { story_points: 5 }),
        makeTicket('T-2', { story_points: 3, issue_type: 'Bug' }),
      ];
      const timelines = [
        makeTimeline('T-1', 10),
        makeTimeline('T-2', 20),
      ];
      vi.mocked(getTickets).mockReturnValue(tickets);
      vi.mocked(getTimelines).mockReturnValue(timelines as any);

      const res = getTeamMetrics('all');
      expect(res.summary.total_tickets).toBe(2);
      expect(res.summary.total_story_points).toBe(8);
      expect(res.summary.bug_count).toBe(1);
      expect(res.summary.bug_ratio).toBe(50);
      expect(res.summary.avg_cycle_time_hours).toBe(15);
    });

    it('computes monthly trend', () => {
      const tickets = [
        makeTicket('T-1', { resolved: '2025-01-01T10:00:00Z', story_points: 5 }),
        makeTicket('T-2', { resolved: '2025-02-01T10:00:00Z', story_points: 3 }),
      ];
      vi.mocked(getTickets).mockReturnValue(tickets);
      vi.mocked(getTimelines).mockReturnValue([]);

      const res = getTeamMetrics('all');
      expect(res.monthly_trend).toHaveLength(2);
      expect(res.monthly_trend[0].month).toBe('2025-01');
      expect(res.monthly_trend[1].month).toBe('2025-02');
    });
  });

  describe('getIndividualMetrics', () => {
    it('groups metrics by engineer', () => {
      const tickets = [
        makeTicket('T-1', { assignee: 'Alice', assignee_id: 'a1', story_points: 5 }),
        makeTicket('T-2', { assignee: 'Bob', assignee_id: 'b1', story_points: 3 }),
      ];
      vi.mocked(getTickets).mockReturnValue(tickets);
      vi.mocked(getTimelines).mockReturnValue([
        makeTimeline('T-1', 10),
        makeTimeline('T-2', 20),
      ] as any);

      const res = getIndividualMetrics('all');
      expect(res.engineers).toHaveLength(2);
      
      const alice = res.engineers.find(e => e.displayName === 'Alice');
      expect(alice?.metrics.total_tickets).toBe(1);
      expect(alice?.metrics.total_story_points).toBe(5);
      expect(alice?.metrics.avg_cycle_time_hours).toBe(10);
    });

    it('calculates team averages', () => {
      const tickets = [
        makeTicket('T-1', { assignee: 'Alice', story_points: 10 }),
        makeTicket('T-2', { assignee: 'Bob', story_points: 20 }),
      ];
      vi.mocked(getTickets).mockReturnValue(tickets);
      vi.mocked(getTimelines).mockReturnValue([]);

      const res = getIndividualMetrics('all');
      expect(res.team_averages.total_story_points).toBe(30);
    });
  });
});
