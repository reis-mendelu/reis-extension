import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import type { ExamSubject } from '../../types/exams';
import type { StudyPlan, SubjectStatus } from '../../types/studyPlan';

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

import { installExamReminders, reconcileExamReminders } from '../examReminders';
import { EXAM_OPENING_KIND, examOpeningReminders } from '../../utils/examOpeningReminders';

// 20 Jan 2027, 9:00 in Prague: the winter semester's exam period.
const NOW = new Date(Date.UTC(2027, 0, 20, 8, 0));

const exam = (code: string): ExamSubject => ({
  version: 1,
  id: code,
  name: code,
  code,
  sections: [
    {
      id: `s-${code}`,
      name: 'zkouška',
      type: 'exam',
      status: 'available',
      terms: [
        {
          id: `t-${code}`,
          date: '05.02.2027',
          time: '10:00',
          registrationStart: '22.01.2027 13:00',
        },
      ],
    },
  ],
});
const exams = [exam('XX-OLD'), exam('XX-ZS')];
const idOf = (code: string) => examOpeningReminders([exam(code)], NOW, 'cz')[0]!.id;

const row = (code: string, over: Partial<SubjectStatus>): SubjectStatus => ({
  id: code,
  code,
  name: code,
  credits: 5,
  type: 'zk',
  isEnrolled: false,
  isFulfilled: false,
  enrollmentCount: 1,
  rawStatusText: '',
  ...over,
});
// XX-OLD was passed last June; XX-ZS is this winter's, still not passed.
const plan: StudyPlan = {
  title: 'plan',
  isFulfilled: false,
  creditsAcquired: 60,
  creditsRequired: 180,
  blocks: [
    {
      title: '3. semestr',
      groups: [
        {
          name: 'g',
          statusDescription: '',
          subjects: [
            row('XX-OLD', { isFulfilled: true, fulfillmentDate: '10.06.2026' }),
            row('XX-ZS', { isEnrolled: true }),
          ],
        },
      ],
    },
  ],
};

const flush = () => new Promise((r) => setTimeout(r, 0));
const scheduledIds = () =>
  ln.schedule.mock.calls.flatMap((c) => c[0].notifications.map((n: { id: number }) => n.id));

describe('exam-opening reminders — subjects from an earlier semester', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    for (const fn of Object.values(ln)) fn.mockReset();
    ln.checkPermissions.mockResolvedValue({ display: 'granted' });
    ln.getPending.mockResolvedValue({ notifications: [] });
    ln.getDeliveredNotifications.mockResolvedValue({ notifications: [] });
    useAppStore.setState({
      language: 'cz',
      mobileTab: 'calendar',
      studyPlanDual: { cz: plan, en: plan },
      exams: { ...useAppStore.getState().exams, data: exams },
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  // The winter subject in its January exam period is still this semester's.
  it('reminds about the winter subject in January, not about last year’s', async () => {
    await reconcileExamReminders();
    expect(scheduledIds()).toEqual([idOf('XX-ZS')]);
  });

  it('cancels a reminder already held for a past subject', async () => {
    ln.getPending.mockResolvedValue({
      notifications: [{ id: idOf('XX-OLD'), extra: { kind: EXAM_OPENING_KIND } }],
    });
    await reconcileExamReminders();
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: idOf('XX-OLD') }] });
  });

  it('without a plan nothing is suppressed', async () => {
    useAppStore.setState({ studyPlanDual: null } as never);
    await reconcileExamReminders();
    expect(scheduledIds().sort()).toEqual([idOf('XX-OLD'), idOf('XX-ZS')].sort());
  });

  // The plan can land after the exams: the reminder scheduled meanwhile for a
  // past subject must go when it does.
  it('reconciles again when the study plan arrives', async () => {
    useAppStore.setState({ studyPlanDual: null } as never);
    installExamReminders();
    await flush();
    ln.getPending.mockResolvedValue({
      notifications: [
        { id: idOf('XX-OLD'), extra: { kind: EXAM_OPENING_KIND } },
        { id: idOf('XX-ZS'), extra: { kind: EXAM_OPENING_KIND } },
      ],
    });
    useAppStore.setState({ studyPlanDual: { cz: plan, en: plan } } as never);
    await flush();
    await flush();
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: idOf('XX-OLD') }] });
  });
});
