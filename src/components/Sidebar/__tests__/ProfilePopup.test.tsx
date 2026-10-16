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

// The desktop tree's half of the study switcher (decision 2026-10-16); the
// phone's is in StudySwitcher.test.tsx. Both trees, or one student goes without.
describe('ProfilePopup — study switcher', () => {
  const study = (studium: string, label: string) => ({
    studium,
    obdobi: '829',
    label,
    isErasmus: false,
  });

  it('offers the switch under the name when there are two active studies', () => {
    useAppStore.setState({
      studiumId: '900011',
      studies: [
        study('900011', 'PEF B-AII prez [sem 1, roč 1]'),
        study('900012', 'PEF B-EM komb [sem 1, roč 1]'),
      ],
    });
    render(<ProfilePopup isOpen />);
    const group = screen.getByRole('group', { name: 'Study' });
    expect(group.querySelectorAll('button[aria-pressed]')).toHaveLength(2);
  });

  it('shows nothing new with one study', () => {
    useAppStore.setState({ studies: [study('900011', 'PEF B-AII prez [sem 1, roč 1]')] });
    render(<ProfilePopup isOpen />);
    expect(screen.queryByTestId('study-switcher')).toBeNull();
  });
});
