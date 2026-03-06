import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron-store before importing the service
vi.mock('electron-store', () => {
  const data: Record<string, unknown> = {
    mapping_rules: { tpd_bu: {}, work_stream: {} },
    field_ids: { tpd_bu: '', work_stream: '', story_points: '' },
    project_key: '',
    ticket_filter: { mode: 'last_x_months', months: 6 },
    sp_to_days: 1,
    tracked_engineers: [],
  };
  return {
    default: class MockStore {
      constructor() {}
      get(key: string) { return data[key]; }
      set(key: string, value: unknown) { data[key] = value; }
    },
  };
});

import {
  getMappedFields,
  matchFirstGroup,
  evaluateRule,
} from '../../src/main/services/field-engine.service';
import { updateConfig } from '../../src/main/services/config.service';

// ----- evaluateRule -----

describe('evaluateRule', () => {
  it('scalar equals', () => {
    const ctx = { summary: 'Fix login bug', parent_key: '', parent_summary: '', labels: [], components: [], issue_type: '', priority: '', assignee: '' };
    expect(evaluateRule(ctx, { field: 'summary', operator: 'equals', value: 'fix login bug' })).toBe(true);
    expect(evaluateRule(ctx, { field: 'summary', operator: 'equals', value: 'wrong' })).toBe(false);
  });

  it('scalar contains', () => {
    const ctx = { summary: 'Fix login bug', parent_key: '', parent_summary: '', labels: [], components: [], issue_type: '', priority: '', assignee: '' };
    expect(evaluateRule(ctx, { field: 'summary', operator: 'contains', value: 'login' })).toBe(true);
    expect(evaluateRule(ctx, { field: 'summary', operator: 'contains', value: 'signup' })).toBe(false);
  });

  it('scalar starts_with', () => {
    const ctx = { summary: 'Fix login bug', parent_key: '', parent_summary: '', labels: [], components: [], issue_type: '', priority: '', assignee: '' };
    expect(evaluateRule(ctx, { field: 'summary', operator: 'starts_with', value: 'fix' })).toBe(true);
    expect(evaluateRule(ctx, { field: 'summary', operator: 'starts_with', value: 'login' })).toBe(false);
  });

  it('scalar in', () => {
    const ctx = { summary: '', parent_key: '', parent_summary: '', labels: [], components: [], issue_type: '', priority: 'High', assignee: '' };
    expect(evaluateRule(ctx, { field: 'priority', operator: 'in', value: 'High, Medium' })).toBe(true);
    expect(evaluateRule(ctx, { field: 'priority', operator: 'in', value: 'Low, Medium' })).toBe(false);
  });

  it('array equals', () => {
    const ctx = { summary: '', parent_key: '', parent_summary: '', labels: ['B2C', 'Frontend'], components: [], issue_type: '', priority: '', assignee: '' };
    expect(evaluateRule(ctx, { field: 'labels', operator: 'equals', value: 'B2C' })).toBe(true);
    expect(evaluateRule(ctx, { field: 'labels', operator: 'equals', value: 'Backend' })).toBe(false);
  });

  it('array contains', () => {
    const ctx = { summary: '', parent_key: '', parent_summary: '', labels: ['B2C-Frontend', 'Ops'], components: [], issue_type: '', priority: '', assignee: '' };
    expect(evaluateRule(ctx, { field: 'labels', operator: 'contains', value: 'b2c' })).toBe(true);
    expect(evaluateRule(ctx, { field: 'labels', operator: 'contains', value: 'xyz' })).toBe(false);
  });

  it('array starts_with', () => {
    const ctx = { summary: '', parent_key: '', parent_summary: '', labels: [], components: ['backend-api', 'frontend-web'], issue_type: '', priority: '', assignee: '' };
    expect(evaluateRule(ctx, { field: 'components', operator: 'starts_with', value: 'backend' })).toBe(true);
    expect(evaluateRule(ctx, { field: 'components', operator: 'starts_with', value: 'mobile' })).toBe(false);
  });

  it('array in', () => {
    const ctx = { summary: '', parent_key: '', parent_summary: '', labels: ['B2C', 'Frontend'], components: [], issue_type: '', priority: '', assignee: '' };
    expect(evaluateRule(ctx, { field: 'labels', operator: 'in', value: 'B2C, B2B' })).toBe(true);
    expect(evaluateRule(ctx, { field: 'labels', operator: 'in', value: 'B2B, Backend' })).toBe(false);
  });

  it('unknown field returns false', () => {
    const ctx = { summary: 'test', parent_key: '', parent_summary: '', labels: [], components: [], issue_type: '', priority: '', assignee: '' };
    expect(evaluateRule(ctx, { field: 'nonexistent' as any, operator: 'equals', value: 'test' })).toBe(false);
  });

  it('unknown operator returns false', () => {
    const ctx = { summary: 'test', parent_key: '', parent_summary: '', labels: [], components: [], issue_type: '', priority: '', assignee: '' };
    expect(evaluateRule(ctx, { field: 'summary', operator: 'regex' as any, value: 'test' })).toBe(false);
  });

  it('unknown operator on array returns false', () => {
    const ctx = { summary: '', parent_key: '', parent_summary: '', labels: ['test'], components: [], issue_type: '', priority: '', assignee: '' };
    expect(evaluateRule(ctx, { field: 'labels', operator: 'regex' as any, value: 'test' })).toBe(false);
  });
});

