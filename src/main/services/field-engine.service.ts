import { getConfig } from './config.service.js';
import type { Rule, MappingRules } from '../../shared/types.js';

/**
 * Port of backend/field_engine.py — rule-based field mapping.
 */

// ----- Field Mapping (Rule Engine) -----

interface RuleContext {
  parent_key: string;
  parent_summary: string;
  labels: string[];
  components: string[];
  summary: string;
  issue_type: string;
  priority: string;
  assignee: string;
}

/**
 * Evaluate mapping rules to determine TPD BU and Work Stream.
 */
export function getMappedFields(issue: Record<string, unknown>, mappingRulesOverride?: MappingRules): [string | null, string | null] {
  const fields = (issue.fields ?? {}) as Record<string, unknown>;
  const parent = (fields.parent ?? {}) as Record<string, unknown>;
  const parentFields = (parent.fields ?? {}) as Record<string, unknown>;
  const assigneeObj = (fields.assignee ?? {}) as Record<string, unknown>;
  const issueTypeObj = (fields.issuetype ?? {}) as Record<string, unknown>;
  const priorityObj = (fields.priority ?? {}) as Record<string, unknown>;
  const componentsRaw = (fields.components ?? []) as Array<Record<string, string>>;

  const context: RuleContext = {
    parent_key: (parent.key as string) ?? '',
    parent_summary: (parentFields.summary as string) ?? '',
    labels: (fields.labels ?? []) as string[],
    components: componentsRaw.map((c) => c.name ?? ''),
    summary: (fields.summary as string) ?? '',
    issue_type: (issueTypeObj?.name as string) ?? '',
    priority: (priorityObj?.name as string) ?? '',
    assignee: (assigneeObj?.displayName as string) ?? '',
  };

  const rules = mappingRulesOverride ?? getConfig().mapping_rules;
  const tpdBu = matchFirstGroup(context, rules.tpd_bu ?? {});
  const workStream = matchFirstGroup(context, rules.work_stream ?? {});

  return [tpdBu, workStream];
}

/**
 * Return the name of the first group with a matching block, or null.
 *
 * Each group value is Rule[][] (AND-blocks OR'd).
 * Backward compatible: flat Rule[] treated as individual OR blocks.
 */
export function matchFirstGroup(
  context: RuleContext,
  groups: Record<string, Rule[][] | Rule[]>,
): string | null {
  for (const [groupName, blocks] of Object.entries(groups)) {
    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) continue;

    // Backward compat: if first element is a plain object (not array), it's old flat Rule[] format
    if (!Array.isArray(blocks[0])) {
      // Old format: each rule is an independent OR condition
      for (const rule of blocks as Rule[]) {
        if (evaluateRule(context, rule)) return groupName;
      }
    } else {
      // New format: list of AND-blocks
      for (const block of blocks as Rule[][]) {
        if (block && block.length > 0 && block.every((rule) => evaluateRule(context, rule))) {
          return groupName;
        }
      }
    }
  }
  return null;
}

/**
 * Evaluate a single rule against the context.
 */
export function evaluateRule(context: RuleContext, rule: Rule): boolean {
  const field = rule.field ?? '';
  const operator = rule.operator ?? '';
  const value = String(rule.value ?? '');

  const fieldValue = context[field as keyof RuleContext];
  if (fieldValue === undefined || fieldValue === null) return false;

  // Array fields (labels, components)
  if (Array.isArray(fieldValue)) {
    const items = fieldValue.map((v) => String(v).toLowerCase());
    const val = value.toLowerCase();
    switch (operator) {
      case 'equals':
        return items.includes(val);
      case 'contains':
        return items.some((item) => item.includes(val));
      case 'starts_with':
        return items.some((item) => item.startsWith(val));
      case 'in': {
        const targets = value.split(',').map((v) => v.trim().toLowerCase());
        return items.some((item) => targets.includes(item));
      }
      default:
        return false;
    }
  }

  // Scalar fields
  const fv = String(fieldValue).toLowerCase();
  const val = value.toLowerCase();
  switch (operator) {
    case 'equals':
      return fv === val;
    case 'contains':
      return fv.includes(val);
    case 'starts_with':
      return fv.startsWith(val);
    case 'in': {
      const targets = value.split(',').map((v) => v.trim().toLowerCase());
      return targets.includes(fv);
    }
    default:
      return false;
  }
}
