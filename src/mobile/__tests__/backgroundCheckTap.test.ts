import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../store/useAppStore';

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {} }));
const plugin = vi.hoisted(() => ({
  start: vi.fn(),
  setEnabled: vi.fn(),
  clearNotifications: vi.fn(),
  getLaunchTap: vi.fn(),
  addListener: vi.fn(),
}));
vi.mock('@capacitor/core', async (orig) => ({
  ...(await orig<typeof import('@capacitor/core')>()),
  registerPlugin: () => plugin,
  Capacitor: { getPlatform: () => 'android' },
}));

import { openFromBackgroundTap, startBackgroundCheck } from '../backgroundCheckNative';

/** A tap on a notification the phone posted while reIS was closed. */
describe('openFromBackgroundTap', () => {
  beforeEach(() => {
    useAppStore.setState({ mobileTab: 'calendar', mobileSheets: [], language: 'cz' } as never);
  });

  it('a box opens that subject’s Záznamník, where its boxes are', () => {
    openFromBackgroundTap({ kind: 'boxes', courseCode: 'EBC-A' });
    const s = useAppStore.getState();
    expect(s.mobileTab).toBe('subjects');
    expect(s.mobileSheets.at(-1)).toMatchObject({
      kind: 'subjectDrawer',
      courseCode: 'EBC-A',
      initialTab: 'zaznamnik',
    });
  });

  it('points open the same place', () => {
    openFromBackgroundTap({ kind: 'points', courseCode: 'EBC-A' });
    expect(useAppStore.getState().mobileSheets.at(-1)).toMatchObject({ courseCode: 'EBC-A' });
  });

  it('a summary opens Novinky', () => {
    openFromBackgroundTap({ kind: 'boxes', courseCode: null });
    expect(useAppStore.getState().mobileSheets.at(-1)).toMatchObject({ kind: 'notifications' });
  });

  it('new exam terms open Zkoušky', () => {
    openFromBackgroundTap({ kind: 'exams', courseCode: null });
    expect(useAppStore.getState().mobileTab).toBe('exams');
  });

  it('ignores a tap it does not know', () => {
    openFromBackgroundTap({ kind: 'something-else', courseCode: null });
    expect(useAppStore.getState().mobileTab).toBe('calendar');
    openFromBackgroundTap(undefined);
    expect(useAppStore.getState().mobileSheets).toEqual([]);
  });
});

describe('startBackgroundCheck taps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    plugin.start.mockResolvedValue({ enabled: true });
    useAppStore.setState({ mobileTab: 'calendar', mobileSheets: [], language: 'cz' } as never);
  });

  it('opens the tap that launched the app, and listens for later ones', async () => {
    plugin.getLaunchTap.mockResolvedValue({ kind: 'exams', courseCode: null });
    await startBackgroundCheck();
    expect(useAppStore.getState().mobileTab).toBe('exams');
    expect(plugin.addListener).toHaveBeenCalledWith('notificationTap', expect.any(Function));
  });

  it('no launch tap, no navigation', async () => {
    plugin.getLaunchTap.mockResolvedValue({});
    await startBackgroundCheck();
    expect(useAppStore.getState().mobileTab).toBe('calendar');
  });
});
