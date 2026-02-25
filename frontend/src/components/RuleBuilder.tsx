import React, { useState } from 'react';
import { Plus, X, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import ModalDialog from './ModalDialog';

interface Rule {
  field: string;
  operator: string;
  value: string;
}

// Each group is an array of AND-blocks. Each AND-block is Rule[].
// Blocks are OR'd together; rules within a block are AND'd.
interface RuleGroups {
  [groupName: string]: Rule[][];
}

interface RuleBuilderProps {
  title: string;
  color: 'indigo' | 'emerald';
  groups: RuleGroups;
  onChange: (groups: RuleGroups) => void;
}

const FIELDS = [
  { id: 'parent_key', label: 'Parent Key', hint: 'e.g. ACTIN-195' },
  { id: 'parent_summary', label: 'Parent Summary', hint: 'e.g. Support Requests' },
  { id: 'labels', label: 'Labels', hint: 'e.g. ACTINOPS' },
  { id: 'components', label: 'Components', hint: 'e.g. backend' },
  { id: 'summary', label: 'Summary', hint: 'ticket title text' },
  { id: 'issue_type', label: 'Issue Type', hint: 'e.g. Task, Story, Bug' },
  { id: 'priority', label: 'Priority', hint: 'e.g. High, Medium' },
  { id: 'assignee', label: 'Assignee', hint: 'e.g. John Doe' },
];

const OPERATORS = [
  { id: 'equals', label: 'equals', hint: 'exact match' },
  { id: 'contains', label: 'contains', hint: 'substring match' },
  { id: 'starts_with', label: 'starts with', hint: 'prefix match' },
  { id: 'in', label: 'in list', hint: 'comma-separated values' },
];

const colorMap = {
  indigo: {
    bg: 'bg-indigo-500/8',
    border: 'border-indigo-500/20',
    title: 'text-indigo-300',
    groupBg: 'bg-indigo-500/5',
    groupBorder: 'border-indigo-500/15',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    btn: 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-400/10',
    addGroup: 'border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10',
    blockBg: 'bg-indigo-500/5',
    blockBorder: 'border-indigo-500/10',
    orDivider: 'border-indigo-500/20 text-indigo-400/60',
  },
  emerald: {
    bg: 'bg-emerald-500/8',
    border: 'border-emerald-500/20',
    title: 'text-emerald-300',
    groupBg: 'bg-emerald-500/5',
    groupBorder: 'border-emerald-500/15',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    btn: 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10',
    addGroup: 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10',
    blockBg: 'bg-emerald-500/5',
    blockBorder: 'border-emerald-500/10',
    orDivider: 'border-emerald-500/20 text-emerald-400/60',
  },
};

const newRule = (): Rule => ({ field: 'parent_key', operator: 'equals', value: '' });

const RuleBuilder: React.FC<RuleBuilderProps> = ({ title, color, groups, onChange }) => {
  const c = colorMap[color];

  // Modal state
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  // --- mutations ---

  const updateRule = (group: string, blockIdx: number, ruleIdx: number, patch: Partial<Rule>) => {
    const updated = { ...groups };
    const blocks = updated[group].map(b => [...b]);
    blocks[blockIdx][ruleIdx] = { ...blocks[blockIdx][ruleIdx], ...patch };
    updated[group] = blocks;
    onChange(updated);
  };

  const removeRule = (group: string, blockIdx: number, ruleIdx: number) => {
    const updated = { ...groups };
    const blocks = updated[group].map(b => [...b]);
    blocks[blockIdx] = blocks[blockIdx].filter((_: Rule, i: number) => i !== ruleIdx);
    // If the block is now empty, remove the whole block
    updated[group] = blocks.filter(b => b.length > 0);
    onChange(updated);
  };

  const addAndCondition = (group: string, blockIdx: number) => {
    const updated = { ...groups };
    const blocks = updated[group].map(b => [...b]);
    blocks[blockIdx] = [...blocks[blockIdx], newRule()];
    updated[group] = blocks;
    onChange(updated);
  };

  const addOrBlock = (group: string) => {
    const updated = { ...groups };
    updated[group] = [...(updated[group] || []), [newRule()]];
    onChange(updated);
  };

  const handleAddGroup = (name: string) => {
    onChange({ ...groups, [name]: [] });
    toast.success(`Group "${name}" added`);
  };

  const handleRemoveGroup = (group: string) => {
    const updated = { ...groups };
    delete updated[group];
    onChange(updated);
    toast.success(`Group "${group}" removed`);
  };

  const removeBlock = (group: string, blockIdx: number) => {
    const updated = { ...groups };
    updated[group] = updated[group].filter((_: Rule[], i: number) => i !== blockIdx);
    onChange(updated);
  };

  return (
    <section className={`${c.bg} p-4 rounded-lg border ${c.border}`}>
      <h3 className={`text-sm font-semibold ${c.title} mb-4 uppercase tracking-wider`}>
        {title}
      </h3>

      {Object.keys(groups).length === 0 && (
        <p className="text-sm text-slate-500 italic py-2">No groups defined yet.</p>
      )}

      <div className="space-y-3">
        {Object.entries(groups).map(([groupName, blocks]) => (
          <div key={groupName} className={`${c.groupBg} border ${c.groupBorder} rounded-lg p-3`}>
            {/* Group header */}
            <div className="flex justify-between items-center mb-2">
              <span className={`text-sm font-semibold ${c.badge} px-2.5 py-0.5 rounded-full border`}>
                {groupName}
              </span>
              <button
                onClick={() => setConfirmRemove(groupName)}
                className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                title="Remove group"
              >
                <X size={14} />
              </button>
            </div>

            {blocks.length === 0 && (
              <p className="text-xs text-slate-500 italic py-1 ml-1">No rules — click + to add one</p>
            )}

            {/* AND-blocks separated by OR dividers */}
            <div className="space-y-0">
              {blocks.map((block: Rule[], blockIdx: number) => (
                <div key={blockIdx}>
                  {/* OR divider between blocks */}
                  {blockIdx > 0 && (
                    <div className={`flex items-center gap-2 my-2`}>
                      <div className={`flex-1 border-t ${c.orDivider}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${c.orDivider}`}>OR</span>
                      <div className={`flex-1 border-t ${c.orDivider}`} />
                    </div>
                  )}

                  {/* AND-block */}
                  <div className={`${c.blockBg} border ${c.blockBorder} rounded-md p-2`}>
                    <div className="space-y-1.5">
                      {block.map((rule: Rule, ruleIdx: number) => (
                        <div key={ruleIdx} className="flex items-center gap-1.5 text-xs">
                          <span className="text-slate-500 w-7 text-right shrink-0 font-medium">
                            {ruleIdx === 0 ? 'IF' : 'AND'}
                          </span>
                          <select
                            className="bg-slate-700/60 border border-slate-600/60 text-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer min-w-0"
                            value={rule.field}
                            onChange={(e) => updateRule(groupName, blockIdx, ruleIdx, { field: e.target.value })}
                          >
                            {FIELDS.map(f => (
                              <option key={f.id} value={f.id}>{f.label}</option>
                            ))}
                          </select>
                          <select
                            className="bg-slate-700/60 border border-slate-600/60 text-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer min-w-0"
                            value={rule.operator}
                            onChange={(e) => updateRule(groupName, blockIdx, ruleIdx, { operator: e.target.value })}
                          >
                            {OPERATORS.map(o => (
                              <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            className="bg-slate-700/60 border border-slate-600/60 text-slate-200 rounded px-1.5 py-1 flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-slate-500 font-mono placeholder:text-slate-500"
                            placeholder={FIELDS.find(f => f.id === rule.field)?.hint || 'value'}
                            value={rule.value}
                            onChange={(e) => updateRule(groupName, blockIdx, ruleIdx, { value: e.target.value })}
                          />
                          <button
                            onClick={() => removeRule(groupName, blockIdx, ruleIdx)}
                            className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors shrink-0"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        onClick={() => addAndCondition(groupName, blockIdx)}
                        className={`inline-flex items-center gap-1 text-[11px] ${c.btn} px-2 py-0.5 rounded transition-colors`}
                      >
                        <Plus size={11} /> AND
                      </button>
                      {blocks.length > 1 && (
                        <button
                          onClick={() => removeBlock(groupName, blockIdx)}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-400 px-2 py-0.5 rounded transition-colors"
                        >
                          <X size={11} /> Remove block
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add OR block button */}
            <button
              onClick={() => addOrBlock(groupName)}
              className={`mt-2 inline-flex items-center gap-1 text-xs ${c.btn} px-2 py-0.5 rounded transition-colors`}
            >
              <Plus size={12} /> OR Block
            </button>

            {/* Help text */}
            {blocks.length > 0 && (
              <div className="mt-1.5 flex items-start gap-1 text-[10px] text-slate-500">
                <Info size={10} className="mt-0.5 shrink-0" />
                <span>
                  Within a block, all conditions must match (<strong>AND</strong>).
                  {blocks.length > 1 && <> Across blocks, any match is sufficient (<strong>OR</strong>).</>}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowAddGroup(true)}
        className={`mt-3 w-full border border-dashed ${c.addGroup} rounded-lg py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1`}
      >
        <Plus size={13} /> Add Group
      </button>

      <div className="mt-3 flex items-start gap-1.5 text-[10px] text-slate-500">
        <Info size={11} className="mt-0.5 shrink-0" />
        <span>
          Rules are checked top to bottom. A ticket is assigned to the <strong>first group</strong> that matches.
          For array fields (Labels, Components), "equals" checks if any element matches exactly.
        </span>
      </div>

      {/* Add Group modal */}
      <ModalDialog
        open={showAddGroup}
        onClose={() => setShowAddGroup(false)}
        mode="prompt"
        title="Add Group"
        message="Enter a name for the new group."
        placeholder="e.g. B2C, Operational"
        confirmLabel="Add"
        onSubmit={handleAddGroup}
        validate={(v) => {
          if (!v) return 'Group name cannot be empty';
          if (groups[v]) return `Group "${v}" already exists`;
          return null;
        }}
      />

      {/* Remove Group confirm modal */}
      <ModalDialog
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        mode="confirm"
        title="Remove Group"
        message={`Remove "${confirmRemove}" and all its rules?`}
        confirmLabel="Remove"
        confirmColor="rose"
        onConfirm={() => {
          if (confirmRemove) handleRemoveGroup(confirmRemove);
          setConfirmRemove(null);
        }}
      />
    </section>
  );
};

export default RuleBuilder;
