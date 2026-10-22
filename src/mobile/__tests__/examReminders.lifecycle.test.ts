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

import { clearExamReminders, installExamReminders, reconcileExamReminders } from '../examReminders';
import { EXAM_OPENING_KIND } from '../../utils/examOpeningReminders';

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
const flush = () => new Promise((r) => setTimeout(r, 0));

/** Permission, the boot load and sign-out — spec 2026-10-20. */
describe('exam-opening reminders: lifecycle', () => {
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

  // Review: opening Zkoušky before the exams loaded found nothing due, and the
  // prompt never came once they arrived.
  it('asks once the exams arrive while Zkoušky is already open', async () => {
    ln.checkPermissions.mockResolvedValue({ display: 'prompt' });
    ln.requestPermissions.mockResolvedValue({ display: 'granted' });
    useAppStore.setState({
      mobileTab: 'exams',
      exams: { ...useAppStore.getState().exams, data: [] },
    } as never);
    installExamReminders();
    await flush();
    expect(ln.requestPermissions).not.toHaveBeenCalled();
    useAppStore.setState({ exams: { ...useAppStore.getState().exams, data: exams } } as never);
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

  // Review: at boot the exams are still loading from IndexedDB. An empty list
  // then is not an answer, and reconciling with it cancelled every reminder.
  it('leaves pending reminders alone while the exam list is still loading', async () => {
    useAppStore.setState({ exams: { data: [], status: 'idle', error: null } } as never);
    ln.getPending.mockResolvedValue({
      notifications: [{ id: 111, extra: { kind: EXAM_OPENING_KIND } }],
    });
    await reconcileExamReminders();
    expect(ln.cancel).not.toHaveBeenCalled();
  });

  it('treats an empty list as the answer once it has loaded', async () => {
    useAppStore.setState({ exams: { data: [], status: 'success', error: null } } as never);
    ln.getPending.mockResolvedValue({
      notifications: [{ id: 111, extra: { kind: EXAM_OPENING_KIND } }],
    });
    await reconcileExamReminders();
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: 111 }] });
  });

  it('reconciles when the boot load finishes, even with the same empty list', async () => {
    const empty: ExamSubject[] = [];
    useAppStore.setState({ exams: { data: empty, status: 'loading', error: null } } as never);
    ln.getPending.mockResolvedValue({
      notifications: [{ id: 111, extra: { kind: EXAM_OPENING_KIND } }],
    });
    installExamReminders();
    await flush();
    expect(ln.cancel).not.toHaveBeenCalled();
    useAppStore.setState({ exams: { data: empty, status: 'success', error: null } } as never);
    await flush();
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: 111 }] });
  });

  // Last: it leaves the module signed out.
  // Review: the next person on the device must not see this student's exams.
  it('on sign-out cancels the reminders, clears delivered ones, and schedules no more', async () => {
    installExamReminders();
    await flush();
    ln.getPending.mockResolvedValue({
      notifications: [{ id: 111, extra: { kind: EXAM_OPENING_KIND } }, { id: 222 }],
    });
    ln.getDeliveredNotifications.mockResolvedValue({
      notifications: [{ id: 333, extra: { kind: EXAM_OPENING_KIND } }, { id: 444 }],
    });
    await clearExamReminders();
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: 111 }] });
    expect(ln.removeDeliveredNotifications).toHaveBeenCalledWith({
      notifications: [{ id: 333, extra: { kind: EXAM_OPENING_KIND } }],
    });
    ln.schedule.mockClear();
    ln.getPending.mockResolvedValue({ notifications: [] });
    useAppStore.setState({ exams: { ...useAppStore.getState().exams, data: [...exams] } } as never);
    await reconcileExamReminders();
    expect(ln.schedule).not.toHaveBeenCalled();
  });
});
