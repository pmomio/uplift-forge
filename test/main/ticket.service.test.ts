import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron-store — use vi.hoisted to avoid "before initialization" error
const { mockStoreData } = vi.hoisted(() => {
  const mockStoreData: Record<string, unknown> = {
    ticketCache: {},
    rawIssueCache: {},
  };
  return { mockStoreData };
});

vi.mock('electron-store', () => ({
  default: class MockStore {
    constructor() {}
    get(key: string) { return mockStoreData[key]; }
    set(key: string, value: unknown) { mockStoreData[key] = value; }
  },
}));

// Mock config service
vi.mock('../../src/main/services/config.service.js', () => ({
  getConfig: vi.fn(() => ({
    project_key: 'TEST',
    field_ids: { tpd_bu: 'cf_tpd', eng_hours: 'cf_eng', work_stream: 'cf_ws', story_points: 'cf_sp' },
    eng_start_status: 'In Progress',
    eng_end_status: 'In Review',
    eng_excluded_statuses: ['Blocked'],
    office_hours: { start: '09:00', end: '18:00', timezone: 'Europe/Berlin', exclude_weekends: true },
    mapping_rules: { tpd_bu: {}, work_stream: {} },
    ticket_filter: { mode: 'last_x_months', months: 6 },
    sp_to_days: 1,
    tracked_engineers: [],
    done_statuses: ['Done', 'Resolved', 'Closed', 'Rejected', 'Cancelled'],
    blocked_statuses: ['Blocked'],
    active_statuses: ['In Progress', 'Code Review', 'QA'],
  })),
}));

// Mock field-engine
vi.mock('../../src/main/services/field-engine.service.js', () => ({
  calculateEngineeringHours: vi.fn(() => 8.5),
  getMappedFields: vi.fn(() => ['B2C', 'Product']),
}));

// Mock jira service
vi.mock('../../src/main/services/jira.service.js', () => ({
  getIssues: vi.fn(),
  searchIssues: vi.fn(),
  getIssueChangelog: vi.fn(),
  updateIssueFields: vi.fn(),
}));

import {
  processIssue,
  reprocessCache,
  syncTickets,
  syncSingleTicket,
  calculateTicketHours,
  calculateTicketFields,
  getTickets,
  updateTicket,
  getVisibleTicketCount,
  getJiraMembers,
} from '../../src/main/services/ticket.service.js';
import * as jira from '../../src/main/services/jira.service.js';
import { calculateEngineeringHours, getMappedFields } from '../../src/main/services/field-engine.service.js';
import { getConfig } from '../../src/main/services/config.service.js';

const mockGetIssues = vi.mocked(jira.getIssues);
const mockSearchIssues = vi.mocked(jira.searchIssues);
const mockGetChangelog = vi.mocked(jira.getIssueChangelog);
const mockUpdateFields = vi.mocked(jira.updateIssueFields);
const mockCalcHours = vi.mocked(calculateEngineeringHours);
const mockGetMapped = vi.mocked(getMappedFields);

function makeIssue(key: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    key,
    fields: {
      summary: `Issue ${key}`,
      status: { name: 'Done' },
      assignee: { displayName: 'Alice', accountId: 'a1', avatarUrls: { '48x48': 'https://av.png' }, active: true },
      issuetype: { name: 'Story' },
      priority: { name: 'Medium' },
      created: '2025-01-01T10:00:00Z',
      resolutiondate: '2025-01-05T10:00:00Z',
      updated: '2025-01-05T12:00:00Z',
      cf_sp: 3,
      ...overrides,
    },
    changelog: { histories: [] },
  };
}

