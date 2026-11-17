import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../store/useAppStore';

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {} }));
const plugin = vi.hoisted(() => ({
  start: vi.fn(),
  setEnabled: vi.fn(),
  clearNotifications: vi.fn(),
  stopRun: vi.fn().mockResolvedValue(undefined),
  getLaunchTap: vi.fn(),
  addListener: vi.fn(),
  setChannelNames: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@capacitor/core', async (orig) => ({
  ...(await orig<typeof import('@capacitor/core')>()),
  registerPlugin: () => plugin,
  Capacitor: { getPlatform: () => 'android' },
}));

import {
  clearBackgroundNotifications,
  openFromBackgroundTap,
  startBackgroundCheck,
} from '../backgroundCheckNative';

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

  it('ignores a tap with no kind', () => {
    openFromBackgroundTap(undefined);
    openFromBackgroundTap({ courseCode: 'EBC-A' });
    expect(useAppStore.getState().mobileTab).toBe('calendar');
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

  it('a later tap, while the app is open, navigates too', async () => {
    plugin.getLaunchTap.mockResolvedValue({});
    await startBackgroundCheck();
    const onTap = plugin.addListener.mock.calls[0]?.[1] as (tap: unknown) => void;
    onTap({ kind: 'exams', courseCode: null });
    expect(useAppStore.getState().mobileTab).toBe('exams');
  });

  // Opened at once: the drawer itself takes Záznamník once the subjects load
  // (SubjectDrawerSheet.boxes.test.tsx).
  it('a cold-start subject tap opens the subject on Záznamník', async () => {
    plugin.getLaunchTap.mockResolvedValue({ kind: 'boxes', courseCode: 'EBC-AP' });
    useAppStore.setState({ subjects: undefined } as never);
    await startBackgroundCheck();
    expect(useAppStore.getState().mobileSheets.at(-1)).toMatchObject({
      kind: 'subjectDrawer',
      courseCode: 'EBC-AP',
      initialTab: 'zaznamnik',
    });
  });

  it('no launch tap, no navigation', async () => {
    plugin.getLaunchTap.mockResolvedValue({});
    await startBackgroundCheck();
    expect(useAppStore.getState().mobileTab).toBe('calendar');
  });

  it('renames the channels when the language is switched', async () => {
    plugin.getLaunchTap.mockResolvedValue({});
    await startBackgroundCheck();
    expect(plugin.start).toHaveBeenCalledWith({
      channelNames: expect.objectContaining({ boxes: 'Nové odevzdávárny' }),
    });
    useAppStore.setState({ language: 'en' } as never);
    expect(plugin.setChannelNames).toHaveBeenCalledWith({
      channelNames: expect.objectContaining({ boxes: 'New submission boxes' }),
    });
  });
});

describe('sign-out and the background run', () => {
  beforeEach(() => vi.clearAllMocks());

  // A run in flight must not write this student's data back after the wipe,
  // nor post it for the next student: it is stopped before the tray is cleared.
  it('stops the run in progress before clearing its notifications', async () => {
    const order: string[] = [];
    plugin.stopRun.mockImplementation(async () => void order.push('stop'));
    plugin.clearNotifications.mockImplementation(async () => void order.push('clear'));
    await clearBackgroundNotifications();
    expect(order).toEqual(['stop', 'clear']);
  });
});

describe('the channel names follow the language', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    plugin.start.mockResolvedValue({ enabled: true });
    plugin.getLaunchTap.mockResolvedValue({});
    useAppStore.setState({ language: 'cz' } as never);
  });

  it('renames them once per change, however often the check was started', async () => {
    await startBackgroundCheck();
    await startBackgroundCheck();
    plugin.setChannelNames.mockClear();
    useAppStore.setState({ language: 'en' } as never);
    expect(plugin.setChannelNames).toHaveBeenCalledTimes(1);
  });
});
