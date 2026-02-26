import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RuleBuilder from '../RuleBuilder';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import toast from 'react-hot-toast';

describe('RuleBuilder', () => {
  const defaultProps = {
    title: 'TPD Business Unit',
    color: 'indigo' as const,
    groups: {
      B2C: [[{ field: 'parent_key', operator: 'equals', value: 'PROJ-1' }]],
      B2B: [],
    },
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Basic Rendering ---
  it('renders title', () => {
    render(<RuleBuilder {...defaultProps} />);
    expect(screen.getByText('TPD Business Unit')).toBeInTheDocument();
  });

  it('renders group names', () => {
    render(<RuleBuilder {...defaultProps} />);
    expect(screen.getByText('B2C')).toBeInTheDocument();
    expect(screen.getByText('B2B')).toBeInTheDocument();
  });

  it('renders rules within groups', () => {
    render(<RuleBuilder {...defaultProps} />);
    expect(screen.getByDisplayValue('PROJ-1')).toBeInTheDocument();
  });

  it('shows add group button', () => {
    render(<RuleBuilder {...defaultProps} />);
    expect(screen.getByText('Add Group')).toBeInTheDocument();
  });

  // --- Color variants ---
  it('renders with emerald color', () => {
    render(<RuleBuilder {...defaultProps} color="emerald" />);
    expect(screen.getByText('TPD Business Unit')).toBeInTheDocument();
  });

  it('renders with violet color', () => {
    render(<RuleBuilder {...defaultProps} color="violet" />);
    expect(screen.getByText('TPD Business Unit')).toBeInTheDocument();
  });

  // --- Empty states ---
  it('renders with empty groups', () => {
    render(<RuleBuilder {...defaultProps} groups={{}} />);
    expect(screen.getByText('Add Group')).toBeInTheDocument();
    expect(screen.getByText('No groups defined yet.')).toBeInTheDocument();
  });

  it('renders group with no rules (shows hint)', () => {
    render(<RuleBuilder {...defaultProps} groups={{ Empty: [] }} />);
    expect(screen.getByText('Empty')).toBeInTheDocument();
    expect(screen.getByText(/No rules/)).toBeInTheDocument();
  });

  // --- Multiple rules ---
  it('renders multiple rules in AND block', () => {
    const groups = {
      B2C: [[
        { field: 'parent_key', operator: 'equals', value: 'P-1' },
        { field: 'labels', operator: 'contains', value: 'B2C' },
      ]],
    };
    render(<RuleBuilder {...defaultProps} groups={groups} />);
    expect(screen.getByDisplayValue('P-1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('B2C')).toBeInTheDocument();
    // Should show IF and AND labels
    expect(screen.getByText('IF')).toBeInTheDocument();
    // Multiple elements may have "AND" text (label + button)
    const andElements = screen.getAllByText('AND');
    expect(andElements.length).toBeGreaterThan(0);
  });

  it('renders multiple OR blocks', () => {
    const groups = {
      B2C: [
        [{ field: 'parent_key', operator: 'equals', value: 'P-1' }],
        [{ field: 'labels', operator: 'contains', value: 'B2C' }],
      ],
    };
    render(<RuleBuilder {...defaultProps} groups={groups} />);
    expect(screen.getByDisplayValue('P-1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('B2C')).toBeInTheDocument();
    const orElements = screen.getAllByText('OR');
    expect(orElements.length).toBeGreaterThan(0);
  });

  // --- Help text ---
  it('shows AND/OR help text when blocks exist', () => {
    render(<RuleBuilder {...defaultProps} />);
    expect(screen.getByText(/all conditions must match/)).toBeInTheDocument();
  });

  it('shows info about rule matching order', () => {
    render(<RuleBuilder {...defaultProps} />);
    expect(screen.getByText(/Rules are checked top to bottom/)).toBeInTheDocument();
  });

  // --- Updating rules ---
  it('calls onChange when rule value is changed', () => {
    const onChange = vi.fn();
    render(<RuleBuilder {...defaultProps} onChange={onChange} />);
    const valueInput = screen.getByDisplayValue('PROJ-1');
    fireEvent.change(valueInput, { target: { value: 'PROJ-2' } });
    expect(onChange).toHaveBeenCalled();
    const newGroups = onChange.mock.calls[0][0];
    expect(newGroups.B2C[0][0].value).toBe('PROJ-2');
  });

  it('calls onChange when rule field is changed', () => {
    const onChange = vi.fn();
    render(<RuleBuilder {...defaultProps} onChange={onChange} />);
    // Find the field select (first combobox should be the field selector)
    const selects = screen.getAllByRole('combobox');
    const fieldSelect = selects.find(s => (s as HTMLSelectElement).value === 'parent_key');
    expect(fieldSelect).toBeDefined();
    if (fieldSelect) {
      fireEvent.change(fieldSelect, { target: { value: 'labels' } });
      expect(onChange).toHaveBeenCalled();
      const newGroups = onChange.mock.calls[0][0];
      expect(newGroups.B2C[0][0].field).toBe('labels');
    }
  });

  it('calls onChange when rule operator is changed', () => {
    const onChange = vi.fn();
    render(<RuleBuilder {...defaultProps} onChange={onChange} />);
    const selects = screen.getAllByRole('combobox');
    const opSelect = selects.find(s => (s as HTMLSelectElement).value === 'equals');
    expect(opSelect).toBeDefined();
    if (opSelect) {
      fireEvent.change(opSelect, { target: { value: 'contains' } });
      expect(onChange).toHaveBeenCalled();
      const newGroups = onChange.mock.calls[0][0];
      expect(newGroups.B2C[0][0].operator).toBe('contains');
    }
  });

  // --- Removing rules ---
  it('removes a rule when removing the last rule empties the block', () => {
    const onChange = vi.fn();
    // A single rule in a block — removing it should remove the block
    const groups = {
      B2C: [[{ field: 'parent_key', operator: 'equals', value: 'P-1' }]],
    };
    const { container } = render(<RuleBuilder {...defaultProps} groups={groups} onChange={onChange} />);
    // Find the X button closest to the rule value input
    const valueInput = screen.getByDisplayValue('P-1');
    // Navigate up to the rule row and find its delete button
    const ruleRow = valueInput.closest('.flex');
    const buttons = ruleRow?.querySelectorAll('button') || [];
    // The last button in the rule row is the remove button
    const removeBtn = buttons[buttons.length - 1];
    expect(removeBtn).toBeDefined();
    if (removeBtn) fireEvent.click(removeBtn);
    expect(onChange).toHaveBeenCalled();
    // The block should be empty after removing the only rule, so blocks array should be empty
    const newGroups = onChange.mock.calls[0][0];
    expect(newGroups.B2C.length).toBe(0);
  });

  // --- Adding AND conditions ---
  it('adds AND condition when AND button clicked', () => {
    const onChange = vi.fn();
    render(<RuleBuilder {...defaultProps} onChange={onChange} />);
    const andButtons = screen.getAllByText(/AND/);
    const addAndBtn = andButtons.find(el => el.closest('button'));
    expect(addAndBtn).toBeDefined();
    if (addAndBtn) {
      fireEvent.click(addAndBtn.closest('button')!);
      expect(onChange).toHaveBeenCalled();
      const newGroups = onChange.mock.calls[0][0];
      // Should have 2 rules in the first block now
      expect(newGroups.B2C[0].length).toBe(2);
    }
  });

  // --- Adding OR blocks ---
  it('adds OR block when OR Block button clicked', () => {
    const onChange = vi.fn();
    render(<RuleBuilder {...defaultProps} onChange={onChange} />);
    const orButtons = screen.getAllByText(/OR Block/);
    expect(orButtons.length).toBeGreaterThan(0);
    fireEvent.click(orButtons[0].closest('button')!);
    expect(onChange).toHaveBeenCalled();
    const newGroups = onChange.mock.calls[0][0];
    expect(newGroups.B2C.length).toBe(2);
  });

  // --- Remove block ---
  it('shows remove block button when multiple blocks exist', () => {
    const groups = {
      B2C: [
        [{ field: 'parent_key', operator: 'equals', value: 'P-1' }],
        [{ field: 'labels', operator: 'contains', value: 'B2C' }],
      ],
    };
    render(<RuleBuilder {...defaultProps} groups={groups} />);
    expect(screen.getAllByText('Remove block').length).toBeGreaterThan(0);
  });

  it('calls onChange when block is removed', () => {
    const onChange = vi.fn();
    const groups = {
      B2C: [
        [{ field: 'parent_key', operator: 'equals', value: 'P-1' }],
        [{ field: 'labels', operator: 'contains', value: 'B2C' }],
      ],
    };
    render(<RuleBuilder {...defaultProps} groups={groups} onChange={onChange} />);
    const removeBlockBtns = screen.getAllByText('Remove block');
    fireEvent.click(removeBlockBtns[0]);
    expect(onChange).toHaveBeenCalled();
    const newGroups = onChange.mock.calls[0][0];
    expect(newGroups.B2C.length).toBe(1);
  });

  // --- Add Group modal ---
  it('opens add group modal when Add Group clicked', () => {
    render(<RuleBuilder {...defaultProps} />);
    fireEvent.click(screen.getByText('Add Group'));
    expect(screen.getByText('Enter a name for the new group.')).toBeInTheDocument();
  });

  it('adds group via modal', () => {
    const onChange = vi.fn();
    render(<RuleBuilder {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByText('Add Group'));
    // Type in the prompt input (use placeholder to find the right one)
    const input = screen.getByPlaceholderText('e.g. B2C, Operational');
    fireEvent.change(input, { target: { value: 'NewGroup' } });
    // Click Add button
    fireEvent.click(screen.getByText('Add'));
    expect(onChange).toHaveBeenCalled();
    const newGroups = onChange.mock.calls[0][0];
    expect(newGroups.NewGroup).toEqual([]);
    expect(toast.success).toHaveBeenCalled();
  });

  // --- Remove Group modal ---
  it('opens confirm dialog when remove group X is clicked', () => {
    render(<RuleBuilder {...defaultProps} />);
    // The X button in group header
    const allButtons = screen.getAllByRole('button');
    const removeGroupBtns = allButtons.filter(b => b.getAttribute('title') === 'Remove group');
    expect(removeGroupBtns.length).toBeGreaterThan(0);
    fireEvent.click(removeGroupBtns[0]);
    expect(screen.getByText('Remove Group')).toBeInTheDocument();
  });

  it('removes group on confirm', () => {
    const onChange = vi.fn();
    render(<RuleBuilder {...defaultProps} onChange={onChange} />);
    const removeGroupBtns = screen.getAllByTitle('Remove group');
    fireEvent.click(removeGroupBtns[0]);
    // Confirm removal
    fireEvent.click(screen.getByText('Remove'));
    expect(onChange).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  // --- Field and operator options rendering ---
  it('renders all field options in select', () => {
    render(<RuleBuilder {...defaultProps} />);
    expect(screen.getByText('Parent Key')).toBeInTheDocument();
  });

  it('renders operator options', () => {
    render(<RuleBuilder {...defaultProps} />);
    const selects = screen.getAllByRole('combobox');
    const opSelect = selects.find(s => (s as HTMLSelectElement).value === 'equals');
    expect(opSelect).toBeDefined();
  });
});
