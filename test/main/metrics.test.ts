import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron-store
const mockData: Record<string, unknown> = {
  eng_start_status: 'In Progress',
  eng_end_status: 'In Review',
  eng_excluded_statuses: ['Blocked'],
  office_hours: { start: '09:00', end: '18:00', timezone: 'Europe/Berlin', exclude_weekends: true },
  mapping_rules: { tpd_bu: {}, work_stream: {} },
  field_ids: { tpd_bu: '', eng_hours: '', work_stream: '', story_points: '' },
  project_key: 'TEST',
  ticket_filter: { mode: 'last_x_months', months: 6 },
  sp_to_days: 1,
  tracked_engineers: [
    { accountId: '1', displayName: 'Alice' },
    { accountId: '2', displayName: 'Bob' },
  ],
  ticketCache: {},
  rawIssueCache: {},
};

vi.mock('electron-store', () => ({
  default: class MockStore {
    constructor() {}
    get(key: string) { return mockData[key]; }
    set(key: string, value: unknown) { mockData[key] = value; }
  },
}));

// Mock jira service
vi.mock('../../src/main/services/jira.service', () => ({
  getIssues: vi.fn(),
  searchIssues: vi.fn(),
  getIssueChangelog: vi.fn(),
  updateIssueFields: vi.fn(),
}));

import { getTeamMetrics, getIndividualMetrics } from '../../src/main/services/metrics.service';
import type { ProcessedTicket } from '../../src/shared/types';

// We need to inject tickets into the cache. Since ticket.service uses getTickets internally,
// we'll mock it.
vi.mock('../../src/main/services/ticket.service', async (importOriginal) => {
  let tickets: ProcessedTicket[] = [];
  return {
    FINAL_STATUSES: ['Done', 'Rejected', 'Closed', 'Resolved', 'Cancelled'],
    getTickets: () => tickets,
    __setTickets: (t: ProcessedTicket[]) => { tickets = t; },
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { __setTickets } = await import('../../src/main/services/ticket.service') as any;

function makeTicket(overrides: Partial<ProcessedTicket> = {}): ProcessedTicket {
  return {
    key: 'TEST-1',
    summary: 'Test ticket',
    status: 'Done',
    assignee: 'Alice',
    eng_hours: 8,
    tpd_bu: 'B2C',
    work_stream: 'Product',
    has_computed_values: false,
    story_points: 3,
    issue_type: 'Story',
    priority: 'Medium',
    created: '2026-02-01T10:00:00+01:00',
    resolved: '2026-02-20T16:00:00+01:00',
    base_url: '',
    updated: '2026-02-20T16:00:00+01:00',
    ...overrides,
  };
}

describe('getTeamMetrics', () => {
  beforeEach(() => {
    (__setTickets as Function)([]);
  });

  it('returns empty when no tickets', () => {
    const result = getTeamMetrics('all');
    expect(result.period).toBe('all');
    expect(result.monthly_trend).toEqual([]);
  });

  it('computes summary for all tickets', () => {
    (__setTickets as Function)([
      makeTicket({ key: 'T-1', eng_hours: 10, story_points: 2, issue_type: 'Story' }),
      makeTicket({ key: 'T-2', eng_hours: 6, story_points: 1, issue_type: 'Bug' }),
    ]);

    const result = getTeamMetrics('all');
    expect(result.summary.total_tickets).toBe(2);
    expect(result.summary.total_story_points).toBe(3);
    expect(result.summary.total_eng_hours).toBe(16);
    expect(result.summary.bug_count).toBe(1);
    expect(result.summary.bug_ratio).toBe(0.5);
  });

  it('computes business unit breakdown', () => {
    (__setTickets as Function)([
      makeTicket({ key: 'T-1', tpd_bu: 'B2C', eng_hours: 10 }),
      makeTicket({ key: 'T-2', tpd_bu: 'B2B', eng_hours: 5 }),
    ]);

    const result = getTeamMetrics('all');
    expect(result.by_business_unit['B2C'].eng_hours).toBe(10);
    expect(result.by_business_unit['B2B'].eng_hours).toBe(5);
  });

  it('computes monthly trend', () => {
    (__setTickets as Function)([
      makeTicket({ key: 'T-1', resolved: '2026-01-15T10:00:00Z', eng_hours: 5 }),
      makeTicket({ key: 'T-2', resolved: '2026-02-15T10:00:00Z', eng_hours: 8 }),
    ]);

    const result = getTeamMetrics('all');
    expect(result.monthly_trend.length).toBe(2);
    expect(result.monthly_trend[0].month).toBe('2026-01');
    expect(result.monthly_trend[1].month).toBe('2026-02');
  });

  it('handles null eng_hours', () => {
    (__setTickets as Function)([
      makeTicket({ key: 'T-1', eng_hours: null, story_points: null }),
    ]);

    const result = getTeamMetrics('all');
    expect(result.summary.total_eng_hours).toBe(0);
    expect(result.summary.avg_eng_hours_per_sp).toBeNull();
  });
});

describe('getIndividualMetrics', () => {
  beforeEach(() => {
    (__setTickets as Function)([]);
  });

  it('returns empty when no tracked engineers', () => {
    mockData.tracked_engineers = [];
    const result = getIndividualMetrics('all');
    expect(result.engineers).toEqual([]);
    mockData.tracked_engineers = [
      { accountId: '1', displayName: 'Alice' },
      { accountId: '2', displayName: 'Bob' },
    ];
  });

  it('computes per-engineer metrics', () => {
    (__setTickets as Function)([
      makeTicket({ key: 'T-1', assignee: 'Alice', eng_hours: 10, story_points: 3 }),
      makeTicket({ key: 'T-2', assignee: 'Alice', eng_hours: 6, story_points: 2 }),
      makeTicket({ key: 'T-3', assignee: 'Bob', eng_hours: 8, story_points: 4 }),
    ]);

    const result = getIndividualMetrics('all');
    expect(result.engineers.length).toBe(2);

    const alice = result.engineers.find((e) => e.displayName === 'Alice');
    expect(alice?.metrics.total_tickets).toBe(2);
    expect(alice?.metrics.total_eng_hours).toBe(16);

    const bob = result.engineers.find((e) => e.displayName === 'Bob');
    expect(bob?.metrics.total_tickets).toBe(1);
    expect(bob?.metrics.total_eng_hours).toBe(8);
  });

  it('computes team averages divided by engineer count', () => {
    (__setTickets as Function)([
      makeTicket({ key: 'T-1', assignee: 'Alice', eng_hours: 10 }),
      makeTicket({ key: 'T-2', assignee: 'Bob', eng_hours: 6 }),
    ]);

    const result = getIndividualMetrics('all');
    // Total: 16 hours, 2 engineers => avg 8.0
    expect(result.team_averages.total_eng_hours).toBe(8.0);
  });
});
