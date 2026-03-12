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
  verifyCredentials,
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

  describe('verifyCredentials', () => {
    it('sends request to /myself with override credentials', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ 
        ok: true, 
        status: 200,
        json: async () => ({}),
        text: async () => ''
      });
      vi.stubGlobal('fetch', fetchMock);
      
      const baseUrl = 'https://custom.jira';
      const email = 'user@test.com';
      const apiToken = 'token123';
      
      await verifyCredentials(baseUrl, email, apiToken);
      
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('https://custom.jira/rest/api/3/myself');
      const expectedAuth = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
      expect(opts.headers.Authorization).toBe(expectedAuth);
    });

    it('throws error on invalid credentials (401)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
        headers: new Map([['content-type', 'text/plain']]),
      }));
      
      await expect(verifyCredentials('https://test', 'a', 'b')).rejects.toThrow('JIRA API error 401: Unauthorized');
    });

    it('throws error on other API errors', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error',
        headers: new Map([['content-type', 'text/plain']]),
      }));
      
      await expect(verifyCredentials('https://test', 'a', 'b')).rejects.toThrow('JIRA API error 500: Server error');
    });

    it('handles HTML error response without dumping full body', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '<html><body>Unauthorized</body></html>',
        headers: new Map([['content-type', 'text/html']]),
      }));
      
      await expect(verifyCredentials('https://test', 'a', 'b')).rejects.toThrow('JIRA API error 401 (received HTML response)');
    });

    it('truncates long text error responses', async () => {
      const longText = 'A'.repeat(500);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => longText,
        headers: new Map([['content-type', 'text/plain']]),
      }));
      
      const error = await verifyCredentials('https://test', 'a', 'b').catch(e => e.message);
      expect(error).toContain('JIRA API error 400');
      expect(error.length).toBeLessThan(300);
      expect(error).toContain('...');
    });

    it('parses JIRA JSON error messages', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ errorMessages: ['Validation failed', 'Missing field'] }),
        headers: new Map([['content-type', 'application/json']]),
      }));
      
      await expect(verifyCredentials('https://test', 'a', 'b')).rejects.toThrow('JIRA API error 400: Validation failed, Missing field');
    });
  });
});
