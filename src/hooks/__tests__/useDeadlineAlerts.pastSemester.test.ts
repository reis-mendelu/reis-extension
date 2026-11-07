import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeadlineAlerts } from '../useDeadlineAlerts';
import { useAppStore } from '../../store/useAppStore';
import type { Odevzdavarna } from '../../api/odevzdavarny';
import type { CvicnyTest } from '../../api/cvicneTests';
import type { ExamSubject } from '../../types/exams';
import type { StudyPlan, SubjectStatus } from '../../types/studyPlan';

/**
 * "I got notification about subjects from the last semester" (Task List,
 * decided 2026-11-07): no Novinky row about a subject the student is not
 * taking this semester. Each source below can carry one:
 *
 *  - Nové body: the unseen entries live in IndexedDB until the subject's
 *    Záznamník is opened, so last semester's survive the rollover.
 *  - Boxes: the sync reads the previous IS period on purpose.
 *  - Cvičné testy: seznam_osnov.pl is read without a period at all.
 *  - Exams: IS's list is not the plan.
 *
 * Made-up codes and ids throughout.
 */
const NOW = new Date(2026, 10, 7, 12, 0); // 7 Nov 2026

const row = (code: string, id: string, over: Partial<SubjectStatus>): SubjectStatus => ({
  id,
  code,
  name: code,
  credits: 5,
  type: 'zk',
  isEnrolled: false,
  isFulfilled: false,
  enrollmentCount: 0,
  rawStatusText: 'NEZAPSÁNO',
  ...over,
});
const plan: StudyPlan = {
  title: 'plan',
  isFulfilled: false,
  creditsAcquired: 60,
  creditsRequired: 180,
  blocks: [
    {
      title: '1. semestr',
      groups: [
        {
          name: 'g',
          statusDescription: '',
          subjects: [
            row('XX-OLD', '111', {
              isFulfilled: true,
              enrollmentCount: 1,
              fulfillmentDate: '05.06.2026',
              rawStatusText: 'SPLNĚNO (05.06.2026)',
            }),
            row('XX-NOW', '222', {
              isEnrolled: true,
              enrollmentCount: 1,
              rawStatusText: 'ZAPSÁNO',
            }),
          ],
        },
      ],
    },
  ],
};

const subjects = {
  'XX-OLD': { nameCs: 'Stará', subjectId: '111' },
  'XX-NOW': { nameCs: 'Nová', subjectId: '222' },
};

// Due in 22 h: inside the deadline window.
const box = (courseId: string, id: string): Odevzdavarna => ({
  courseId,
  courseNameCs: courseId,
  courseNameEn: courseId,
  name: 'Projekt',
  type: '',
  deadline: '08.11.2026 10:00',
  odevzdavarnaId: id,
  fileCount: 0,
  uploadUrl: 'https://is.mendelu.cz/x',
  section: 'open',
  isOpen: true,
});

const test = (courseId: string): CvicnyTest => ({
  courseId,
  courseNameCs: courseId,
  courseNameEn: courseId,
  name: 'Procvičení',
  url: 'https://is.mendelu.cz/t',
  status: 'accessible',
});

// Registration opens in 6 h.
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
          date: '20.11.2026',
          time: '09:00',
          registrationStart: '07.11.2026 18:00',
        },
      ],
    },
  ],
});

const alertCodes = () =>
  renderHook(() => useDeadlineAlerts())
    .result.current.alerts.map((a) => `${a.type}:${a.title}`)
    .sort();

describe('useDeadlineAlerts — subjects from an earlier semester', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    useAppStore.setState({
      now: NOW,
      language: 'cz',
      courseNicknames: {},
      subjects: { data: subjects },
      studyPlanDual: { cz: plan, en: plan },
      exams: { data: [exam('XX-OLD'), exam('XX-NOW')], status: 'success', error: null },
      odevzdavarny: [box('111', '1'), box('222', '2')],
      odevzdavarnyNew: ['1', '2'],
      cvicneTests: [test('111'), test('222')],
      zaznamnikNewPoints: {
        'XX-OLD': [{ label: 'Test', value: '5', at: 1 }],
        'XX-NOW': [{ label: 'Test', value: '9', at: 1 }],
      },
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('raises rows for this semester’s subject only', () => {
    expect(alertCodes()).toEqual([
      'assignment-new:Nová',
      'cvicny-test:222',
      'exam-reg-opens:XX-NOW',
      'zaznamnik-points:Nová',
    ]);
  });

  it('the bell counts this semester’s rows only', () => {
    const { unseenCount } = renderHook(() => useDeadlineAlerts()).result.current;
    expect(unseenCount).toBe(4);
  });

  it('an ordinary deadline row of a past subject’s box is dropped too', () => {
    useAppStore.setState({ odevzdavarnyNew: [] } as never);
    expect(alertCodes().filter((c) => c.startsWith('assignment'))).toEqual(['assignment:222']);
  });

  // Unknown is not "past": without a plan nothing is suppressed.
  it('without a study plan every row still shows', () => {
    useAppStore.setState({ studyPlanDual: null } as never);
    expect(alertCodes()).toHaveLength(8);
  });
});
