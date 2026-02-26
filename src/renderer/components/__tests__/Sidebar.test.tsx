import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar, { TABS } from '../Sidebar';

describe('Sidebar', () => {
  const defaultProps = {
    activeTab: 'home',
    onTabChange: vi.fn(),
    project: null,
  };

  it('renders all navigation tabs', () => {
    render(<Sidebar {...defaultProps} />);
    for (const tab of TABS) {
      expect(screen.getByText(tab.label)).toBeInTheDocument();
    }
  });

  it('highlights the active tab', () => {
    render(<Sidebar {...defaultProps} activeTab="metrics" />);
    const metricsButton = screen.getByText('Team Metrics').closest('button');
    expect(metricsButton?.className).toContain('indigo');
  });

  it('calls onTabChange when tab clicked', () => {
    const onTabChange = vi.fn();
    render(<Sidebar {...defaultProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText('Configuration'));
    expect(onTabChange).toHaveBeenCalledWith('config');
  });

  it('shows project name when provided', () => {
    render(<Sidebar {...defaultProps} project={{ key: 'PROJ', name: 'My Project', lead: 'Alice', avatar: null }} />);
    expect(screen.getByText('My Project')).toBeInTheDocument();
    expect(screen.getByText('PROJ')).toBeInTheDocument();
  });

  it('shows default name when no project', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Uplift Forge')).toBeInTheDocument();
  });

  it('shows project avatar when provided', () => {
    const { container } = render(<Sidebar {...defaultProps} project={{ key: 'P', name: 'P', lead: null, avatar: 'https://img.png' }} />);
    const img = container.querySelector('img[src="https://img.png"]');
    expect(img).toBeInTheDocument();
  });

  it('shows project lead when provided', () => {
    render(<Sidebar {...defaultProps} project={{ key: 'P', name: 'P', lead: 'Alice Lead', avatar: null }} />);
    expect(screen.getByText('Alice Lead')).toBeInTheDocument();
    expect(screen.getByText('Lead')).toBeInTheDocument();
  });

  it('does not show lead section when lead is null', () => {
    render(<Sidebar {...defaultProps} project={{ key: 'P', name: 'P', lead: null, avatar: null }} />);
    expect(screen.queryByText('Lead')).not.toBeInTheDocument();
  });
});
