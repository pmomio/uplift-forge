import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DateTime } from 'luxon';

// Mock electron-store before importing the service
vi.mock('electron-store', () => {
  const data: Record<string, unknown> = {
    eng_start_status: 'In Progress',
    eng_end_status: 'Code Review',
    eng_excluded_statuses: ['Blocked'],
    office_hours: {
      start: '09:00',
      end: '18:00',
      timezone: 'Europe/Berlin',
      exclude_weekends: true,
    },
    mapping_rules: { tpd_bu: {}, work_stream: {} },
    field_ids: { tpd_bu: '', eng_hours: '', work_stream: '', story_points: '' },
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
  computeOfficeHours,
  calculateEngineeringHours,
  getMappedFields,
  matchFirstGroup,
  evaluateRule,
} from '../../src/main/services/field-engine.service';
import { getConfig, updateConfig } from '../../src/main/services/config.service';

function makeStatusHistory(created: string, fromStatus: string, toStatus: string) {
  return {
    created,
    items: [{ field: 'status', fromString: fromStatus, toString: toStatus }],
  };
}

// ----- computeOfficeHours -----

describe('computeOfficeHours', () => {
  const officeConfig = {
    start: '09:00',
    end: '18:00',
    timezone: 'Europe/Berlin',
    exclude_weekends: true,
  };

  it('same day within office hours', () => {
    // Thursday Feb 26 2026, 10:00 UTC = 11:00 Berlin, 12:00 UTC = 13:00 Berlin
    const start = DateTime.fromISO('2026-02-26T10:00:00Z');
    const end = DateTime.fromISO('2026-02-26T12:00:00Z');
    expect(computeOfficeHours(start, end, officeConfig)).toBe(2.0);
  });

  it('over weekend', () => {
    // Friday Feb 20 2026 17:00 Berlin to Monday Feb 23 10:00 Berlin
    const start = DateTime.fromISO('2026-02-20T16:00:00Z'); // 17:00 Berlin
    const end = DateTime.fromISO('2026-02-23T09:00:00Z');   // 10:00 Berlin
    // Friday: 17:00-18:00 = 1h, Sat/Sun: 0, Monday: 09:00-10:00 = 1h
    expect(computeOfficeHours(start, end, officeConfig)).toBe(2.0);
  });

  it('before office start', () => {
    const tz = 'Europe/Berlin';
    const start = DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 7 }, { zone: tz });
    const end = DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 10 }, { zone: tz });
    // Only 09:00-10:00 counts = 1 hour
    expect(computeOfficeHours(start, end, officeConfig)).toBe(1.0);
  });

  it('after office end', () => {
    const tz = 'Europe/Berlin';
    const start = DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 17 }, { zone: tz });
    const end = DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 20 }, { zone: tz });
    // Only 17:00-18:00 counts = 1 hour
    expect(computeOfficeHours(start, end, officeConfig)).toBe(1.0);
  });

  it('entirely outside office hours', () => {
    const tz = 'Europe/Berlin';
    const start = DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 19 }, { zone: tz });
    const end = DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 22 }, { zone: tz });
    expect(computeOfficeHours(start, end, officeConfig)).toBe(0);
  });

  it('multi-day span', () => {
    const tz = 'Europe/Berlin';
    // Wednesday 09:00 to Friday 18:00 = 3 full days = 27 hours
    const start = DateTime.fromObject({ year: 2026, month: 2, day: 25, hour: 9 }, { zone: tz });
    const end = DateTime.fromObject({ year: 2026, month: 2, day: 27, hour: 18 }, { zone: tz });
    expect(computeOfficeHours(start, end, officeConfig)).toBe(27.0);
  });
});

// ----- calculateEngineeringHours -----

