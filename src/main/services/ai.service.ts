import { getAiApiKey, getAiProvider } from '../auth/ai-key-store.js';
import { getConfig } from './config.service.js';
import type { AiSuggestRequest, AiSuggestResponse, Persona } from '../../shared/types.js';

const SYSTEM_PROMPT = `You are a senior engineering manager with 15+ years of experience leading high-performing software teams. You analyze engineering metrics and provide actionable improvement suggestions.

RULES:
- Return ONLY a JSON array of 2-4 suggestion strings. No other text.
- Each suggestion must be specific, actionable, and tied to the metric data provided.
- Focus on practical actions the team/engineer can take this sprint or next.
- Be direct and concise — each suggestion should be 1-2 sentences max.
- Consider the trend direction and magnitude when making suggestions.
- If comparing an individual to the team average, address the gap specifically.

Example output format:
["Schedule a team estimation calibration session — your accuracy ratio of 0.6x suggests consistent under-estimation of complexity.", "Break down tickets above 5 SP into smaller deliverables to reduce cycle time variance."]`;

/** Persona-specific system prompt overrides */
const PERSONA_SYSTEM_PROMPTS: Record<Persona, string> = {
  engineering_manager: `You are a senior engineering manager with 15+ years of experience leading high-performing software teams. You analyze engineering metrics across one or more projects and provide actionable improvement suggestions with strategic cross-team implications.

RULES:
- Return ONLY a JSON array of 2-4 suggestion strings. No other text.
- Each suggestion must be specific, actionable, and tied to the metric data provided.
- Focus on practical actions the team/engineer can take this sprint or next.
- Consider cross-project implications and organizational-level patterns.
- Be direct and concise — each suggestion should be 1-2 sentences max.

Example output format:
["Schedule a team estimation calibration session — your accuracy ratio of 0.6x suggests consistent under-estimation of complexity.", "The 40% bug ratio across teams suggests a systemic testing gap — consider investing in automated testing infrastructure."]`,

  individual: `You are a personal engineering coach helping a software developer improve their individual performance and career growth. You analyze personal engineering metrics and provide practical, growth-oriented suggestions.

RULES:
- Return ONLY a JSON array of 2-4 suggestion strings. No other text.
- Focus on personal skill development, habits, and workflow improvements.
- Be encouraging while being honest about areas for improvement.
- Frame suggestions as growth opportunities, not criticisms.
- Each suggestion should be 1-2 sentences max.
- Compare against team averages when relevant to provide context.

Example output format:
["Your cycle time of 24h per ticket is 50% above team average — try breaking larger tasks into smaller PRs for faster feedback loops.", "Strong estimation accuracy at 1.05x — document your estimation approach to share with the team."]`,

  delivery_manager: `You are a delivery risk analyst focused on epic completion and on-time delivery. You analyze project delivery metrics and provide risk mitigation strategies.

RULES:
- Return ONLY a JSON array of 2-4 suggestion strings. No other text.
- Focus on delivery risks, timeline impacts, and mitigation strategies.
- Prioritize actions that unblock progress and reduce delivery risk.
- Be direct and practical — each suggestion should be 1-2 sentences max.
- Consider epic progress, blocked tickets, and cycle time trends.

Example output format:
["3 blocked tickets in Epic X are holding up 40% of remaining work — escalate blockers in today's standup and assign owners.", "Cycle time has increased 30% this sprint — check if scope creep on in-progress tickets is the cause."]`,

  management: `You are a strategic engineering advisor to senior management (VP/CTO/Director level). You analyze organizational health metrics across multiple engineering teams and projects, identifying systemic patterns, cross-team imbalances, and strategic investment decisions.

RULES:
- Return ONLY a JSON array of 2-4 suggestion strings. No other text.
- Focus on org-wide patterns, cross-project comparisons, and strategic decisions.
- Frame suggestions in terms of investment priorities, capacity allocation, and organizational health.
- Consider bug escape rate, tech debt ratio, flow efficiency, and throughput trends.
- Be direct and executive-level concise — each suggestion should be 1-2 sentences max.
- Never reference individual engineers — Management sees only team and project-level data.

Example output format:
["Tech debt ratio at 35% across 3 projects — consider dedicating a sprint to debt reduction before it compounds further.", "Project ALPHA's p85 cycle time is 2x Project BETA — investigate process differences or resourcing gaps between teams."]`,
};

