import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SignOutConfirm } from '../SignOutConfirm';
import { useAppStore } from '../../../../store/useAppStore';

const logout = vi.hoisted(() => vi.fn());
vi.mock('../../../../api/proxyClient', () => ({ logout }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: toastError } }));

describe('SignOutConfirm', () => {
  beforeEach(() => {
    logout.mockReset().mockResolvedValue(undefined);
    toastError.mockReset();
    useAppStore.setState({ language: 'cz' } as never);
  });

  it('renders nothing while closed', () => {
    render(<SignOutConfirm open={false} onCancel={vi.fn()} />);
    expect(screen.queryByText('Odhlásit se z aplikace?')).not.toBeInTheDocument();
  });

  it('signs out only once confirmed', async () => {
    render(<SignOutConfirm open onCancel={vi.fn()} />);
    expect(logout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Odhlásit se' }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  it('cancelling leaves the session alone', () => {
    const onCancel = vi.fn();
    render(<SignOutConfirm open onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Zrušit' }));
    expect(onCancel).toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  it('tells the student when the sign-out failed instead of leaving it silent', async () => {
    // signOutMobile only rejects when the credential itself could not be
    // cleared — the one case where the student is still signed in and needs to
    // know the tap did nothing.
    logout.mockRejectedValue(new Error('keystore unavailable'));
    const onCancel = vi.fn();
    render(<SignOutConfirm open onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Odhlásit se' }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onCancel).toHaveBeenCalled();
  });
});
