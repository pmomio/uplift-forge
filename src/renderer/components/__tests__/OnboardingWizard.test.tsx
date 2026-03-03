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
    (saveConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
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
      expect(screen.getByText('Engineering Manager / VP')).toBeInTheDocument();
      expect(screen.getByText('Individual Contributor')).toBeInTheDocument();
      expect(screen.getByText('Delivery Manager')).toBeInTheDocument();
      expect(screen.getByText('Member of Management')).toBeInTheDocument();
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
      // EM gets multi-project input
      expect(screen.getByText('Connect your JIRA projects')).toBeInTheDocument();
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
    fireEvent.click(screen.getByText('Delivery Manager'));
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => {
      expect(screen.getByText('Delivery Manager')).toBeInTheDocument();
      expect(screen.getByText("You're all set!")).toBeInTheDocument();
    });
  });

  // --- EM multi-project onboarding ---
  it('shows multi-project input for engineering_manager persona', async () => {
    render(<OnboardingWizard onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText('Continue')); // Welcome → Persona
    await waitFor(() => screen.getByText("What's your role?"));
    fireEvent.click(screen.getByText('Engineering Manager / VP'));
    fireEvent.click(screen.getByText('Continue')); // Persona → Project
    await waitFor(() => {
      expect(screen.getByText('Connect your JIRA projects')).toBeInTheDocument();
      expect(screen.getByText('Add Another Project')).toBeInTheDocument();
    });
  });

  it('shows single project input for non-EM persona', async () => {
    render(<OnboardingWizard onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText('Continue')); // Welcome → Persona
    await waitFor(() => screen.getByText("What's your role?"));
    fireEvent.click(screen.getByText('Individual Contributor'));
    fireEvent.click(screen.getByText('Continue')); // Persona → Project
    await waitFor(() => {
      expect(screen.getByText('Connect your JIRA project')).toBeInTheDocument();
      expect(screen.queryByText('Add Another Project')).not.toBeInTheDocument();
    });
  });

  it('allows adding multiple project keys for engineering_manager', async () => {
    render(<OnboardingWizard onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => screen.getByText("What's your role?"));
    fireEvent.click(screen.getByText('Engineering Manager / VP'));
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => screen.getByText('Add Another Project'));
    // Click "Add Another Project" to add a second input
    fireEvent.click(screen.getByText('Add Another Project'));
    // Should now have 2 text inputs
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBe(2);
  });

  it('saves multiple project keys for engineering_manager on finish', async () => {
    const onComplete = vi.fn();
    render(<OnboardingWizard onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Continue')); // Welcome → Persona
    await waitFor(() => screen.getByText("What's your role?"));
    fireEvent.click(screen.getByText('Engineering Manager / VP'));
    fireEvent.click(screen.getByText('Continue')); // Persona → Project
    await waitFor(() => screen.getByText('Add Another Project'));
    // Type first project key
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'ALPHA' } });
    // Add second project and wait for it to render
    fireEvent.click(screen.getByText('Add Another Project'));
    await waitFor(() => {
      expect(screen.getAllByRole('textbox')).toHaveLength(2);
    });
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[1], { target: { value: 'BETA' } });
    // Continue to Done step
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => screen.getByText("You're all set!"));
    fireEvent.click(screen.getByText('Start Using Uplift Forge'));
    await waitFor(() => {
      expect(saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          persona: 'engineering_manager',
          project_key: 'ALPHA',
          projects: expect.arrayContaining([
            expect.objectContaining({ project_key: 'BETA' }),
          ]),
        }),
      );
    });
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it('shows multi-project input for management persona', async () => {
    render(<OnboardingWizard onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText('Continue')); // Welcome → Persona
    await waitFor(() => screen.getByText("What's your role?"));
    fireEvent.click(screen.getByText('Member of Management'));
    fireEvent.click(screen.getByText('Continue')); // Persona → Project
    await waitFor(() => {
      expect(screen.getByText('Connect your JIRA projects')).toBeInTheDocument();
      expect(screen.getByText('Add Another Project')).toBeInTheDocument();
    });
  });

  it('shows permanence warning on persona step', async () => {
    render(<OnboardingWizard onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => {
      expect(screen.getByText(/This choice is permanent/)).toBeInTheDocument();
    });
  });
});
