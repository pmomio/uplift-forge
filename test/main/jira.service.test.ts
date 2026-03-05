import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock token-store
vi.mock('../../src/main/auth/token-store.js', () => ({
  getAuthHeader: vi.fn(),
  getBaseUrl: vi.fn(),
}));

import {
  getIssues,
  updateIssueFields,
  getIssueChangelog,
  getIssueWithChangelog,
  searchIssues,
  getAllFields,
  getAllStatuses,
  getProject,
  getFieldOptions,
} from '../../src/main/services/jira.service.js';
import { getAuthHeader, getBaseUrl } from '../../src/main/auth/token-store.js';

const mockAuth = vi.mocked(getAuthHeader);
const mockBase = vi.mocked(getBaseUrl);

function mockFetch(data: unknown, options?: { ok?: boolean; status?: number; statusText?: string }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: options?.ok ?? true,
    status: options?.status ?? 200,
    statusText: options?.statusText ?? 'OK',
    json: async () => data,
    text: async () => JSON.stringify(data),
  }));
}

describe('jira.service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuth.mockReturnValue('Basic dGVzdA==');
    mockBase.mockReturnValue('https://jira.test');
  });

  describe('jiraFetch (via public functions)', () => {
    it('throws when not authenticated', async () => {
      mockAuth.mockReturnValue(null as any);
      mockBase.mockReturnValue(null as any);
      await expect(getAllFields()).rejects.toThrow('Not authenticated');
    });

    it('throws on non-OK HTTP response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      }));
      await expect(getAllFields()).rejects.toThrow('JIRA API error 403');
    });
  });

  describe('getIssues', () => {
    it('fetches all issues with pagination', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            issues: [{ key: 'T-1' }, { key: 'T-2' }],
            nextPageToken: 'token1',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            issues: [{ key: 'T-3' }],
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const result = await getIssues('PROJ');
      expect(result).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('builds date filter when months provided', async () => {
      mockFetch({ issues: [] });
      await getIssues('PROJ', 3);
      const callUrl = (fetch as any).mock.calls[0][0] as string;
      expect(callUrl).toContain('resolved');
      expect(callUrl).toContain('resolution');
    });

    it('handles empty result', async () => {
      mockFetch({ issues: [] });
      const result = await getIssues('PROJ');
      expect(result).toEqual([]);
    });

    it('stops pagination on empty batch', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ issues: [], nextPageToken: 'tok' }),
      });
      vi.stubGlobal('fetch', fetchMock);
      const result = await getIssues('PROJ');
      expect(result).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateIssueFields', () => {
    it('sends PUT request with fields', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      vi.stubGlobal('fetch', fetchMock);
      await updateIssueFields('T-1', { summary: 'Updated' });
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/issue/T-1');
      expect(opts.method).toBe('PUT');
      expect(JSON.parse(opts.body)).toEqual({ fields: { summary: 'Updated' } });
    });
  });

  describe('getIssueChangelog', () => {
    it('returns changelog histories', async () => {
      mockFetch({ changelog: { histories: [{ id: '1' }] } });
      const result = await getIssueChangelog('T-1');
      expect(result.histories).toEqual([{ id: '1' }]);
    });

    it('returns empty histories when no changelog', async () => {
      mockFetch({});
      const result = await getIssueChangelog('T-1');
      expect(result.histories).toEqual([]);
    });
  });

  describe('getIssueWithChangelog', () => {
    it('returns full issue object', async () => {
      mockFetch({ key: 'T-1', fields: { summary: 'Test' } });
      const result = await getIssueWithChangelog('T-1');
      expect(result.key).toBe('T-1');
    });
  });

  describe('searchIssues', () => {
    it('returns found issues', async () => {
      mockFetch({ issues: [{ key: 'T-1' }] });
      const result = await searchIssues('key = "T-1"');
      expect(result).toEqual([{ key: 'T-1' }]);
    });

    it('returns empty when no issues field', async () => {
      mockFetch({});
      const result = await searchIssues('key = "T-X"');
      expect(result).toEqual([]);
    });
  });

  describe('getAllFields', () => {
    it('maps fields to JiraField format', async () => {
      mockFetch([
        { id: 'cf_1', name: 'Custom A', schema: { type: 'string' } },
        { id: 'cf_2', name: 'Custom B' },
      ]);
      const result = await getAllFields();
      expect(result).toEqual([
        { id: 'cf_1', name: 'Custom A', type: 'string' },
        { id: 'cf_2', name: 'Custom B', type: 'unknown' },
      ]);
    });
  });

  describe('getAllStatuses', () => {
    it('deduplicates and sorts statuses', async () => {
      mockFetch([
        { id: '1', name: 'Done' },
        { id: '2', name: 'Active' },
        { id: '3', name: 'Done' },
        { id: '4', name: 'Blocked' },
      ]);
      const result = await getAllStatuses();
      expect(result).toEqual([
        { id: '2', name: 'Active' },
        { id: '4', name: 'Blocked' },
        { id: '1', name: 'Done' },
      ]);
    });

    it('skips statuses with no name', async () => {
      mockFetch([{ id: '1', name: '' }, { id: '2', name: 'Open' }]);
      const result = await getAllStatuses();
      expect(result).toEqual([{ id: '2', name: 'Open' }]);
    });
  });

  describe('getProject', () => {
    it('returns project info', async () => {
      mockFetch({
        key: 'PROJ',
        name: 'My Project',
        lead: { displayName: 'Alice' },
        avatarUrls: { '48x48': 'https://avatar.png' },
      });
      const result = await getProject('PROJ');
      expect(result).toEqual({
        key: 'PROJ',
        name: 'My Project',
        lead: 'Alice',
        avatar: 'https://avatar.png',
      });
    });

    it('uses fallback values for missing fields', async () => {
      mockFetch({ key: 'PROJ' });
      const result = await getProject('PROJ');
      expect(result.name).toBe('PROJ');
      expect(result.lead).toBeNull();
      expect(result.avatar).toBeNull();
    });

    it('returns fallback on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network fail')));
      const result = await getProject('PROJ');
      expect(result.key).toBe('PROJ');
      expect(result.name).toBe('PROJ');
      expect((result as any).error).toBeDefined();
    });
  });

  describe('getFieldOptions', () => {
    it('fetches and returns sorted, deduplicated options', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ values: [{ id: '10100' }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            values: [
              { id: '1', value: 'Product' },
              { id: '2', value: 'Operational' },
              { id: '3', value: 'Product' }, // duplicate
            ],
            isLast: true,
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const result = await getFieldOptions('customfield_10100');
      expect(result).toEqual([
        { id: '2', value: 'Operational' },
        { id: '1', value: 'Product' },
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('handles pagination across option pages', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ values: [{ id: '10100' }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            values: [{ id: '1', value: 'Alpha' }],
            isLast: false,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            values: [{ id: '2', value: 'Beta' }],
            isLast: true,
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const result = await getFieldOptions('customfield_10100');
      expect(result).toEqual([
        { id: '1', value: 'Alpha' },
        { id: '2', value: 'Beta' },
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('excludes disabled options', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ values: [{ id: '10100' }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            values: [
              { id: '1', value: 'Active', disabled: false },
              { id: '2', value: 'Deprecated', disabled: true },
            ],
            isLast: true,
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const result = await getFieldOptions('customfield_10100');
      expect(result).toEqual([{ id: '1', value: 'Active' }]);
    });

    it('returns empty array when field has no contexts', async () => {
      mockFetch({ values: [] });
      const result = await getFieldOptions('customfield_99999');
      expect(result).toEqual([]);
    });

    it('returns empty array on API error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network fail')));
      const result = await getFieldOptions('customfield_10100');
      expect(result).toEqual([]);
    });
  });
});