describe('calculateEngineeringHours', () => {
  const tz = 'Europe/Berlin';

  it('excludes blocked time', () => {
    const histories = [
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 10 }, { zone: tz }).toISO()!, 'Open', 'In Progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 12 }, { zone: tz }).toISO()!, 'In Progress', 'Blocked'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 14 }, { zone: tz }).toISO()!, 'Blocked', 'In Progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 16 }, { zone: tz }).toISO()!, 'In Progress', 'Code Review'),
    ];
    expect(calculateEngineeringHours(histories)).toBe(4.0);
  });

  it('no blocked time', () => {
    const histories = [
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 10 }, { zone: tz }).toISO()!, 'Open', 'In Progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 14 }, { zone: tz }).toISO()!, 'In Progress', 'Code Review'),
    ];
    expect(calculateEngineeringHours(histories)).toBe(4.0);
  });

  it('blocked until end', () => {
    const histories = [
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 10 }, { zone: tz }).toISO()!, 'Open', 'In Progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 12 }, { zone: tz }).toISO()!, 'In Progress', 'Blocked'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 14 }, { zone: tz }).toISO()!, 'Blocked', 'Code Review'),
    ];
    expect(calculateEngineeringHours(histories)).toBe(2.0);
  });

  it('multiple blocked periods', () => {
    const histories = [
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 9 }, { zone: tz }).toISO()!, 'Open', 'In Progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 10 }, { zone: tz }).toISO()!, 'In Progress', 'Blocked'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 11 }, { zone: tz }).toISO()!, 'Blocked', 'In Progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 13 }, { zone: tz }).toISO()!, 'In Progress', 'Blocked'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 15 }, { zone: tz }).toISO()!, 'Blocked', 'In Progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 17 }, { zone: tz }).toISO()!, 'In Progress', 'Code Review'),
    ];
    // Active: 9-10 (1h) + 11-13 (2h) + 15-17 (2h) = 5h
    expect(calculateEngineeringHours(histories)).toBe(5.0);
  });

  it('non-list input returns null', () => {
    expect(calculateEngineeringHours(null as unknown as any[])).toBeNull();
    expect(calculateEngineeringHours('not a list' as unknown as any[])).toBeNull();
  });

  it('no start status returns null', () => {
    const histories = [
      makeStatusHistory('2026-02-26T10:00:00+01:00', 'Open', 'Code Review'),
    ];
    expect(calculateEngineeringHours(histories)).toBeNull();
  });

  it('no end status returns null', () => {
    const histories = [
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 10 }, { zone: tz }).toISO()!, 'Open', 'In Progress'),
    ];
    expect(calculateEngineeringHours(histories)).toBeNull();
  });

  it('case insensitive status matching', () => {
    const histories = [
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 10 }, { zone: tz }).toISO()!, 'Open', 'in progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 14 }, { zone: tz }).toISO()!, 'in progress', 'code review'),
    ];
    expect(calculateEngineeringHours(histories)).toBe(4.0);
  });

  it('multiple start→end cycles accumulate total hours', () => {
    // Cycle 1: In Progress (10:00) → Code Review (12:00) = 2h
    // Cycle 2: In Progress (14:00) → Code Review (16:00) = 2h
    // Total = 4h
    const histories = [
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 10 }, { zone: tz }).toISO()!, 'Open', 'In Progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 12 }, { zone: tz }).toISO()!, 'In Progress', 'Code Review'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 14 }, { zone: tz }).toISO()!, 'Code Review', 'In Progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 16 }, { zone: tz }).toISO()!, 'In Progress', 'Code Review'),
    ];
    expect(calculateEngineeringHours(histories)).toBe(4.0);
  });

  it('three cycles with blocked periods', () => {
    // Cycle 1: In Progress (09:00) → Code Review (10:00) = 1h
    // Cycle 2: In Progress (11:00) → Blocked (12:00) = 1h active, then blocked
    //          Blocked (12:00) → In Progress (14:00) = not counted
    //          In Progress (14:00) → Code Review (16:00) = 2h
    // Total = 1 + 1 + 2 = 4h
    const histories = [
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 9 }, { zone: tz }).toISO()!, 'Open', 'In Progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 10 }, { zone: tz }).toISO()!, 'In Progress', 'Code Review'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 11 }, { zone: tz }).toISO()!, 'Code Review', 'In Progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 12 }, { zone: tz }).toISO()!, 'In Progress', 'Blocked'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 14 }, { zone: tz }).toISO()!, 'Blocked', 'In Progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 16 }, { zone: tz }).toISO()!, 'In Progress', 'Code Review'),
    ];
    expect(calculateEngineeringHours(histories)).toBe(4.0);
  });

  it('blocked then directly to end status', () => {
    // In Progress (10:00) → Blocked (12:00) = 2h active
    // Blocked → Code Review (14:00) = blocked time not counted
    // Total = 2h
    const histories = [
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 10 }, { zone: tz }).toISO()!, 'Open', 'In Progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 12 }, { zone: tz }).toISO()!, 'In Progress', 'Blocked'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 14 }, { zone: tz }).toISO()!, 'Blocked', 'Code Review'),
    ];
    expect(calculateEngineeringHours(histories)).toBe(2.0);
  });

  it('incomplete second cycle only counts first', () => {
    // Cycle 1: In Progress (10:00) → Code Review (12:00) = 2h
    // Cycle 2: In Progress (14:00) → (still open, no end) = not counted
    // Total = 2h
    const histories = [
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 10 }, { zone: tz }).toISO()!, 'Open', 'In Progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 12 }, { zone: tz }).toISO()!, 'In Progress', 'Code Review'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 14 }, { zone: tz }).toISO()!, 'Code Review', 'In Progress'),
    ];
    expect(calculateEngineeringHours(histories)).toBe(2.0);
  });

  it('intermediate statuses keep clock running', () => {
    // In Progress (10:00) → Peer Review (12:00): clock keeps running (not end/excluded)
    // Peer Review (12:00) → Code Review (14:00): only In Progress→Peer Review was 'active' state
    // Wait — Peer Review is neither start, end, nor excluded. State stays 'active'.
    // So total active: In Progress (10:00) → Code Review (14:00) = 4h
    const histories = [
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 10 }, { zone: tz }).toISO()!, 'Open', 'In Progress'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 12 }, { zone: tz }).toISO()!, 'In Progress', 'Peer Review'),
      makeStatusHistory(DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 14 }, { zone: tz }).toISO()!, 'Peer Review', 'Code Review'),
    ];
    expect(calculateEngineeringHours(histories)).toBe(4.0);
  });

  it('handles raw JIRA items where toString is not an own property', () => {
    const histories = [
      {
        created: DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 10 }, { zone: tz }).toISO()!,
        items: [Object.assign(Object.create(null), { field: 'status', fromString: 'Open', toString: 'In Progress' })],
      },
      {
        created: DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 14 }, { zone: tz }).toISO()!,
        items: [Object.assign(Object.create(null), { field: 'status', fromString: 'In Progress', toString: 'Code Review' })],
      },
    ];
    expect(calculateEngineeringHours(histories)).toBe(4.0);
  });

  it('gracefully handles missing toString property (no prototype fallback)', () => {
    const histories = [
      {
        created: DateTime.fromObject({ year: 2026, month: 2, day: 26, hour: 10 }, { zone: tz }).toISO()!,
        items: [{ field: 'status', fromString: 'Open' }],
      },
    ];
    expect(calculateEngineeringHours(histories as any)).toBeNull();
  });
});

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
