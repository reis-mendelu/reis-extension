import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { WelcomeModal } from '../WelcomeModal';
import { useAppStore } from '../../../store/useAppStore';

const mockGet = vi.fn();
const mockSet = vi.fn();

vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: (...args: unknown[]) => mockGet(...args),
    set: (...args: unknown[]) => mockSet(...args),
  },
}));

/** The modal appears 800ms after mount; every test drives that timer. */
async function show() {
  render(<WelcomeModal />);
  await act(async () => {
    await Promise.resolve();
    vi.advanceTimersByTime(900);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  mockGet.mockResolvedValue(undefined);
  mockSet.mockResolvedValue(undefined);
  useAppStore.setState({ language: 'en', isEduroamOpen: false, eduroamInitialTarget: null });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.clearAllMocks();
});

describe('WelcomeModal', () => {
  it('leads with eduroam, not a generic greeting', async () => {
    await show();
    expect(screen.getByText('Campus Wi-Fi, first thing')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Set up eduroam/i })).toBeTruthy();
  });

  // The whole point of the change: one click, no device picker. The drawer
  // opens on the machine reIS is running on.
  it('hands off to the drawer with this machine already picked', async () => {
    await show();
    fireEvent.click(screen.getByRole('button', { name: /Set up eduroam/i }));
    expect(useAppStore.getState().isEduroamOpen).toBe(true);
    expect(useAppStore.getState().eduroamInitialTarget).toMatch(/^(mac|windows)$/);
  });

  // reIS ships manuals for two desktops. A Linux student must land on the
  // picker, not on the geteduroam wizard for a machine they are not using.
  it('falls back to the device picker on a desktop it has no manual for', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' });
    await show();
    fireEvent.click(screen.getByRole('button', { name: /Set up eduroam/i }));
    expect(useAppStore.getState().isEduroamOpen).toBe(true);
    expect(useAppStore.getState().eduroamInitialTarget).toBeNull();
    vi.unstubAllGlobals();
  });

  it('dismisses once, whichever way it is left', async () => {
    await show();
    fireEvent.click(screen.getByRole('button', { name: /Not now/i }));
    expect(useAppStore.getState().isEduroamOpen).toBe(false);
    expect(mockSet).toHaveBeenCalledWith('meta', 'welcome_dismissed', true);
  });

  // The gate is unchanged: a student who dismissed it before this change must
  // not meet it again.
  it('stays away once welcome_dismissed is set', async () => {
    mockGet.mockResolvedValue(true);
    await show();
    expect(screen.queryByText('Campus Wi-Fi, first thing')).toBeNull();
  });
});
