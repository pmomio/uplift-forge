import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '../HomePage';

describe('HomePage', () => {
  it('renders welcome message without project', () => {
    render(<HomePage />);
    expect(screen.getByText('Welcome to Uplift Forge')).toBeInTheDocument();
  });

  it('renders project name when provided', () => {
    render(<HomePage project={{ key: 'PROJ', name: 'My Team', lead: null, avatar: null }} />);
    expect(screen.getByText('My Team')).toBeInTheDocument();
  });

  it('renders personalized description with project name', () => {
    render(<HomePage project={{ key: 'PROJ', name: 'My Team', lead: null, avatar: null }} />);
    expect(screen.getByText(/Engineering performance dashboard for the My Team team/)).toBeInTheDocument();
  });

  it('renders generic description without project', () => {
    render(<HomePage />);
    expect(screen.getByText(/uplifting engineering team performance/)).toBeInTheDocument();
  });

  it('shows project avatar when provided', () => {
    const { container } = render(<HomePage project={{ key: 'PROJ', name: 'My Team', lead: null, avatar: 'https://img.png' }} />);
    const img = container.querySelector('img[src="https://img.png"]');
    expect(img).toBeInTheDocument();
  });

  it('renders getting started steps', () => {
    render(<HomePage />);
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Configure your JIRA project')).toBeInTheDocument();
    expect(screen.getByText('Map your fields')).toBeInTheDocument();
    expect(screen.getByText('Set up mapping rules')).toBeInTheDocument();
    expect(screen.getByText('View Engineering Attribution')).toBeInTheDocument();
  });

  it('renders feature cards', () => {
    render(<HomePage />);
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Engineering Hours')).toBeInTheDocument();
    expect(screen.getByText('Rule-Based Mapping')).toBeInTheDocument();
    expect(screen.getByText('Inline Editing')).toBeInTheDocument();
    expect(screen.getByText('Smart Filters')).toBeInTheDocument();
  });

  it('renders page header', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Home');
  });
});