/**
 * Get the system prompt appropriate for the current persona.
 */
export function getSystemPrompt(): string {
  const cfg = getConfig();
  if (cfg.persona && PERSONA_SYSTEM_PROMPTS[cfg.persona]) {
    return PERSONA_SYSTEM_PROMPTS[cfg.persona];
  }
  return SYSTEM_PROMPT;
}

export function buildUserPrompt(req: AiSuggestRequest): string {
  const parts: string[] = [];

  parts.push(`Metric: ${req.metricLabel} (key: ${req.metricKey})`);
  parts.push(`Current value: ${req.currentValue ?? 'N/A'}`);

  if (req.previousValue != null) {
    parts.push(`Previous period value: ${req.previousValue}`);
  }

  if (req.trendDirection) {
    parts.push(`Trend: ${req.trendDirection}${req.trendPct != null ? ` (${Math.abs(req.trendPct)}%)` : ''}`);
  }

  parts.push(`Context: ${req.context} level`);

  if (req.context === 'individual' && req.engineerName) {
    parts.push(`Engineer: ${req.engineerName}`);
  }

  if (req.teamAverageValue != null) {
    parts.push(`Team average: ${req.teamAverageValue}`);
  }

  if (req.helpContent) {
    parts.push(`\nMetric description:\n${req.helpContent}`);
  }

  parts.push('\nProvide 2-4 actionable suggestions to improve this metric.');

  return parts.join('\n');
}

export function parseAiResponse(text: string): string[] {
  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.every(s => typeof s === 'string')) {
      return parsed;
    }
  } catch {
    // Fall through to regex fallback
  }

  // Fallback: strip markdown code fences and try again
  const stripped = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed) && parsed.every(s => typeof s === 'string')) {
      return parsed;
    }
  } catch {
    // Fall through
  }

  // Last resort: extract anything that looks like a JSON array
  const match = stripped.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.every(s => typeof s === 'string')) {
        return parsed;
      }
    } catch {
      // Give up
    }
  }

  return [];
}

async function callOpenAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Invalid API key. Please check your OpenAI API key in Settings.');
    if (response.status === 429) throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callClaude(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Invalid API key. Please check your Claude API key in Settings.');
    if (response.status === 429) throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}

export async function getAiSuggestions(req: AiSuggestRequest): Promise<AiSuggestResponse> {
  const provider = getAiProvider();
  const apiKey = getAiApiKey();

  if (!provider || !apiKey) {
    return { suggestions: [], error: 'AI not configured. Please set up an API key in Settings.' };
  }

  const userPrompt = buildUserPrompt(req);
  const systemPrompt = getSystemPrompt();

  try {
    const rawResponse = provider === 'openai'
      ? await callOpenAI(apiKey, systemPrompt, userPrompt)
      : await callClaude(apiKey, systemPrompt, userPrompt);

    const suggestions = parseAiResponse(rawResponse);

    if (suggestions.length === 0) {
      return { suggestions: [], error: 'Failed to parse AI response. Please try again.' };
    }

    return { suggestions };
  } catch (err: any) {
    return { suggestions: [], error: err.message || 'Failed to get AI suggestions.' };
  }
}

export async function testAiConnection(): Promise<{ success: boolean; error?: string }> {
  const provider = getAiProvider();
  const apiKey = getAiApiKey();

  if (!provider || !apiKey) {
    return { success: false, error: 'No AI provider configured.' };
  }

  try {
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        if (response.status === 401) return { success: false, error: 'Invalid API key.' };
        return { success: false, error: `API error: ${response.status}` };
      }
      return { success: true };
    } else {
      // Claude: send a minimal message to validate the key
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      if (!response.ok) {
        if (response.status === 401) return { success: false, error: 'Invalid API key.' };
        return { success: false, error: `API error: ${response.status}` };
      }
      return { success: true };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Connection failed.' };
  }
}

// Exported for testing
export { SYSTEM_PROMPT };
