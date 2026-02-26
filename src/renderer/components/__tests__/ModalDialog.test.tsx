import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalDialog from '../ModalDialog';

describe('ModalDialog', () => {
  describe('confirm mode', () => {
    const defaultProps = {
      open: true,
      onClose: vi.fn(),
      title: 'Confirm Action',
      mode: 'confirm' as const,
      message: 'Are you sure?',
      onConfirm: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('renders title and message', () => {
      render(<ModalDialog {...defaultProps} />);
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
      expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });

    it('renders nothing when closed', () => {
      render(<ModalDialog {...defaultProps} open={false} />);
      expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
    });

    it('calls onConfirm and onClose when Confirm clicked', () => {
      render(<ModalDialog {...defaultProps} />);
      fireEvent.click(screen.getByText('Confirm'));
      expect(defaultProps.onConfirm).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose when Cancel clicked', () => {
      render(<ModalDialog {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose on Escape key', () => {
      render(<ModalDialog {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose on backdrop click', () => {
      render(<ModalDialog {...defaultProps} />);
      const backdrop = screen.getByText('Confirm Action').closest('.fixed');
      if (backdrop) {
        fireEvent.mouseDown(backdrop);
      }
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('uses custom confirmLabel', () => {
      render(<ModalDialog {...defaultProps} confirmLabel="Delete" />);
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  describe('prompt mode', () => {
    const defaultProps = {
      open: true,
      onClose: vi.fn(),
      title: 'Enter Value',
      mode: 'prompt' as const,
      message: 'Please enter:',
      placeholder: 'Type here...',
      onSubmit: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('renders input field with placeholder', () => {
      render(<ModalDialog {...defaultProps} />);
      expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument();
      expect(screen.getByText('Please enter:')).toBeInTheDocument();
    });

    it('calls onSubmit with input value on OK', async () => {
      const user = userEvent.setup();
      render(<ModalDialog {...defaultProps} />);
      const input = screen.getByPlaceholderText('Type here...');
      await user.type(input, 'test value');
      fireEvent.click(screen.getByText('OK'));
      expect(defaultProps.onSubmit).toHaveBeenCalledWith('test value');
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('submits on Enter key', async () => {
      const user = userEvent.setup();
      render(<ModalDialog {...defaultProps} />);
      const input = screen.getByPlaceholderText('Type here...');
      await user.type(input, 'enter value');
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(defaultProps.onSubmit).toHaveBeenCalledWith('enter value');
    });

    it('shows validation error', async () => {
      const user = userEvent.setup();
      const validate = (v: string) => v.length < 3 ? 'Too short' : null;
      render(<ModalDialog {...defaultProps} validate={validate} />);
      const input = screen.getByPlaceholderText('Type here...');
      await user.type(input, 'ab');
      fireEvent.click(screen.getByText('OK'));
      expect(screen.getByText('Too short')).toBeInTheDocument();
      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('clears error on input change', async () => {
      const user = userEvent.setup();
      const validate = (v: string) => v.length < 3 ? 'Too short' : null;
      render(<ModalDialog {...defaultProps} validate={validate} />);
      const input = screen.getByPlaceholderText('Type here...');
      await user.type(input, 'ab');
      fireEvent.click(screen.getByText('OK'));
      expect(screen.getByText('Too short')).toBeInTheDocument();
      await user.type(input, 'c');
      expect(screen.queryByText('Too short')).not.toBeInTheDocument();
    });
  });
});
