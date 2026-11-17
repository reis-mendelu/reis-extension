import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import type { ExamSubject } from '../../types/exams';

const ln = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  getPending: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
  createChannel: vi.fn(),
  getDeliveredNotifications: vi.fn(),
  removeDeliveredNotifications: vi.fn(),
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));
vi.mock('@capacitor/core', async (importOriginal) => {
  const real = await importOriginal<typeof import('@capacitor/core')>();
  return { ...real, Capacitor: { ...real.Capacitor, getPlatform: () => 'android' } };
});

import {
  installDeadlineReminders,
  clearDeadlineReminders,
  reconcileDeadlineReminders,
} from '../deadlineReminders';
import { openDeadlineFromNotification } from '../novinkyTaps';
import { DEADLINE_REMINDER_KIND } from '../../utils/deadlineReminders';

const NOW = new Date(Date.UTC(2026, 11, 1, 11, 0)); // 12:00 in Prague

const mine: ExamSubject = {
  version: 1,
  id: 'EBC-VWA',
  name: 'Vývoj webových aplikací',
  code: 'EBC-VWA',
  sections: [
    {
      id: 'zk',
      name: 'zkouška',
      type: 'exam',
      status: 'registered',
      registeredTerm: { id: 't1', date: '07.12.2026', time: '11:00' },
      terms: [],
    },
  ],
};

const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
};
const scheduled = () =>
  ln.schedule.mock.calls.flatMap(
    (c) => c[0].notifications as { id: number; title: string; extra: unknown }[]
  );

/** The phone holds exactly the reminders the exam list and the boxes imply. */
describe('scheduled deadline reminders on the phone', () => {
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    ln.checkPermissions.mockResolvedValue({ display: 'granted' });
    ln.getPending.mockResolvedValue({ notifications: [] });
    useAppStore.setState({
      language: 'cz',
      exams: { data: [mine], status: 'success', error: null },
      odevzdavarny: [],
      studyPlanDual: null,
      courseNicknames: {},
      mobileSheets: [],
      odevzdavarnyStatus: 'success',
    } as never);
    stop = installDeadlineReminders();
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it('schedules the evening-before reminder for the student’s exam', async () => {
    await flush();
    expect(scheduled()).toEqual([
      expect.objectContaining({
        title: 'Zítra: Vývoj webových aplikací',
        extra: { kind: DEADLINE_REMINDER_KIND, group: 'exam', courseCode: 'EBC-VWA' },
      }),
    ]);
    expect(ln.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'reis-deadlines', importance: 4 })
    );
  });

  it('does not schedule what is already pending, and cancels what no longer applies', async () => {
    await flush();
    const [held] = scheduled();
    vi.clearAllMocks();
    ln.checkPermissions.mockResolvedValue({ display: 'granted' });
    ln.getPending.mockResolvedValue({
      notifications: [
        {
          id: held!.id,
          title: held!.title,
          body: (held as { body?: string }).body,
          extra: { kind: DEADLINE_REMINDER_KIND },
        },
        { id: 42, extra: { kind: DEADLINE_REMINDER_KIND } },
        { id: 43, extra: { kind: 'exam-opening' } },
      ],
    });
    await reconcileDeadlineReminders();
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: 42 }] });
  });

  it('schedules nothing without permission', async () => {
    ln.checkPermissions.mockResolvedValue({ display: 'denied' });
    await reconcileDeadlineReminders();
    await flush();
    expect(ln.schedule).toHaveBeenCalledTimes(1); // only the one from install, before denial
  });

  it('a tap opens Zkoušky for an exam, the subject for a box', () => {
    openDeadlineFromNotification({ kind: DEADLINE_REMINDER_KIND, group: 'exam' });
    expect(useAppStore.getState().mobileTab).toBe('exams');
    openDeadlineFromNotification({
      kind: DEADLINE_REMINDER_KIND,
      group: 'box',
      courseCode: 'EBC-M',
    });
    expect(useAppStore.getState().mobileSheets.at(-1)).toMatchObject({
      kind: 'subjectDrawer',
      courseCode: 'EBC-M',
      initialTab: 'zaznamnik',
    });
  });

  it('sign-out cancels pending reminders and clears delivered ones, its own only', async () => {
    await flush();
    ln.getPending.mockResolvedValue({
      notifications: [
        { id: 1, extra: { kind: DEADLINE_REMINDER_KIND } },
        { id: 2, extra: { kind: 'exam-opening' } },
      ],
    });
    ln.getDeliveredNotifications.mockResolvedValue({
      notifications: [{ id: 3, extra: { kind: DEADLINE_REMINDER_KIND } }],
    });
    await clearDeadlineReminders();
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }] });
    expect(ln.removeDeliveredNotifications).toHaveBeenCalledWith({
      notifications: [{ id: 3, extra: { kind: DEADLINE_REMINDER_KIND } }],
    });
  });

  // The boxes load on their own: until they have, a pending box reminder is
  // unknown and left alone, while the exam reminders carry on.
  it('leaves box reminders alone while the boxes are unknown, and still schedules exams', async () => {
    await flush();
    vi.clearAllMocks();
    ln.checkPermissions.mockResolvedValue({ display: 'granted' });
    useAppStore.setState({ odevzdavarnyStatus: 'error' } as never);
    ln.getPending.mockResolvedValue({
      notifications: [{ id: 42, extra: { kind: DEADLINE_REMINDER_KIND, group: 'box' } }],
    });
    await reconcileDeadlineReminders();
    expect(ln.cancel).not.toHaveBeenCalled();
    // The state change wakes the module as well, and the mocked pending list
    // never gains the exam reminder: each run schedules it. Only it, though.
    expect(scheduled().length).toBeGreaterThan(0);
    expect(scheduled().every((n) => n.title === 'Zítra: Vývoj webových aplikací')).toBe(true);
  });

  // Same reminder, new words (a room changed, a nickname): replaced, not kept.
  it('replaces a pending reminder whose text changed', async () => {
    await flush();
    const [held] = scheduled();
    vi.clearAllMocks();
    ln.checkPermissions.mockResolvedValue({ display: 'granted' });
    ln.getPending.mockResolvedValue({
      notifications: [
        {
          id: held!.id,
          title: 'Zítra: VWA',
          body: 'stará místnost',
          extra: { kind: DEADLINE_REMINDER_KIND },
        },
      ],
    });
    await reconcileDeadlineReminders();
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: held!.id }] });
    expect(scheduled()).toEqual([
      expect.objectContaining({ id: held!.id, title: 'Zítra: Vývoj webových aplikací' }),
    ]);
  });
});
