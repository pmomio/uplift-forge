import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api', () => ({
  saveConfig: vi.fn().mockResolvedValue({ data: {} }),
  getConfig: vi.fn().mockResolvedValue({ data: {} }),
}));

import OnboardingWizard from '../OnboardingWizard';
import { saveConfig, getConfig } from '../../api';
import toast from 'react-hot-toast';

describe('OnboardingWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
  });

  it('renders welcome step initially', () => {
    render(<OnboardingWizard onComplete={vi.fn()} />);
    expect(screen.getByText('Welcome to Uplift Forge')).toBeInTheDocument();
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });

  it('shows step labels in progress dots', () => {
    render(<OnboardingWizard onComplete={vi.fn()} />);
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Your Role')).toBeInTheDocument();
    expect(screen.getByText('Ready!')).toBeInTheDocument();
  });

  it('navigates to persona step on Continue', async () => {
    render(<OnboardingWizard onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => {
      expect(screen.getByText("What's your role?")).toBeInTheDocument();
    });
  });

  it('shows all 4 persona options', async () => {
    render(<OnboardingWizard onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => {
      expect(screen.getByText('Management / VIP')).toBeInTheDocument();
      expect(screen.getByText('Engineering Manager / VP')).toBeInTheDocument();
      expect(screen.getByText('Individual Contributor')).toBeInTheDocument();
      expect(screen.getByText('Delivery Manager')).toBeInTheDocument();
    });
  });

  it('disables Continue when no persona selected', async () => {
    render(<OnboardingWizard onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => screen.getByText("What's your role?"));
    // Continue button should be disabled
    const continueBtn = screen.getByText('Continue');
    expect(continueBtn.closest('button')).toBeDisabled();
  });

  it('enables Continue after persona selection', async () => {
    render(<OnboardingWizard onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => screen.getByText("What's your role?"));
    fireEvent.click(screen.getByText('Engineering Manager / VP'));
    const continueBtn = screen.getByText('Continue');
    expect(continueBtn.closest('button')).not.toBeDisabled();
  });

  it('shows project step for new users', async () => {
    render(<OnboardingWizard onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText('Continue')); // Welcome → Persona
    await waitFor(() => screen.getByText("What's your role?"));
    fireEvent.click(screen.getByText('Engineering Manager / VP'));
    fireEvent.click(screen.getByText('Continue')); // Persona → Project
    await waitFor(() => {
      expect(screen.getByText('Connect your JIRA project')).toBeInTheDocument();
    });
  });

  it('skips project step for existing users with project key', async () => {
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { project_key: 'PROJ' },
    });
    render(<OnboardingWizard onComplete={vi.fn()} />);
    await waitFor(() => {
      // Should have 3 steps, not 4 (no Project step)
      expect(screen.queryByText('Project')).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Continue')); // Welcome → Persona
    await waitFor(() => screen.getByText("What's your role?"));
    fireEvent.click(screen.getByText('Individual Contributor'));
    fireEvent.click(screen.getByText('Continue')); // Persona → Done
    await waitFor(() => {
      expect(screen.getByText("You're all set!")).toBeInTheDocument();
    });
  });

  it('shows Back button after first step', async () => {
    render(<OnboardingWizard onComplete={vi.fn()} />);
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument();
    });
  });

  it('navigates back correctly', async () => {
    render(<OnboardingWizard onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => screen.getByText("What's your role?"));
    fireEvent.click(screen.getByText('Back'));
    await waitFor(() => {
      expect(screen.getByText('Welcome to Uplift Forge')).toBeInTheDocument();
    });
  });

  it('saves config and calls onComplete on finish', async () => {
    const onComplete = vi.fn();
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { project_key: 'PROJ' },
    });
    render(<OnboardingWizard onComplete={onComplete} />);
    await waitFor(() => {}); // Wait for config load

    fireEvent.click(screen.getByText('Continue')); // Welcome → Persona
    await waitFor(() => screen.getByText("What's your role?"));
    fireEvent.click(screen.getByText('Engineering Manager / VP'));
    fireEvent.click(screen.getByText('Continue')); // Persona → Done
    await waitFor(() => screen.getByText("You're all set!"));
    fireEvent.click(screen.getByText('Start Using Uplift Forge'));
    await waitFor(() => {
      expect(saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ persona: 'engineering_manager' }),
      );
      expect(onComplete).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Setup complete!');
    });
  });

  it('shows error toast when save fails', async () => {
    (saveConfig as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { project_key: 'PROJ' },
    });
    const onComplete = vi.fn();
    render(<OnboardingWizard onComplete={onComplete} />);
    await waitFor(() => {});

    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => screen.getByText("What's your role?"));
    fireEvent.click(screen.getByText('Delivery Manager'));
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => screen.getByText("You're all set!"));
    fireEvent.click(screen.getByText('Start Using Uplift Forge'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to save configuration');
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('shows selected persona label on done step', async () => {
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { project_key: 'PROJ' },
    });
    render(<OnboardingWizard onComplete={vi.fn()} />);
    await waitFor(() => {});

    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => screen.getByText("What's your role?"));
    fireEvent.click(screen.getByText('Management / VIP'));
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => {
      expect(screen.getByText('Management / VIP')).toBeInTheDocument();
      expect(screen.getByText("You're all set!")).toBeInTheDocument();
    });
  });
});
