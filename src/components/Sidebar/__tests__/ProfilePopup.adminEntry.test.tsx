import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { ProfilePopup } from '../ProfilePopup';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('../../../hooks/useUserParams', () => ({
  useUserParams: () => ({ params: { fullName: 'Jana Nováková', email: null, studentId: '1' } }),
}));

/** Desktop half: the admin console has no door (adminConsoleIsDormant.test.ts). */
describe('ProfilePopup — no way into admin', () => {
  const open = vi.fn();
  beforeEach(() => {
    open.mockReset();
    useAppStore.setState({
      language: 'cz',
      adminSession: null,
      adminRole: null,
      openSocietyAdmin: open,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('holding the name does not open the console', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<ProfilePopup isOpen onClose={onClose} />);
    fireEvent.pointerDown(screen.getByTestId('profile-popup-name'), { clientX: 0, clientY: 0 });
    act(() => void vi.advanceTimersByTime(700));
    expect(open).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows no Správa even with an admin session on the device', () => {
    useAppStore.setState({ adminSession: {} as never });
    render(<ProfilePopup isOpen />);
    expect(screen.queryByText('Správa')).toBeNull();
  });
});
