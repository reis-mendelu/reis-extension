import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import type { ExamSubject } from '../../types/exams';

const ln = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  getPending: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
  createChannel: vi.fn(),
  addListener: vi.fn(),
  getDeliveredNotifications: vi.fn(),
  removeDeliveredNotifications: vi.fn(),
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));
vi.mock('@capacitor/core', async (importOriginal) => {
  const real = await importOriginal<typeof import('@capacitor/core')>();
  return { ...real, Capacitor: { ...real.Capacitor, getPlatform: () => 'android' } };
});

import {
  installExamReminders,
  openExamsFromNotification,
  reconcileExamReminders,
} from '../examReminders';
import { EXAM_OPENING_KIND, examOpeningReminders } from '../../utils/examOpeningReminders';

const NOW = new Date(Date.UTC(2026, 11, 1, 8, 0)); // 9:00 in Prague

const exams: ExamSubject[] = [
  {
    version: 1,
    id: 'EBC-EKM',
    name: 'Ekonometrie 1',
    nameCs: 'Ekonometrie 1',
    code: 'EBC-EKM',
    sections: [
      {
        id: 's1',
        name: 'zkouška',
        nameCs: 'Zkouška',
        type: 'exam',
        status: 'available',
        terms: [
          { id: 't1', date: '20.01.2027', time: '10:00', registrationStart: '02.12.2026 13:00' },
        ],
      },
    ],
  },
];
const wantedId = () => examOpeningReminders(exams, NOW, 'cz')[0]!.id;

const flush = () => new Promise((r) => setTimeout(r, 0));

/** Spec 2026-10-20: the phone holds exactly the reminders the exam list implies. */
describe('exam-opening reminders on the phone', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    for (const fn of Object.values(ln)) fn.mockReset();
    ln.checkPermissions.mockResolvedValue({ display: 'granted' });
    ln.getPending.mockResolvedValue({ notifications: [] });
    ln.getDeliveredNotifications.mockResolvedValue({ notifications: [] });
    ln.addListener.mockResolvedValue({ remove: vi.fn() });
    useAppStore.setState({
      language: 'cz',
      mobileTab: 'calendar',
      exams: { ...useAppStore.getState().exams, data: exams },
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('schedules a missing reminder an hour before, in Czech, on its own channel', async () => {
    await reconcileExamReminders();
    expect(ln.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'reis-exam-openings' })
    );
    const [n] = ln.schedule.mock.calls[0]![0].notifications;
    expect(n).toMatchObject({
      id: wantedId(),
      title: 'Za chvíli se otvírá zkouška',
      body: 'Ekonometrie 1 – Zkouška · přihlašování v 13:00',
      channelId: 'reis-exam-openings',
      extra: { kind: EXAM_OPENING_KIND },
      // Android 12+ would otherwise open "Alarms & reminders" (no
      // SCHEDULE_EXACT_ALARM in the manifest); an hour ahead needs no exact alarm.
      isExactNotification: false,
    });
    // 13:00 in Prague is 12:00 UTC; an hour before.
    expect(n.schedule.at).toEqual(new Date(Date.UTC(2026, 11, 2, 11, 0)));
  });

  it('does not schedule a reminder the phone already holds', async () => {
    ln.getPending.mockResolvedValue({
      notifications: [{ id: wantedId(), extra: { kind: EXAM_OPENING_KIND } }],
    });
    await reconcileExamReminders();
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(ln.cancel).not.toHaveBeenCalled();
  });

  // Inexact delivery can run late: a sync between the reminder time and the
  // opening must not cancel a reminder the phone has not shown yet.
  it('keeps a pending reminder whose time has passed until registration opens', async () => {
    const id = wantedId();
    vi.setSystemTime(new Date(Date.UTC(2026, 11, 2, 11, 30))); // 12:30 in Prague, opens 13:00
    ln.getPending.mockResolvedValue({
      notifications: [{ id, extra: { kind: EXAM_OPENING_KIND } }],
    });
    await reconcileExamReminders();
    expect(ln.cancel).not.toHaveBeenCalled();
    expect(ln.schedule).not.toHaveBeenCalled();
  });

  // Registered since, or the date moved: the old reminder would be a lie.
  it('cancels a reminder that no longer applies, and leaves other notifications alone', async () => {
    ln.getPending.mockResolvedValue({
      notifications: [
        { id: 111, extra: { kind: EXAM_OPENING_KIND } },
        { id: 222, extra: { kind: 'something-else' } },
        { id: 333 },
      ],
    });
    await reconcileExamReminders();
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: 111 }] });
  });

  it('schedules nothing without notification permission', async () => {
    ln.checkPermissions.mockResolvedValue({ display: 'prompt' });
    await reconcileExamReminders();
    expect(ln.schedule).not.toHaveBeenCalled();
  });

  it('reschedules when the exam list changes', async () => {
    installExamReminders();
    await flush();
    ln.schedule.mockClear();
    ln.getPending.mockResolvedValue({ notifications: [] });
    useAppStore.setState({ exams: { ...useAppStore.getState().exams, data: [...exams] } } as never);
    await flush();
    expect(ln.schedule).toHaveBeenCalled();
  });

  it('opens Zkoušky when the reminder is tapped; another feature’s tap is not ours', () => {
    useAppStore.getState().setMobileTab('calendar');
    openExamsFromNotification({ kind: 'zaznamnik-new-points' });
    expect(useAppStore.getState().mobileTab).toBe('calendar');
    openExamsFromNotification({ kind: EXAM_OPENING_KIND });
    expect(useAppStore.getState().mobileTab).toBe('exams');
  });

  it('registers no tap listener of its own (notificationTaps owns the one)', () => {
    installExamReminders();
    expect(ln.addListener).not.toHaveBeenCalled();
  });
});
