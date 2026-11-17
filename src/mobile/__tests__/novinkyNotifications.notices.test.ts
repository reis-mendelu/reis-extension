import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { ln, db } = vi.hoisted(() => ({
  ln: {
    checkPermissions: vi.fn(),
    createChannel: vi.fn(),
    deleteChannel: vi.fn(async () => undefined),
    schedule: vi.fn(),
    getDeliveredNotifications: vi.fn(),
    removeDeliveredNotifications: vi.fn(),
  },
  db: new Map<string, unknown>(),
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'ios', isNativePlatform: () => false },
  registerPlugin: vi.fn(() => ({})),
}));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));
vi.mock('../../services/storage/IndexedDBService', () => ({
  IndexedDBService: {
    get: vi.fn(async (store: string, key: string) => db.get(`${store}/${key}`)),
    set: vi.fn(async (store: string, key: string, v: unknown) => db.set(`${store}/${key}`, v)),
    delete: vi.fn(async (store: string, key: string) => db.delete(`${store}/${key}`)),
  },
}));

import { useAppStore } from '../../store/useAppStore';
import { installNovinkyNotifications, NOVINKY_NOTIFIED_KEY } from '../novinkyNotifications';
import { pragueMinuteIso } from '../../utils/isNoticeRows';
import { NOW, baseState, notice, settle } from './novinkyFixtures';

const posted = () =>
  ln.schedule.mock.calls.flatMap((c) => c[0].notifications as { title: string; body: string }[]);

describe('IS notices as phone notifications', () => {
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    db.clear();
    ln.checkPermissions.mockResolvedValue({ display: 'granted' });
    useAppStore.setState(baseState(useAppStore.getState().notifications) as never);
    stop = installNovinkyNotifications();
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  // IS notices load on their own: a failed society feed must not hold them back.
  it('posts an IS notice when the society feed failed to load', async () => {
    useAppStore.setState({
      notifications: { ...useAppStore.getState().notifications, status: 'error' },
      isNoticesFetchedAt: NOW.getTime(),
    } as never);
    await settle();
    useAppStore.setState({ isNotices: { cz: [notice('k1', null)], en: [] } } as never);
    await settle();
    expect(posted()).toEqual([expect.objectContaining({ title: 'Výpadek Microsoft 365' })]);
  });

  // A failed first load is no baseline: recording [] then would post every
  // existing notice as new once a retry succeeds.
  it('waits for a successful IS-notice load before recording notices', async () => {
    useAppStore.setState({ isNoticesTriedAt: NOW.getTime(), isNoticesFetchedAt: null } as never);
    await settle();
    expect((db.get(`meta/${NOVINKY_NOTIFIED_KEY}`) as { notices?: string[] }).notices).toBe(
      undefined
    );
  });

  // IS's own display window is to the minute: the notice is news when it opens,
  // which no store field but the clock says.
  it('posts an IS notice once its display minute arrives', async () => {
    useAppStore.setState({ isNoticesFetchedAt: NOW.getTime() } as never);
    await settle();
    // IS's window is Prague time, whatever zone this runs in (CI is UTC).
    const opens = pragueMinuteIso(new Date(NOW.getTime() + 5 * 60_000));
    useAppStore.setState({ isNotices: { cz: [notice('k2', opens)], en: [] } } as never);
    await settle();
    expect(posted()).toEqual([]);
    useAppStore.setState({ now: new Date(NOW.getTime() + 6 * 60_000) });
    await settle();
    expect(posted()).toEqual([expect.objectContaining({ title: 'Výpadek Microsoft 365' })]);
  });

  // A cached list is a baseline too: a failed first live fetch must not
  // leave the notices it holds without a notification.
  it('records from a cached notice list when the live fetch has not succeeded', async () => {
    useAppStore.setState({ isNotices: { cz: [notice('old', null)], en: [] } } as never);
    await settle();
    expect((db.get(`meta/${NOVINKY_NOTIFIED_KEY}`) as { notices?: string[] }).notices).toEqual([
      expect.stringContaining('old'),
    ]);
  });
});
