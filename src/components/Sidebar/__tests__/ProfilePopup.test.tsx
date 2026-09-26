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

describe('ProfilePopup — report a problem', () => {
  it('opens the report form from the store and closes the popup', () => {
    useAppStore.setState({ reportOpen: false, reportPrefill: null });
    const onClose = vi.fn();
    render(<ProfilePopup isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Report Bug/i }));
    expect(useAppStore.getState().reportOpen).toBe(true);
    expect(useAppStore.getState().reportPrefill).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ProfilePopup — view as a student', () => {
  it('is absent for everyone but a reis_admin', () => {
    useAppStore.setState({ adminRole: 'association' });
    render(<ProfilePopup isOpen />);
    expect(screen.queryByRole('button', { name: /View as a student/ })).toBeNull();
  });

  it('for a reis_admin, opens the picker and closes the popup', () => {
    const open = vi.fn();
    useAppStore.setState({ adminRole: 'reis_admin', openImpersonationPicker: open });
    const onClose = vi.fn();
    render(<ProfilePopup isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /View as a student/ }));
    expect(open).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });
});
