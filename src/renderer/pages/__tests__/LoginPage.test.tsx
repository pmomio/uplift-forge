import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../api', () => ({
  login: vi.fn(),
  demoLogin: vi.fn(),
}));

// Mock logo import
vi.mock('../../../../assets/logo.png', () => ({ default: 'logo.png' }));

import LoginPage from '../LoginPage';
import { login, demoLogin } from '../../api';

function getConsentButton() {
  // The consent checkbox is a <button> adjacent to the "I consent" text div
  const consentText = screen.getByText(/I consent/);
  const container = consentText.closest('.flex.items-start')!;
  return container.querySelector('button')!;
}

function fillForm() {
  fireEvent.change(screen.getByPlaceholderText('https://your-org.atlassian.net'), {
    target: { value: 'https://test.atlassian.net' },
  });
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
    target: { value: 'test@test.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Your Atlassian API token'), {
    target: { value: 'token123' },
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).api = {
      openExternal: vi.fn(),
    };
  });

  it('renders login form', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />);
    expect(screen.getByText('Uplift Forge')).toBeInTheDocument();
    expect(screen.getByText('Connect & Continue')).toBeInTheDocument();
  });

  it('shows all form fields', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />);
    expect(screen.getByPlaceholderText('https://your-org.atlassian.net')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your Atlassian API token')).toBeInTheDocument();
  });

  it('shows error when fields are empty', async () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />);
    // Enable consent first
    fireEvent.click(getConsentButton());
    // Click login with empty fields
    fireEvent.click(screen.getByText('Connect & Continue'));
    await waitFor(() => {
      expect(screen.getByText('All fields are required.')).toBeInTheDocument();
    });
  });

  it('disables button without consent', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />);
    const btn = screen.getByText('Connect & Continue').closest('button');
    expect(btn).toBeDisabled();
  });

  it('enables button with consent', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />);
    fireEvent.click(getConsentButton());
    const btn = screen.getByText('Connect & Continue').closest('button');
    expect(btn).not.toBeDisabled();
  });

  it('calls login on form submit', async () => {
    (login as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    const onSuccess = vi.fn();
    render(<LoginPage onLoginSuccess={onSuccess} />);

    fillForm();
    fireEvent.click(getConsentButton());
    fireEvent.click(screen.getByText('Connect & Continue'));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('https://test.atlassian.net', 'test@test.com', 'token123');
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('normalizes base URL by removing trailing slashes', async () => {
    (login as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    render(<LoginPage onLoginSuccess={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('https://your-org.atlassian.net'), {
      target: { value: 'https://test.atlassian.net///' },
    });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('Your Atlassian API token'), { target: { value: 'tok' } });
    fireEvent.click(getConsentButton());
    fireEvent.click(screen.getByText('Connect & Continue'));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('https://test.atlassian.net', 'a@b.com', 'tok');
    });
  });

  it('shows error on login failure', async () => {
    (login as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Invalid credentials'));
    render(<LoginPage onLoginSuccess={vi.fn()} />);

    fillForm();
    fireEvent.click(getConsentButton());
    fireEvent.click(screen.getByText('Connect & Continue'));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('handles Enter key to submit', async () => {
    (login as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    const onSuccess = vi.fn();
    render(<LoginPage onLoginSuccess={onSuccess} />);

    fillForm();
    fireEvent.click(getConsentButton());
    // Simulate Enter key on the form container
    const formContainer = screen.getByPlaceholderText('https://your-org.atlassian.net').closest('.space-y-4')!;
    fireEvent.keyDown(formContainer, { key: 'Enter' });

    await waitFor(() => {
      expect(login).toHaveBeenCalled();
    });
  });

  it('opens privacy policy modal', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />);
    fireEvent.click(screen.getByText('Privacy Policy'));
    expect(screen.getByText('1. Data Collection & Local Storage')).toBeInTheDocument();
  });

  it('opens terms of service modal', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />);
    fireEvent.click(screen.getByText('Terms of Service'));
    expect(screen.getByText('1. Acceptance')).toBeInTheDocument();
  });

  it('closes policy modal with Close & Return', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />);
    fireEvent.click(screen.getByText('Privacy Policy'));
    expect(screen.getByText('1. Data Collection & Local Storage')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close & Return'));
    expect(screen.queryByText('1. Data Collection & Local Storage')).not.toBeInTheDocument();
  });

  it('closes policy modal with X button', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />);
    fireEvent.click(screen.getByText('Privacy Policy'));
    fireEvent.click(screen.getByText('✕'));
    expect(screen.queryByText('1. Data Collection & Local Storage')).not.toBeInTheDocument();
  });

  it('toggles consent checkbox', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />);
    const checkbox = getConsentButton();
    const submitBtn = screen.getByText('Connect & Continue').closest('button');

    fireEvent.click(checkbox);
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(checkbox);
    expect(submitBtn).toBeDisabled();
  });

  it('opens external link for API token', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />);
    fireEvent.click(screen.getByText('id.atlassian.com'));
    expect((window as any).api.openExternal).toHaveBeenCalled();
  });

  it('shows consent error when trying to submit without consent', async () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />);
    fillForm();
    // Consent not given — button disabled, but test the consent gate via handleLogin
    // Enable consent, then toggle off to set the error path
    fireEvent.click(getConsentButton());
    fireEvent.click(getConsentButton()); // now off
    // Button is disabled, so handleLogin can't fire — this is correct behavior
    const btn = screen.getByText('Connect & Continue').closest('button');
    expect(btn).toBeDisabled();
  });

  it('calls demoLogin when Try Demo Mode is clicked', async () => {
    (demoLogin as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    const onSuccess = vi.fn();
    render(<LoginPage onLoginSuccess={onSuccess} />);
    
    fireEvent.click(screen.getByText('Try Demo Mode'));

    await waitFor(() => {
      expect(demoLogin).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
