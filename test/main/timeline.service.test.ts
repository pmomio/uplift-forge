import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config
vi.mock('../../src/main/services/config.service.js', () => ({
  getConfig: vi.fn(() => ({
    active_statuses: ['In Progress', 'Code Review'],
    blocked_statuses: ['Blocked'],
    done_statuses: ['Done', 'Resolved'],
  })),
}));

// Mock ticket service
vi.mock('../../src/main/services/ticket.service.js', () => ({
  getRawIssues: vi.fn(),
}));

import { extractTimeline, classifyStatus, computeSpAccuracy } from '../../src/main/services/timeline.service.js';

describe('timeline.service', () => {
  describe('classifyStatus', () => {
    it('identifies active statuses', () => {
      expect(classifyStatus('In Progress')).toBe('active');
      expect(classifyStatus('Code Review')).toBe('active');
    });

    it('identifies blocked statuses', () => {
      expect(classifyStatus('Blocked')).toBe('blocked');
    });

    it('identifies done statuses', () => {
      expect(classifyStatus('Done')).toBe('done');
      expect(classifyStatus('Resolved')).toBe('done');
    });

    it('defaults to wait for unknown statuses', () => {
      expect(classifyStatus('To Do')).toBe('wait');
      expect(classifyStatus('Backlog')).toBe('wait');
    });
  });

  describe('extractTimeline', () => {
    const rawIssue = {
      key: 'T-1',
      fields: {
        created: '2025-01-01T10:00:00Z',
        resolutiondate: '2025-01-02T10:00:00Z',
        status: { name: 'Done' },
      },
      changelog: {
        histories: [
          {
            created: '2025-01-01T12:00:00Z',
            items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress' }],
          },
          {
            created: '2025-01-01T14:00:00Z',
            items: [{ field: 'status', fromString: 'In Progress', toString: 'Done' }],
          },
        ],
      },
    };

    it('computes cycle time from first active to done', () => {
      const tl = extractTimeline(rawIssue as any);
      expect(tl.cycleTimeHours).toBe(2); // 12:00 to 14:00
    });

    it('computes lead time from created to done', () => {
      const tl = extractTimeline(rawIssue as any);
      expect(tl.leadTimeHours).toBe(4); // 10:00 to 14:00
    });

    it('detects rework', () => {
      const withRework = {
        ...rawIssue,
        changelog: {
          histories: [
            ...rawIssue.changelog.histories,
            {
              created: '2025-01-01T15:00:00Z',
              items: [{ field: 'status', fromString: 'Done', toString: 'In Progress' }],
            },
          ],
        },
      };
      const tl = extractTimeline(withRework as any);
      expect(tl.hasRework).toBe(true);
      expect(tl.reworkCount).toBe(1);
    });
  });

  describe('computeSpAccuracy', () => {
    it('calculates accuracy using activeTimeHours', () => {
      const tickets = [
        { key: 'T-1', story_points: 1 } as any,
      ];
      const timelines = [
        { key: 'T-1', activeTimeHours: 4 } as any, // 1 SP = 8h, so 4h = 50% accuracy
      ];
      
      const accuracy = computeSpAccuracy(tickets, timelines, 1);
      expect(accuracy).toBe(50);
    });

    it('returns null if no tickets have SP and active time', () => {
      const accuracy = computeSpAccuracy([], [], 1);
      expect(accuracy).toBeNull();
    });
  });
});
