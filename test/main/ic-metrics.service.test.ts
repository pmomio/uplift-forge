import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config
vi.mock('../../src/main/services/config.service.js', () => ({
  getConfig: vi.fn(() => ({
    my_account_id: 'a1',
    active_statuses: ['In Progress'],
    blocked_statuses: ['Blocked'],
    done_statuses: ['Done'],
    personal_goals: { cycle_time: 24, throughput: 2 },
    sp_to_days: 1,
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
  computeSpAccuracy: vi.fn(() => 90),
  computePercentiles: vi.fn(() => ({ p50: 12, p85: 48, p95: 72 })),
}));

import { getIcPersonalMetrics } from '../../src/main/services/ic-metrics.service.js';
import { getTickets } from '../../src/main/services/ticket.service.js';
import { getTimelines } from '../../src/main/services/timeline.service.js';
import { getConfig } from '../../src/main/services/config.service.js';

function makeTicket(key: string, overrides: any = {}) {
  return {
    key,
    assignee_id: 'a1',
    status: 'Done',
    issue_type: 'Story',
    story_points: 3,
    resolved: '2025-01-10T10:00:00Z',
    ...overrides,
  };
}

function makeTimeline(key: string) {
  return {
    key,
    cycleTimeHours: 12,
    activeTimeHours: 10,
    hasRework: false,
    daysInCurrentStatus: 2,
    statusPeriods: [{ status: 'Done', category: 'done', enteredAt: '2025-01-10T10:00:00Z', durationHours: 0 }],
  };
}

describe('ic-metrics.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters to my tickets (my_account_id = a1)', () => {
    const tickets = [
      makeTicket('MY-1', { assignee_id: 'a1' }),
      makeTicket('OTHER-1', { assignee_id: 'other' }),
    ];
    vi.mocked(getTickets).mockReturnValue(tickets);
    vi.mocked(getTimelines).mockReturnValue([makeTimeline('MY-1')] as any);

    const res = getIcPersonalMetrics('all');
    expect(res.totalTickets).toBe(1);
    expect(res.cycleTimeP50).toBe(12);
  });

  it('returns error if my_account_id missing', () => {
    vi.mocked(getConfig).mockReturnValue({ my_account_id: null } as any);
    
    const res = getIcPersonalMetrics('all');
    expect(res.error).toBeDefined();
  });
});
