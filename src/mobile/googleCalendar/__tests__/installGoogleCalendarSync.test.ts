import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sync, listeners } = vi.hoisted(() => ({
  sync: vi.fn(async () => {}),
  listeners: new Map<string, () => void>(),
}));
vi.mock('../controller', () => ({ syncGoogleCalendarNow: sync }));
vi.mock('../googleCalendarNative', () => ({
  GoogleCalendarNative: {
    isAvailable: async () => ({ available: true }),
    status: async () => ({ connected: true, email: 'x@y' }),
  },
}));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: async (name: string, cb: () => void) => {
      listeners.set(name, cb);
      return { remove: async () => {} };
    },
  },
}));

import { installGoogleCalendarSync } from '../installGoogleCalendarSync';
import { saveSyncState } from '../syncStateStore';
import { useAppStore } from '../../../store/useAppStore';
import { installTestPlatform } from './testPlatform';

beforeEach(async () => {
  installTestPlatform();
  sync.mockClear();
  listeners.clear(); // so a resume callback is this install's, not an earlier test's
  await saveSyncState({
    enabled: true,
    calendarId: 'c',
    held: {},
    lastSyncAt: 5,
    pastFillPending: false,
    reisDeleted: {},
    skipped: {},
    sourcesFingerprint: null,
  });
});
let teardown: (() => void) | null = null;
afterEach(() => {
  teardown?.();
  vi.useRealTimers();
});

describe('installGoogleCalendarSync', () => {
  it('shows the row state and syncs once on open, without waiting for a store change', async () => {
    teardown = installGoogleCalendarSync();
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
    expect(useAppStore.getState().gcal).toMatchObject({
      available: true,
      connected: true,
      lastSyncAt: 5,
    });
  });

  it('syncs on resume', async () => {
    teardown = installGoogleCalendarSync();
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
    listeners.get('resume')!();
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it('debounces store changes into one sync', async () => {
    teardown = installGoogleCalendarSync();
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
    vi.useFakeTimers();
    useAppStore.setState({ customEvents: [{ id: 'a' } as never] });
    useAppStore.setState({ customEvents: [{ id: 'b' } as never] });
    vi.advanceTimersByTime(3000);
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it('syncs when the timetable fails to load, not only when it loads', async () => {
    const data: never[] = []; // the same array: a failed load changes only the status
    useAppStore.setState({ schedule: { data, status: 'loading' } } as never);
    teardown = installGoogleCalendarSync();
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
    vi.useFakeTimers();
    useAppStore.setState({ schedule: { data, status: 'error' } } as never);
    vi.advanceTimersByTime(3000);
    expect(sync).toHaveBeenCalledTimes(2);
  });
});
