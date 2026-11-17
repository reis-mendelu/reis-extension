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
import {
  installNovinkyNotifications,
  clearNovinkyNotifications,
  NOVINKY_NOTIFIED_KEY,
} from '../novinkyNotifications';
import { NOVINKY_KIND } from '../novinkyPost';
import { examTermKey } from '../../utils/newExamTerms';
import { NOW, baseState, event, settle } from './novinkyFixtures';

const posted = () =>
  ln.schedule.mock.calls.flatMap((c) => c[0].notifications as { title: string; body: string }[]);

describe('Novinky rows as phone notifications', () => {
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

  it('records what is on screen at the first run and posts nothing', async () => {
    useAppStore.setState({ examTermsNew: [examTermKey('EBC-VWA', '1')] });
    await settle();
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(db.get(`meta/${NOVINKY_NOTIFIED_KEY}`)).toMatchObject({ alerts: [expect.any(String)] });
  });

  it('posts a new row once, with the row’s own words', async () => {
    await settle();
    useAppStore.setState({ examTermsNew: [examTermKey('EBC-VWA', '1')] });
    await settle();
    expect(posted()).toEqual([
      expect.objectContaining({
        title: 'Nový termín: Vývoj webových aplikací',
        body: 'zkouška · 14. 12.',
        extra: { kind: NOVINKY_KIND, group: 'terms', courseCode: 'EBC-VWA' },
      }),
    ]);
    useAppStore.setState({ now: new Date(NOW.getTime() + 60_000) });
    await settle();
    expect(posted()).toHaveLength(1);
  });

  // The store's clock ticks every second (useAppStore's pulse). A tick must
  // not restart the settle wait, or nothing is ever posted.
  it('posts while the one-second clock keeps ticking', async () => {
    await settle();
    const pulse = setInterval(() => useAppStore.setState({ now: new Date() }), 1000);
    useAppStore.setState({ examTermsNew: [examTermKey('EBC-VWA', '1')] });
    await vi.advanceTimersByTimeAsync(5000);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    clearInterval(pulse);
    expect(posted()).toHaveLength(1);
  });

  // A batch at second T used ids T..T+n; a second batch a moment later must not
  // reuse one, or it replaces an unread notification.
  it('never reuses a notification id between close batches', async () => {
    await settle();
    // Three kinds at once: ids T, T+1, T+2. The next batch comes 2 s later, at T+2.
    useAppStore.setState({
      examTermsNew: [examTermKey('EBC-VWA', '1')],
      zaznamnikNewPoints: { 'EBC-VWA': [{ label: 'Test 1', value: '9' }] },
      notifications: { ...useAppStore.getState().notifications, data: [event] },
    } as never);
    await settle();
    useAppStore.setState({
      examTermsNew: [examTermKey('EBC-VWA', '1'), examTermKey('EBC-VWA', '2')],
    });
    await settle();
    const ids = ln.schedule.mock.calls.flatMap((c) =>
      (c[0].notifications as { id: number }[]).map((n) => n.id)
    );
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('records but posts nothing while notifications are not allowed', async () => {
    await settle();
    ln.checkPermissions.mockResolvedValue({ display: 'denied' });
    useAppStore.setState({ examTermsNew: [examTermKey('EBC-VWA', '1')] });
    await settle();
    expect(ln.schedule).not.toHaveBeenCalled();
    // Allowed later: what was recorded meanwhile does not arrive as a backlog.
    ln.checkPermissions.mockResolvedValue({ display: 'granted' });
    useAppStore.setState({ now: new Date(NOW.getTime() + 60_000) });
    await settle();
    expect(ln.schedule).not.toHaveBeenCalled();
  });

  it('posts a society event, and none while that switch is off', async () => {
    await settle();
    useAppStore.setState({
      notifications: { ...useAppStore.getState().notifications, data: [event] },
    } as never);
    await settle();
    expect(posted()).toEqual([expect.objectContaining({ title: 'Deskovky', body: 'SU PEF' })]);

    useAppStore.setState({
      notifySocieties: false,
      notifications: {
        ...useAppStore.getState().notifications,
        data: [event, { ...event, id: 'ev2', title: 'Pivní běh' }],
      },
    } as never);
    await settle();
    expect(posted()).toHaveLength(1);
  });

  it('sign-out clears what it posted and the record', async () => {
    await settle();
    // 5.7.x posted points under its own kind; one may still be in the tray.
    ln.getDeliveredNotifications.mockResolvedValue({
      notifications: [
        { id: 1, extra: { kind: NOVINKY_KIND } },
        { id: 2, extra: { kind: 'other' } },
        { id: 3, extra: { kind: 'zaznamnik-new-points' } },
      ],
    });
    await clearNovinkyNotifications();
    expect(ln.removeDeliveredNotifications).toHaveBeenCalledWith({
      notifications: [
        { id: 1, extra: { kind: NOVINKY_KIND } },
        { id: 3, extra: { kind: 'zaznamnik-new-points' } },
      ],
    });
    expect(db.has(`meta/${NOVINKY_NOTIFIED_KEY}`)).toBe(false);
  });
});
