import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ai-key-store module
vi.mock('../../src/main/auth/ai-key-store.js', () => ({
  getAiProvider: vi.fn(),
  getAiApiKey: vi.fn(),
}));

// Mock config.service module (ai.service imports getConfig for persona-aware prompts)
vi.mock('../../src/main/services/config.service.js', () => ({
  getConfig: vi.fn().mockReturnValue({ persona: 'engineering_manager' }),
}));

// Import after mocks
import {
  buildUserPrompt,
  parseAiResponse,
  SYSTEM_PROMPT,
  getAiSuggestions,
  testAiConnection,
} from '../../src/main/services/ai.service.js';
import { getAiProvider, getAiApiKey } from '../../src/main/auth/ai-key-store.js';
import { getConfig } from '../../src/main/services/config.service.js';
import type { AiSuggestRequest } from '../../src/shared/types.js';

const mockProvider = vi.mocked(getAiProvider);
const mockApiKey = vi.mocked(getAiApiKey);
const mockGetConfig = vi.mocked(getConfig);

describe('ai.service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Re-set config mock after restoreAllMocks (which clears mock implementations)
    mockGetConfig.mockReturnValue({ persona: 'engineering_manager' } as any);
  });

  describe('SYSTEM_PROMPT', () => {
    it('should instruct JSON array output', () => {
      expect(SYSTEM_PROMPT).toContain('JSON array');
    });

    it('should instruct 2-4 suggestions', () => {
      expect(SYSTEM_PROMPT).toContain('2-4');
    });
  });

  describe('buildUserPrompt', () => {
    const baseRequest: AiSuggestRequest = {
      metricKey: 'bug_ratio',
      metricLabel: 'Bug Ratio',
      currentValue: 0.25,
      previousValue: 0.18,
      trendDirection: 'up',
      trendPct: 39,
      helpContent: 'Percentage of completed tickets that are bugs.',
      context: 'team',
    };

    it('should include metric name and key', () => {
      const prompt = buildUserPrompt(baseRequest);
      expect(prompt).toContain('Bug Ratio');
      expect(prompt).toContain('bug_ratio');
    });

    it('should include current value', () => {
      const prompt = buildUserPrompt(baseRequest);
      expect(prompt).toContain('0.25');
    });

    it('should include previous value', () => {
      const prompt = buildUserPrompt(baseRequest);
      expect(prompt).toContain('0.18');
    });

    it('should include trend direction and percentage', () => {
      const prompt = buildUserPrompt(baseRequest);
      expect(prompt).toContain('up');
      expect(prompt).toContain('39%');
    });

    it('should include context level', () => {
      const prompt = buildUserPrompt(baseRequest);
      expect(prompt).toContain('team');
    });

    it('should include engineer name for individual context', () => {
      const req: AiSuggestRequest = {
        ...baseRequest,
        context: 'individual',
        engineerName: 'Alice',
      };
      const prompt = buildUserPrompt(req);
      expect(prompt).toContain('Alice');
      expect(prompt).toContain('individual');
    });

    it('should include team average when provided', () => {
      const req: AiSuggestRequest = {
        ...baseRequest,
        teamAverageValue: 0.15,
      };
      const prompt = buildUserPrompt(req);
      expect(prompt).toContain('0.15');
    });

    it('should include help content', () => {
      const prompt = buildUserPrompt(baseRequest);
      expect(prompt).toContain('Percentage of completed tickets that are bugs.');
    });

    it('should handle null previous value gracefully', () => {
      const req: AiSuggestRequest = {
        ...baseRequest,
        previousValue: null,
        trendDirection: null,
        trendPct: null,
      };
      const prompt = buildUserPrompt(req);
      expect(prompt).not.toContain('Previous period value');
      expect(prompt).not.toContain('Trend');
    });

    it('should handle null current value', () => {
      const req: AiSuggestRequest = {
        ...baseRequest,
        currentValue: null,
      };
      const prompt = buildUserPrompt(req);
      expect(prompt).toContain('N/A');
    });
  });

  describe('parseAiResponse', () => {
    it('should parse a valid JSON array', () => {
      const input = '["Suggestion 1", "Suggestion 2"]';
      expect(parseAiResponse(input)).toEqual(['Suggestion 1', 'Suggestion 2']);
    });

    it('should parse JSON array with whitespace', () => {
      const input = '  [\n  "First suggestion",\n  "Second suggestion"\n]  ';
      expect(parseAiResponse(input)).toEqual(['First suggestion', 'Second suggestion']);
    });

    it('should strip markdown code fences', () => {
      const input = '```json\n["Suggestion 1", "Suggestion 2"]\n```';
      expect(parseAiResponse(input)).toEqual(['Suggestion 1', 'Suggestion 2']);
    });

    it('should strip code fences without language tag', () => {
      const input = '```\n["A", "B", "C"]\n```';
      expect(parseAiResponse(input)).toEqual(['A', 'B', 'C']);
    });

    it('should extract JSON array from surrounding text', () => {
      const input = 'Here are the suggestions:\n["Do this", "Do that"]\nHope that helps!';
      expect(parseAiResponse(input)).toEqual(['Do this', 'Do that']);
    });

    it('should return empty array for non-string arrays', () => {
      const input = '[1, 2, 3]';
      expect(parseAiResponse(input)).toEqual([]);
    });

    it('should return empty array for completely invalid input', () => {
      expect(parseAiResponse('This is not JSON at all')).toEqual([]);
    });

    it('should return empty array for empty input', () => {
      expect(parseAiResponse('')).toEqual([]);
    });

    it('should return empty array for JSON objects (not arrays)', () => {
      expect(parseAiResponse('{"suggestion": "Do this"}')).toEqual([]);
    });

    it('should handle 4 suggestions', () => {
      const input = '["A", "B", "C", "D"]';
      expect(parseAiResponse(input)).toHaveLength(4);
    });
  });

  describe('getAiSuggestions', () => {
    const baseReq: AiSuggestRequest = {
      metricKey: 'bug_ratio',
      metricLabel: 'Bug Ratio',
      currentValue: 0.25,
      previousValue: 0.18,
      trendDirection: 'up',
      trendPct: 39,
      helpContent: 'Bug percentage.',
      context: 'team',
    };

    it('returns error when AI not configured (no provider)', async () => {
      mockProvider.mockReturnValue(null);
      mockApiKey.mockReturnValue(null);
      const result = await getAiSuggestions(baseReq);
      expect(result.suggestions).toEqual([]);
      expect(result.error).toContain('AI not configured');
    });

    it('returns error when API key missing', async () => {
      mockProvider.mockReturnValue('openai');
      mockApiKey.mockReturnValue(null);
      const result = await getAiSuggestions(baseReq);
      expect(result.suggestions).toEqual([]);
      expect(result.error).toContain('AI not configured');
    });

    it('calls OpenAI and returns parsed suggestions', async () => {
      mockProvider.mockReturnValue('openai');
      mockApiKey.mockReturnValue('sk-test');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '["Fix bugs", "Write tests"]' } }],
        }),
      }));

      const result = await getAiSuggestions(baseReq);
      expect(result.suggestions).toEqual(['Fix bugs', 'Write tests']);
      expect(result.error).toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('calls Claude when provider is claude', async () => {
      mockProvider.mockReturnValue('claude');
      mockApiKey.mockReturnValue('sk-ant-test');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: '["Reduce cycle time", "Add automation"]' }],
        }),
      }));

      const result = await getAiSuggestions(baseReq);
      expect(result.suggestions).toEqual(['Reduce cycle time', 'Add automation']);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('handles OpenAI 401 error', async () => {
      mockProvider.mockReturnValue('openai');
      mockApiKey.mockReturnValue('bad-key');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      }));

      const result = await getAiSuggestions(baseReq);
      expect(result.suggestions).toEqual([]);
      expect(result.error).toContain('Invalid API key');
    });

    it('handles OpenAI 429 rate limit', async () => {
      mockProvider.mockReturnValue('openai');
      mockApiKey.mockReturnValue('sk-test');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      }));

      const result = await getAiSuggestions(baseReq);
      expect(result.suggestions).toEqual([]);
      expect(result.error).toContain('Rate limit');
    });

    it('handles OpenAI generic HTTP error', async () => {
      mockProvider.mockReturnValue('openai');
      mockApiKey.mockReturnValue('sk-test');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }));

      const result = await getAiSuggestions(baseReq);
      expect(result.suggestions).toEqual([]);
      expect(result.error).toContain('OpenAI API error');
    });

    it('handles Claude 401 error', async () => {
      mockProvider.mockReturnValue('claude');
      mockApiKey.mockReturnValue('bad-key');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      }));

      const result = await getAiSuggestions(baseReq);
      expect(result.suggestions).toEqual([]);
      expect(result.error).toContain('Invalid API key');
      expect(result.error).toContain('Claude');
    });

    it('handles Claude 429 rate limit', async () => {
      mockProvider.mockReturnValue('claude');
      mockApiKey.mockReturnValue('sk-ant-test');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      }));

      const result = await getAiSuggestions(baseReq);
      expect(result.suggestions).toEqual([]);
      expect(result.error).toContain('Rate limit');
    });

    it('handles Claude generic HTTP error', async () => {
      mockProvider.mockReturnValue('claude');
      mockApiKey.mockReturnValue('sk-ant-test');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      }));

      const result = await getAiSuggestions(baseReq);
      expect(result.suggestions).toEqual([]);
      expect(result.error).toContain('Claude API error');
    });

    it('handles network error', async () => {
      mockProvider.mockReturnValue('openai');
      mockApiKey.mockReturnValue('sk-test');
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));

      const result = await getAiSuggestions(baseReq);
      expect(result.suggestions).toEqual([]);
      expect(result.error).toContain('fetch failed');
    });

    it('returns error when AI response cannot be parsed', async () => {
      mockProvider.mockReturnValue('openai');
      mockApiKey.mockReturnValue('sk-test');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Not valid json at all' } }],
        }),
      }));

      const result = await getAiSuggestions(baseReq);
      expect(result.suggestions).toEqual([]);
      expect(result.error).toContain('Failed to parse');
    });

    it('handles empty content from OpenAI', async () => {
      mockProvider.mockReturnValue('openai');
      mockApiKey.mockReturnValue('sk-test');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [] }),
      }));

      const result = await getAiSuggestions(baseReq);
      expect(result.suggestions).toEqual([]);
      expect(result.error).toContain('Failed to parse');
    });
  });

  describe('testAiConnection', () => {
    it('returns error when not configured', async () => {
      mockProvider.mockReturnValue(null);
      mockApiKey.mockReturnValue(null);
      const result = await testAiConnection();
      expect(result.success).toBe(false);
      expect(result.error).toContain('No AI provider configured');
    });

    it('succeeds for OpenAI with valid key', async () => {
      mockProvider.mockReturnValue('openai');
      mockApiKey.mockReturnValue('sk-test');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

      const result = await testAiConnection();
      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }) }),
      );
    });

    it('returns error for OpenAI 401', async () => {
      mockProvider.mockReturnValue('openai');
      mockApiKey.mockReturnValue('bad-key');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

      const result = await testAiConnection();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('returns error for OpenAI non-401 failure', async () => {
      mockProvider.mockReturnValue('openai');
      mockApiKey.mockReturnValue('sk-test');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

      const result = await testAiConnection();
      expect(result.success).toBe(false);
      expect(result.error).toContain('API error: 500');
    });

    it('succeeds for Claude with valid key', async () => {
      mockProvider.mockReturnValue('claude');
      mockApiKey.mockReturnValue('sk-ant-test');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

      const result = await testAiConnection();
      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('returns error for Claude 401', async () => {
      mockProvider.mockReturnValue('claude');
      mockApiKey.mockReturnValue('bad-key');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

      const result = await testAiConnection();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('returns error for Claude non-401 failure', async () => {
      mockProvider.mockReturnValue('claude');
      mockApiKey.mockReturnValue('sk-ant-test');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

      const result = await testAiConnection();
      expect(result.success).toBe(false);
      expect(result.error).toContain('API error: 503');
    });

    it('handles network error', async () => {
      mockProvider.mockReturnValue('openai');
      mockApiKey.mockReturnValue('sk-test');
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));

      const result = await testAiConnection();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network down');
    });
  });
});
