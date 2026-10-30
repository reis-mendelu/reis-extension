import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { ProfilePopup } from '../ProfilePopup';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('../../../hooks/useUserParams', () => ({
  useUserParams: () => ({ params: { fullName: 'Jana Nováková', email: null, studentId: '1' } }),
}));

/** Desktop half of the hidden way into admin (spec 2026-10-08). */
describe('ProfilePopup — the hidden way into admin', () => {
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

  it('holding the name opens the console and closes the popup', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<ProfilePopup isOpen onClose={onClose} />);
    fireEvent.pointerDown(screen.getByTestId('profile-popup-name'), { clientX: 0, clientY: 0 });
    act(() => void vi.advanceTimersByTime(700));
    expect(open).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Správa only once an admin session exists', () => {
    const { unmount } = render(<ProfilePopup isOpen />);
    expect(screen.queryByText('Správa')).toBeNull();
    unmount();
    useAppStore.setState({ adminSession: {} as never });
    render(<ProfilePopup isOpen />);
    fireEvent.click(screen.getByText('Správa'));
    expect(open).toHaveBeenCalledOnce();
  });
});
