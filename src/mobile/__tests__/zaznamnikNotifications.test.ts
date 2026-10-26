import { describe, it, expect, vi, beforeEach } from 'vitest';

const { ln, store } = vi.hoisted(() => ({
  ln: {
    addListener: vi.fn(),
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    createChannel: vi.fn(),
    schedule: vi.fn(),
    getDeliveredNotifications: vi.fn(),
    removeDeliveredNotifications: vi.fn(),
  },
  store: {
    language: 'cz',
    subjects: {
      data: { 'EBC-PS': { nameCs: 'Počítačové sítě', displayName: 'PS', subjectId: '164074' } },
    },
    setMobileTab: vi.fn(),
    pushSheet: vi.fn(),
  },
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios' } }));
vi.mock('../../store/useAppStore', () => ({ useAppStore: { getState: () => store } }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import {
  installZaznamnikNotifications,
  openFromNotification,
  clearZaznamnikNotifications,
  NEW_POINTS_KIND,
} from '../zaznamnikNotifications';
import { notifyNewPoints } from '../../services/newPointsNotifier';

const FOUND = { 'EBC-PS': [{ label: 'IPv4-subnt-NAOPAK', value: '9' }] };
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('záznamník notifications on the phone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installZaznamnikNotifications();
  });

  it('shows one notification for the batch when allowed', async () => {
    ln.checkPermissions.mockResolvedValue({ display: 'granted' });
    notifyNewPoints(FOUND);
    await settle();

    expect(ln.requestPermissions).not.toHaveBeenCalled();
    const [n] = ln.schedule.mock.calls[0]![0].notifications;
    expect(n).toMatchObject({
      title: 'Nové body: Počítačové sítě',
      body: 'IPv4-subnt-NAOPAK: 9',
      extra: { kind: NEW_POINTS_KIND, courseCode: 'EBC-PS' },
    });
    expect(n.schedule).toBeUndefined();
    expect(n.id).toBeLessThan(2 ** 31);
  });

  it('never asks Android for an exact alarm', async () => {
    // The plugin defaults isExactNotification to true and, on Android 12+
    // without SCHEDULE_EXACT_ALARM (stripped in AndroidManifest.xml), opens the
    // "Alarms & reminders" settings screen before posting, even with no
    // `schedule.at`. Inexact must be asked for explicitly.
    ln.checkPermissions.mockResolvedValue({ display: 'granted' });
    notifyNewPoints(FOUND);
    await settle();

    const [n] = ln.schedule.mock.calls[0]![0].notifications;
    expect(n.isExactNotification).toBe(false);
  });

  it('asks once when the student has not decided, and shows it on a yes', async () => {
    ln.checkPermissions.mockResolvedValue({ display: 'prompt' });
    ln.requestPermissions.mockResolvedValue({ display: 'granted' });
    notifyNewPoints(FOUND);
    await settle();
    expect(ln.requestPermissions).toHaveBeenCalledTimes(1);
    expect(ln.schedule).toHaveBeenCalledTimes(1);
  });

  it('shows nothing and asks nothing when denied', async () => {
    ln.checkPermissions.mockResolvedValue({ display: 'denied' });
    notifyNewPoints(FOUND);
    await settle();
    expect(ln.requestPermissions).not.toHaveBeenCalled();
    expect(ln.schedule).not.toHaveBeenCalled();
  });

  it('a tap opens that subject on Záznamník', () => {
    openFromNotification({ kind: NEW_POINTS_KIND, courseCode: 'EBC-PS' });
    expect(store.setMobileTab).toHaveBeenCalledWith('subjects');
    expect(store.pushSheet).toHaveBeenCalledWith({
      kind: 'subjectDrawer',
      courseCode: 'EBC-PS',
      courseName: 'Počítačové sítě',
      courseId: '164074',
      initialTab: 'zaznamnik',
    });
  });

  it('a summary tap opens Novinky; another feature’s tap is not ours', () => {
    openFromNotification({ kind: NEW_POINTS_KIND, courseCode: null });
    expect(store.pushSheet).toHaveBeenCalledWith({ kind: 'notifications' });

    vi.clearAllMocks();
    openFromNotification({ kind: 'exam-opening' });
    expect(store.setMobileTab).not.toHaveBeenCalled();
  });

  it('sign-out removes ours from the tray and stops notifying', async () => {
    const ours = { id: 1, extra: { kind: NEW_POINTS_KIND } };
    ln.getDeliveredNotifications.mockResolvedValue({ notifications: [ours, { id: 2 }] });
    await clearZaznamnikNotifications();
    expect(ln.removeDeliveredNotifications).toHaveBeenCalledWith({ notifications: [ours] });

    ln.checkPermissions.mockResolvedValue({ display: 'granted' });
    notifyNewPoints(FOUND);
    await settle();
    expect(ln.schedule).not.toHaveBeenCalled();
  });

  it('a notification still asking for permission at sign-out is never shown', async () => {
    let grant!: (v: { display: string }) => void;
    ln.checkPermissions.mockResolvedValue({ display: 'prompt' });
    ln.requestPermissions.mockReturnValue(new Promise((r) => (grant = r)));
    ln.getDeliveredNotifications.mockResolvedValue({ notifications: [] });

    notifyNewPoints(FOUND);
    await settle();
    const signedOut = clearZaznamnikNotifications();
    grant({ display: 'granted' });
    await signedOut;
    await settle();

    expect(ln.schedule).not.toHaveBeenCalled();
  });

  it('sign-out waits for a notification being posted, then clears it from the tray', async () => {
    let posted!: () => void;
    ln.checkPermissions.mockResolvedValue({ display: 'granted' });
    ln.schedule.mockReturnValue(new Promise<void>((r) => (posted = r)));
    const ours = { id: 1, extra: { kind: NEW_POINTS_KIND } };
    ln.getDeliveredNotifications.mockResolvedValue({ notifications: [ours] });

    notifyNewPoints(FOUND);
    await settle();
    const signedOut = clearZaznamnikNotifications();
    await settle();
    expect(ln.getDeliveredNotifications).not.toHaveBeenCalled();
    posted();
    await signedOut;

    expect(ln.removeDeliveredNotifications).toHaveBeenCalledWith({ notifications: [ours] });
  });
});