// ----- getMappedFields -----

describe('getMappedFields', () => {
  beforeEach(() => {
    // Reset mapping rules via config service
  });

  it('maps from parent key', () => {
    // Set mapping rules directly on the mock store
    updateConfig({
      mapping_rules: {
        tpd_bu: { B2C: [[{ field: 'parent_key', operator: 'equals', value: 'PROJ-1' }]] },
        work_stream: { Product: [[{ field: 'parent_key', operator: 'equals', value: 'PROJ-1' }]] },
      },
    });

    const issue = {
      fields: {
        parent: { key: 'PROJ-1', fields: { summary: 'Parent' } },
        labels: [], components: [], summary: 'Test',
        issuetype: { name: 'Story' }, priority: { name: 'Medium' },
        assignee: { displayName: 'Alice' },
      },
    };
    const [tpd, ws] = getMappedFields(issue);
    expect(tpd).toBe('B2C');
    expect(ws).toBe('Product');
  });

  it('no match returns null', () => {
    updateConfig({
      mapping_rules: {
        tpd_bu: { B2C: [[{ field: 'parent_key', operator: 'equals', value: 'NOMATCH' }]] },
        work_stream: {},
      },
    });

    const issue = {
      fields: {
        parent: { key: 'PROJ-1', fields: { summary: 'Parent' } },
        labels: [], components: [], summary: 'Test',
        issuetype: { name: 'Story' }, priority: { name: 'Medium' },
        assignee: { displayName: 'Alice' },
      },
    };
    const [tpd, ws] = getMappedFields(issue);
    expect(tpd).toBeNull();
    expect(ws).toBeNull();
  });

  it('no parent', () => {
    updateConfig({ mapping_rules: { tpd_bu: {}, work_stream: {} } });

    const issue = {
      fields: {
        labels: [], components: [], summary: 'Test',
        issuetype: { name: 'Story' }, priority: { name: 'Medium' },
        assignee: { displayName: 'Alice' },
      },
    };
    const [tpd, ws] = getMappedFields(issue);
    expect(tpd).toBeNull();
    expect(ws).toBeNull();
  });

  it('context includes all fields', () => {
    updateConfig({
      mapping_rules: {
        tpd_bu: { Match: [[{ field: 'assignee', operator: 'equals', value: 'Alice' }]] },
        work_stream: { WS: [[{ field: 'issue_type', operator: 'equals', value: 'Bug' }]] },
      },
    });

    const issue = {
      fields: {
        parent: { key: 'P-1', fields: { summary: 'Parent Summary' } },
        labels: ['label1'],
        components: [{ name: 'comp1' }],
        summary: 'Test summary',
        issuetype: { name: 'Bug' },
        priority: { name: 'High' },
        assignee: { displayName: 'Alice' },
      },
    };
    const [tpd, ws] = getMappedFields(issue);
    expect(tpd).toBe('Match');
    expect(ws).toBe('WS');
  });
});

// ----- matchFirstGroup -----

describe('matchFirstGroup', () => {
  const ctx = { parent_key: 'PROJ-1', parent_summary: '', labels: [], components: [], summary: '', issue_type: '', priority: '', assignee: '' };

  it('new format Rule[][] matches AND-blocks', () => {
    const groups = {
      GroupA: [[{ field: 'parent_key' as const, operator: 'equals' as const, value: 'PROJ-1' }]],
    };
    expect(matchFirstGroup(ctx, groups)).toBe('GroupA');
  });

  it('old format Rule[] backward compatibility', () => {
    const groups = {
      GroupA: [{ field: 'parent_key' as const, operator: 'equals' as const, value: 'PROJ-1' }] as any,
    };
    expect(matchFirstGroup(ctx, groups)).toBe('GroupA');
  });

  it('empty blocks skip', () => {
    const groups = { GroupA: [] };
    expect(matchFirstGroup(ctx, groups as any)).toBeNull();
  });
});
