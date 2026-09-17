import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ProfilePopup } from '../ProfilePopup';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn().mockResolvedValue(undefined),
    // Resolves: the slice chains `.catch` on this, as the real service allows.
    set: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../../hooks/useUserParams', () => ({ useUserParams: () => ({ params: null }) }));
vi.mock('../../../hooks/useSpolkySettings', () => ({
  useSpolkySettings: () => ({ isSubscribed: () => false, toggleAssociation: vi.fn() }),
}));

beforeEach(() => {
  useAppStore.setState({ language: 'en', isEduroamOpen: false, eduroamInitialTarget: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('ProfilePopup — eduroam', () => {
  it('is where eduroam lives now, and opening it closes the popup', () => {
    // Stubbed, not inherited: the target is read off the user agent, and CI
    // runs on Linux — where the honest answer is the picker, not a device.
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' });
    const onClose = vi.fn();
    render(<ProfilePopup isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /eduroam/i }));
    expect(useAppStore.getState().isEduroamOpen).toBe(true);
    expect(useAppStore.getState().eduroamInitialTarget).toBe('mac');
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the picker for a desktop reIS has no manual for', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' });
    render(<ProfilePopup isOpen />);
    fireEvent.click(screen.getByRole('button', { name: /eduroam/i }));
    expect(useAppStore.getState().isEduroamOpen).toBe(true);
    expect(useAppStore.getState().eduroamInitialTarget).toBeNull();
  });
});
