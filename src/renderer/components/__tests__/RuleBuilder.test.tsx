import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RuleBuilder from '../RuleBuilder';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

describe('RuleBuilder', () => {
  const defaultProps = {
    title: 'TPD Business Unit',
    color: 'indigo' as const,
    rules: {
      B2C: [[{ field: 'parent_key', operator: 'equals', value: 'PROJ-1' }]],
      B2B: [],
    },
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('calls onChange when rule value is changed', () => {
    const onChange = vi.fn();
    render(<RuleBuilder {...defaultProps} onChange={onChange} />);
    const valueInput = screen.getByDisplayValue('PROJ-1');
    fireEvent.change(valueInput, { target: { value: 'PROJ-2' } });
    expect(onChange).toHaveBeenCalled();
  });
});
