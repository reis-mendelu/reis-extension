import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ProfileScreen } from '../ProfileScreen';
import { useAppStore } from '../../../../store/useAppStore';

vi.mock('../../../../hooks/data/usePersonPhoto', () => ({ usePersonPhoto: () => null }));

/**
 * The admin console left Profile (spec 2026-10-08): societies no longer
 * self-post. The way in is holding your name; once signed in, a "Správa" row
 * stays visible on that device.
 */
describe('ProfileScreen — the hidden way into admin', () => {
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

  it('holding the name opens the console', () => {
    vi.useFakeTimers();
    render(<ProfileScreen />);
    fireEvent.pointerDown(screen.getByTestId('profile-identity-name'), { clientX: 0, clientY: 0 });
    act(() => void vi.advanceTimersByTime(700));
    expect(open).toHaveBeenCalledOnce();
  });

  it('shows no Správa row to a student', () => {
    render(<ProfileScreen />);
    expect(screen.queryByText('Správa')).toBeNull();
  });

  it('shows a Správa row once an admin session exists', () => {
    useAppStore.setState({ adminSession: {} as never });
    render(<ProfileScreen />);
    fireEvent.click(screen.getByText('Správa'));
    expect(open).toHaveBeenCalledOnce();
  });
});
