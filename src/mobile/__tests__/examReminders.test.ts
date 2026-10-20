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
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));
vi.mock('@capacitor/core', async (importOriginal) => {
  const real = await importOriginal<typeof import('@capacitor/core')>();
  return { ...real, Capacitor: { ...real.Capacitor, getPlatform: () => 'android' } };
});

import { installExamReminders, reconcileExamReminders } from '../examReminders';
import { EXAM_OPENING_KIND, examOpeningReminders } from '../../utils/examOpeningReminders';

const NOW = new Date(2026, 11, 1, 9, 0);

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
    });
    expect(n.schedule.at).toEqual(new Date(2026, 11, 2, 12, 0));
  });

  it('does not schedule a reminder the phone already holds', async () => {
    ln.getPending.mockResolvedValue({
      notifications: [{ id: wantedId(), extra: { kind: EXAM_OPENING_KIND } }],
    });
    await reconcileExamReminders();
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(ln.cancel).not.toHaveBeenCalled();
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

  it('asks for permission when the student opens Zkoušky and a reminder is due', async () => {
    ln.checkPermissions.mockResolvedValue({ display: 'prompt' });
    ln.requestPermissions.mockResolvedValue({ display: 'granted' });
    installExamReminders();
    await flush();
    expect(ln.requestPermissions).not.toHaveBeenCalled();
    useAppStore.getState().setMobileTab('exams');
    await flush();
    expect(ln.requestPermissions).toHaveBeenCalledTimes(1);
  });

  it('does not ask when nothing is due', async () => {
    ln.checkPermissions.mockResolvedValue({ display: 'prompt' });
    useAppStore.setState({ exams: { ...useAppStore.getState().exams, data: [] } } as never);
    installExamReminders();
    useAppStore.getState().setMobileTab('exams');
    await flush();
    expect(ln.requestPermissions).not.toHaveBeenCalled();
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

  it('opens Zkoušky when the reminder is tapped', async () => {
    installExamReminders();
    const [event, handler] = ln.addListener.mock.calls[0]!;
    expect(event).toBe('localNotificationActionPerformed');
    handler({ notification: { extra: { kind: EXAM_OPENING_KIND } } });
    expect(useAppStore.getState().mobileTab).toBe('exams');
  });
});
