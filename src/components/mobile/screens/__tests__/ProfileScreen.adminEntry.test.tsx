import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ProfileScreen } from '../ProfileScreen';
import { useAppStore } from '../../../../store/useAppStore';

vi.mock('../../../../hooks/data/usePersonPhoto', () => ({ usePersonPhoto: () => null }));

/**
 * The admin console has no door in any build (Signal 2026-10-22, "admin =
 * supabase"; adminConsoleIsDormant.test.ts). Holding the name used to open it,
 * and a "Správa" row stayed once signed in; neither does any more.
 */
describe('ProfileScreen — no way into admin', () => {
  const open = vi.fn();
  beforeEach(() => {
    open.mockReset();
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      fullName: 'Jana Nováková',
      adminSession: null,
      adminRole: null,
      openSocietyAdmin: open,
    });
  });
  afterEach(() => vi.useRealTimers());

  it('holding the name does not open the console', () => {
    vi.useFakeTimers();
    render(<ProfileScreen />);
    fireEvent.pointerDown(screen.getByTestId('profile-identity-name'), { clientX: 0, clientY: 0 });
    act(() => void vi.advanceTimersByTime(700));
    expect(open).not.toHaveBeenCalled();
  });

  it('shows no Správa row to a student', () => {
    render(<ProfileScreen />);
    expect(screen.queryByText('Správa')).toBeNull();
  });

  it('shows no Správa row even with an admin session on the device', () => {
    useAppStore.setState({ adminSession: {} as never });
    render(<ProfileScreen />);
    expect(screen.queryByText('Správa')).toBeNull();
  });
});
