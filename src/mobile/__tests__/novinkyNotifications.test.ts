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
import { openNovinkyFromNotification } from '../novinkyTaps';
import { NOVINKY_KIND } from '../novinkyPost';
import { examTermKey } from '../../utils/newExamTerms';
import type { ExamSubject } from '../../types/exams';

const NOW = new Date(2026, 11, 1, 12, 0);

const vwa: ExamSubject = {
  version: 1,
  id: 'EBC-VWA',
  name: 'Vývoj webových aplikací',
  code: 'EBC-VWA',
  sections: [
    {
      id: 'zk',
      name: 'zkouška',
      type: 'exam',
      status: 'open',
      terms: [
        { id: '1', date: '14.12.2026', time: '11:00' },
        { id: '2', date: '17.12.2026', time: '11:00' },
      ],
    },
  ],
};

const event = {
  id: 'ev1',
  title: 'Deskovky',
  body: '',
  associationId: 'supef',
  createdAt: '',
  expiresAt: '2026-12-02T18:00:00Z',
  priority: 'normal' as const,
};

const notice = (key: string, from: string | null) => ({
  key,
  title: 'Výpadek Microsoft 365',
  text: 'Outlook, Teams',
  link: null,
  severity: 'info' as const,
  from,
  until: null,
});

/** Runs the settle timer, then lets the run's awaits finish. */
async function settle() {
  await vi.advanceTimersByTimeAsync(2000);
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

const posted = () =>
  ln.schedule.mock.calls.flatMap((c) => c[0].notifications as { title: string; body: string }[]);

describe('Novinky rows as phone notifications', () => {
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    db.clear();
    ln.checkPermissions.mockResolvedValue({ display: 'granted' });
    useAppStore.setState({
      now: NOW,
      language: 'cz',
      firstSyncSettled: true,
      exams: { data: [vwa], status: 'success', error: null },
      examTermsNew: [],
      odevzdavarny: [],
      odevzdavarnyNew: [],
      zaznamnikNewPoints: {},
      societies: { supef: { name: 'SU PEF' } },
      notifySocieties: true,
      isNoticeMutes: [],
      mobileSheets: [],
      isNotices: { cz: [], en: [] },
      notifications: {
        ...useAppStore.getState().notifications,
        data: [],
        status: 'success',
        readIds: new Set(),
        seenDeadlineAlertIds: new Set(),
      },
    } as never);
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

  // IS notices load on their own: a failed society feed must not hold them back.
  it('posts an IS notice when the society feed failed to load', async () => {
    useAppStore.setState({
      notifications: { ...useAppStore.getState().notifications, status: 'error' },
      isNoticesTriedAt: NOW.getTime(),
      isNoticesLoading: false,
    } as never);
    await settle();
    useAppStore.setState({ isNotices: { cz: [notice('k1', null)], en: [] } } as never);
    await settle();
    expect(posted()).toEqual([expect.objectContaining({ title: 'Výpadek Microsoft 365' })]);
  });

  // IS's own display window is to the minute: the notice is news when it opens,
  // which no store field but the clock says.
  it('posts an IS notice once its display minute arrives', async () => {
    useAppStore.setState({ isNoticesTriedAt: NOW.getTime(), isNoticesLoading: false } as never);
    await settle();
    useAppStore.setState({
      isNotices: { cz: [notice('k2', '2026-12-01T12:05')], en: [] },
    } as never);
    await settle();
    expect(posted()).toEqual([]);
    useAppStore.setState({ now: new Date(2026, 11, 1, 12, 6) });
    await settle();
    expect(posted()).toEqual([expect.objectContaining({ title: 'Výpadek Microsoft 365' })]);
  });

  // 5.7.x's "Nové body" may still be in the tray after the update.
  it('a tap on a 5.7.x points notification still opens the subject', () => {
    openNovinkyFromNotification({ kind: 'zaznamnik-new-points', courseCode: 'EBC-VWA' });
    expect(useAppStore.getState().mobileSheets.at(-1)).toMatchObject({
      kind: 'subjectDrawer',
      courseCode: 'EBC-VWA',
      initialTab: 'zaznamnik',
    });
  });

  it('a tap on a new-term notification opens Zkoušky', () => {
    openNovinkyFromNotification({ kind: NOVINKY_KIND, group: 'terms', courseCode: 'EBC-VWA' });
    expect(useAppStore.getState().mobileTab).toBe('exams');
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