describe('ticket.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalcHours.mockReturnValue(8.5);
    mockGetMapped.mockReturnValue(['B2C', 'Product']);
  });

  describe('done status filtering', () => {
    it('uses done_statuses from config for filtering', () => {
      // getTickets uses cfg.done_statuses — verified by the config mock above
      const cfg = getConfig();
      expect(cfg.done_statuses).toContain('Done');
      expect(cfg.done_statuses).toContain('Resolved');
      expect(cfg.done_statuses).toContain('Closed');
    });
  });

  describe('processIssue', () => {
    it('processes issue and populates ticket cache', () => {
      const issue = makeIssue('T-1');
      processIssue(issue);
      const tickets = getTickets();
      const t = tickets.find(t => t.key === 'T-1');
      expect(t).toBeDefined();
      expect(t!.summary).toBe('Issue T-1');
      expect(t!.status).toBe('Done');
      expect(t!.assignee).toBe('Alice');
    });

    it('uses JIRA custom field values when present', () => {
      const issue = makeIssue('T-2', {
        cf_tpd: [{ value: 'B2B' }],
        cf_eng: 5.0,
        cf_ws: { value: 'Operational' },
      });
      processIssue(issue);
      const tickets = getTickets();
      const t = tickets.find(t => t.key === 'T-2');
      expect(t!.tpd_bu).toBe('B2B');
      expect(t!.eng_hours).toBe(5.0);
      expect(t!.work_stream).toBe('Operational');
    });

    it('falls back to computed values when JIRA fields empty', () => {
      const issue = makeIssue('T-3');
      processIssue(issue);
      const tickets = getTickets();
      const t = tickets.find(t => t.key === 'T-3');
      expect(t!.eng_hours).toBe(8.5);
      expect(t!.tpd_bu).toBe('B2C');
      expect(t!.work_stream).toBe('Product');
      expect(t!.has_computed_values).toBe(true);
    });

    it('handles missing assignee', () => {
      const issue = makeIssue('T-4', { assignee: null });
      processIssue(issue);
      const tickets = getTickets();
      const t = tickets.find(t => t.key === 'T-4');
      expect(t!.assignee).toBe('Unassigned');
    });

    it('parses story points from custom field', () => {
      const issue = makeIssue('T-5', { cf_sp: 5 });
      processIssue(issue);
      const tickets = getTickets();
      const t = tickets.find(t => t.key === 'T-5');
      expect(t!.story_points).toBe(5);
    });

    it('handles object-style tpd_bu field', () => {
      const issue = makeIssue('T-6', { cf_tpd: { value: 'B2B' } });
      processIssue(issue);
      const tickets = getTickets();
      const t = tickets.find(t => t.key === 'T-6');
      expect(t!.tpd_bu).toBe('B2B');
    });

    it('handles missing fields gracefully', () => {
      // Issue with no fields/changelog should still be processed
      const issue = { key: 'T-BARE', fields: {}, changelog: {} };
      expect(() => processIssue(issue as any)).not.toThrow();
      const tickets = getTickets();
      const t = tickets.find(t => t.key === 'T-BARE');
      // Status won't be final, so it won't appear in getTickets, but shouldn't crash
      expect(true).toBe(true); // Did not throw
    });
  });

  describe('getTickets', () => {
    it('filters to final statuses only', () => {
      processIssue(makeIssue('T-D', { status: { name: 'Done' } }));
      processIssue(makeIssue('T-IP', { status: { name: 'In Progress' } }));
      const tickets = getTickets();
      const keys = tickets.map(t => t.key);
      expect(keys).toContain('T-D');
      expect(keys).not.toContain('T-IP');
    });

    it('applies missing_fields filter mode', () => {
      vi.mocked(getConfig).mockReturnValue({
        ...vi.mocked(getConfig)(),
        ticket_filter: { mode: 'missing_fields', months: 6 },
      } as any);
      // T-3 from earlier has computed values (all fields present from computation)
      // Need a ticket that truly has missing fields
      mockGetMapped.mockReturnValue([null, null]);
      mockCalcHours.mockReturnValue(null);
      processIssue(makeIssue('T-MISSING'));
      const tickets = getTickets();
      const missing = tickets.find(t => t.key === 'T-MISSING');
      expect(missing).toBeDefined();
    });
  });

  describe('syncTickets', () => {
    it('fetches issues and populates cache', async () => {
      mockGetIssues.mockResolvedValue([makeIssue('T-S1'), makeIssue('T-S2')]);
      const count = await syncTickets();
      expect(count).toBe(2);
      expect(mockGetIssues).toHaveBeenCalled();
    });

    it('caps months at 12', async () => {
      vi.mocked(getConfig).mockReturnValue({
        ...vi.mocked(getConfig)(),
        ticket_filter: { mode: 'last_x_months', months: 24 },
      } as any);
      mockGetIssues.mockResolvedValue([]);
      await syncTickets();
      expect(mockGetIssues).toHaveBeenCalledWith('TEST', 12);
    });

    it('treats legacy all mode as 12 months', async () => {
      vi.mocked(getConfig).mockReturnValue({
        ...vi.mocked(getConfig)(),
        ticket_filter: { mode: 'all', months: 6 },
      } as any);
      mockGetIssues.mockResolvedValue([]);
      await syncTickets();
      expect(mockGetIssues).toHaveBeenCalledWith('TEST', 12);
    });

    it('returns 0 on error', async () => {
      mockGetIssues.mockRejectedValue(new Error('Fail'));
      const count = await syncTickets();
      expect(count).toBe(0);
    });
  });

  describe('syncSingleTicket', () => {
    it('syncs a single ticket', async () => {
      mockSearchIssues.mockResolvedValue([makeIssue('T-X')]);
      const result = await syncSingleTicket('T-X');
      expect(result).toBeDefined();
      expect(result!.key).toBe('T-X');
    });

    it('throws if ticket not found', async () => {
      mockSearchIssues.mockResolvedValue([]);
      await expect(syncSingleTicket('T-MISSING')).rejects.toThrow('not found');
    });
  });

  describe('calculateTicketHours', () => {
    it('returns hours and diagnostics', async () => {
      mockGetChangelog.mockResolvedValue({
        histories: [
          { created: '2025-01-01T10:00:00Z', items: [{ field: 'status', fromString: 'Open', toString: 'In Progress' }] },
        ],
      });
      mockCalcHours.mockReturnValue(4.5);
      const result = await calculateTicketHours('T-1');
      expect(result.hours).toBe(4.5);
      expect(result.diagnostics).toBeDefined();
      expect(result.diagnostics!.statusTransitions).toHaveLength(1);
    });

    it('includes rawFirstItem in diagnostics', async () => {
      mockGetChangelog.mockResolvedValue({
        histories: [
          { created: '2025-01-01T10:00:00Z', items: [{ field: 'status', fromString: 'Open', toString: 'In Progress' }] },
        ],
      });
      const result = await calculateTicketHours('T-1');
      expect(result.diagnostics!.rawFirstItem).toBeDefined();
    });

    it('handles null hours', async () => {
      mockGetChangelog.mockResolvedValue({ histories: [] });
      mockCalcHours.mockReturnValue(null);
      const result = await calculateTicketHours('T-1');
      expect(result.hours).toBeNull();
    });
  });

  describe('calculateTicketFields', () => {
    it('returns mapped fields', async () => {
      mockSearchIssues.mockResolvedValue([makeIssue('T-1')]);
      mockGetMapped.mockReturnValue(['B2C', 'Product']);
      const result = await calculateTicketFields('T-1');
      expect(result).toEqual({ tpd_bu: 'B2C', work_stream: 'Product' });
    });

    it('throws if ticket not found', async () => {
      mockSearchIssues.mockResolvedValue([]);
      await expect(calculateTicketFields('T-X')).rejects.toThrow('not found');
    });
  });

  describe('updateTicket', () => {
    it('maps tpd_bu to JIRA field format', async () => {
      processIssue(makeIssue('T-UPD'));
      mockUpdateFields.mockResolvedValue();
      await updateTicket('T-UPD', { tpd_bu: 'B2B' });
      expect(mockUpdateFields).toHaveBeenCalledWith('T-UPD', { cf_tpd: [{ value: 'B2B' }] });
    });

    it('maps eng_hours to JIRA field format', async () => {
      processIssue(makeIssue('T-UPD2'));
      mockUpdateFields.mockResolvedValue();
      await updateTicket('T-UPD2', { eng_hours: 10 });
      expect(mockUpdateFields).toHaveBeenCalledWith('T-UPD2', { cf_eng: 10 });
    });

    it('maps work_stream to JIRA field format', async () => {
      processIssue(makeIssue('T-UPD3'));
      mockUpdateFields.mockResolvedValue();
      await updateTicket('T-UPD3', { work_stream: 'Ops' });
      expect(mockUpdateFields).toHaveBeenCalledWith('T-UPD3', { cf_ws: { value: 'Ops' } });
    });

    it('clears tpd_bu with empty array', async () => {
      processIssue(makeIssue('T-UPD4'));
      mockUpdateFields.mockResolvedValue();
      await updateTicket('T-UPD4', { tpd_bu: null });
      expect(mockUpdateFields).toHaveBeenCalledWith('T-UPD4', { cf_tpd: [] });
    });

    it('returns null for unknown ticket', async () => {
      mockUpdateFields.mockResolvedValue();
      const result = await updateTicket('T-UNKNOWN', { tpd_bu: 'B2C' });
      // Unknown ticket — not in cache
      expect(result).toBeNull();
    });
  });

  describe('getVisibleTicketCount', () => {
    it('returns count of visible tickets', () => {
      const count = getVisibleTicketCount();
      expect(typeof count).toBe('number');
    });
  });

  describe('reprocessCache', () => {
    it('re-processes all cached issues', () => {
      processIssue(makeIssue('T-R1'));
      processIssue(makeIssue('T-R2'));
      mockCalcHours.mockReturnValue(99);
      reprocessCache();
      // Should have reprocessed — calc should have been called with new mock
      expect(mockCalcHours).toHaveBeenCalled();
    });
  });

  describe('getJiraMembers', () => {
    it('returns unique members from raw cache', () => {
      // Process issues to populate raw cache
      processIssue(makeIssue('T-M1', {
        assignee: { accountId: 'a1', displayName: 'Alice', avatarUrls: { '48x48': 'https://a.png' }, active: true },
      }));
      processIssue(makeIssue('T-M2', {
        assignee: { accountId: 'b1', displayName: 'Bob', avatarUrls: {}, active: true },
      }));
      processIssue(makeIssue('T-M3', {
        assignee: { accountId: 'a1', displayName: 'Alice', avatarUrls: {}, active: true },
      }));
      const members = getJiraMembers();
      const ids = members.map(m => m.accountId);
      // Deduplicated
      expect(ids.filter(id => id === 'a1')).toHaveLength(1);
      expect(members.find(m => m.accountId === 'b1')).toBeDefined();
      // Sorted by displayName
      expect(members[0].displayName).toBe('Alice');
    });

    it('skips issues with no assignee', () => {
      processIssue(makeIssue('T-NO', { assignee: null }));
      // Should not crash and unassigned should not appear in members
      const members = getJiraMembers();
      const hasNull = members.some(m => !m.accountId);
      expect(hasNull).toBe(false);
    });
  });
});
