import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron-store — use vi.hoisted to avoid \"before initialization\" error
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
    field_ids: { story_points: 'cf_sp' },
    ticket_filter: { mode: 'last_x_months', months: 6 },
    sp_to_days: 1,
    tracked_engineers: [],
    active_statuses: ['In Progress', 'QA'],
    blocked_statuses: ['Blocked'],
    done_statuses: ['Done', 'Resolved'],
  })),
}));

// Mock jira service
vi.mock('../../src/main/services/jira.service.js', () => ({
  getIssues: vi.fn(),
  searchIssues: vi.fn(),
  getIssueChangelog: vi.fn(),
  updateIssueFields: vi.fn(),
}));

// Mock timeline service (imported by ticket.service for cache invalidation)
vi.mock('../../src/main/services/timeline.service.js', () => ({
  invalidateTimelineCache: vi.fn(),
}));

import {
  processIssue,
  reprocessCache,
  syncTickets,
  syncAllProjects,
  syncSingleTicket,
  getTickets,
  updateTicket,
  getVisibleTicketCount,
  getJiraMembers,
  FINAL_STATUSES,
} from '../../src/main/services/ticket.service.js';
import * as jira from '../../src/main/services/jira.service.js';
import { getConfig } from '../../src/main/services/config.service.js';

const mockGetIssues = vi.mocked(jira.getIssues);
const mockSearchIssues = vi.mocked(jira.searchIssues);
const mockUpdateFields = vi.mocked(jira.updateIssueFields);

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
  });

  describe('FINAL_STATUSES', () => {
    it('contains expected statuses', () => {
      expect(FINAL_STATUSES).toContain('Done');
      expect(FINAL_STATUSES).toContain('Resolved');
      expect(FINAL_STATUSES).toContain('Closed');
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

    it('handles missing fields gracefully', () => {
      // Issue with no fields/changelog should still be processed
      const issue = { key: 'T-BARE', fields: {}, changelog: {} };
      expect(() => processIssue(issue as any)).not.toThrow();
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
      processIssue(makeIssue('T-MISSING', { cf_sp: null }));
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

    it('throws error on failure', async () => {
      mockGetIssues.mockRejectedValue(new Error('Fail'));
      await expect(syncTickets()).rejects.toThrow('Fail');
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

  describe('updateTicket', () => {
    it('updates ticket in local cache', async () => {
      processIssue(makeIssue('TEST-UPD'), true, 'TEST');
      await updateTicket('TEST-UPD', { summary: 'New Summary' });
      const tickets = getTickets('TEST');
      const t = tickets.find(t => t.key === 'TEST-UPD');
      expect(t!.summary).toBe('New Summary');
    });

    it('returns null for unknown ticket', async () => {
      const result = await updateTicket('T-UNKNOWN', { summary: 'New Summary' });
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
      reprocessCache();
      expect(true).toBe(true); // Did not throw
    });
  });

  describe('getJiraMembers', () => {
    it('returns unique members from raw cache', () => {
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
      expect(ids.filter(id => id === 'a1')).toHaveLength(1);
      expect(members.find(m => m.accountId === 'b1')).toBeDefined();
      expect(members[0].displayName).toBe('Alice');
    });

    it('skips issues with no assignee', () => {
      processIssue(makeIssue('T-NO', { assignee: null }));
      const members = getJiraMembers();
      const hasNull = members.some(m => !m.accountId);
      expect(hasNull).toBe(false);
    });
  });

  describe('per-project caches', () => {
    it('getTickets without projectKey aggregates all projects', () => {
      processIssue(makeIssue('TEST-1', { status: { name: 'Done' } }));
      processIssue(makeIssue('OTHER-1', { status: { name: 'Done' } }), true, 'OTHER');
      const allTickets = getTickets();
      const keys = allTickets.map(t => t.key);
      expect(keys).toContain('TEST-1');
      expect(keys).toContain('OTHER-1');
    });

    it('getTickets with projectKey returns only that project', () => {
      processIssue(makeIssue('AAA-1', { status: { name: 'Done' } }), true, 'AAA');
      processIssue(makeIssue('BBB-1', { status: { name: 'Done' } }), true, 'BBB');
      const aTickets = getTickets('AAA');
      const aKeys = aTickets.map(t => t.key);
      expect(aKeys).toContain('AAA-1');
      expect(aKeys).not.toContain('BBB-1');
    });
  });

  describe('syncAllProjects', () => {
    it('syncs primary project and returns results', async () => {
      mockGetIssues.mockResolvedValue([makeIssue('TEST-S1')]);
      const result = await syncAllProjects();
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(mockGetIssues).toHaveBeenCalled();
    });

    it('throws when getIssues fails', async () => {
      mockGetIssues.mockRejectedValue(new Error('Network error'));
      await expect(syncAllProjects()).rejects.toThrow('Network error');
    });
  });
});
