import type { SocietyDataset } from '../MockManager';
import { addDays, demoPeriodLabel, formatCompactIsDate, formatIsDate } from './demoDates';

/**
 * The dataset behind demo mode.
 *
 * Deliberately fictional — invented students, invented teachers, invented
 * subject codes — because it ships in the production binary and is what an
 * App Store reviewer sees.
 *
 * Czech throughout, deliberately. An earlier draft reused the English ESN
 * dataset for exams and schedule, which put English course names next to this
 * Czech study plan on the same screen.
 *
 * Dates are computed relative to `now`, not committed as literals: a reviewer
 * can open this build on any day, and a hardcoded date (the previous version
 * used February 2027) is only ever "soon" for a few weeks before every
 * schedule and exam term falls outside the calendar's visible range and the
 * demo quietly regresses to its empty state. `now` is captured once, at
 * module evaluation, so every date below is consistent with the others.
 */
const now = new Date();

/** An exam-term date, "DD.MM.YYYY", `dayOffset` days from now. */
const term = (dayOffset: number) => formatIsDate(addDays(now, dayOffset));

/** The same, with a time suffix — for registeredTerm / registration fields. */
const termAt = (dayOffset: number, time: string) => `${term(dayOffset)} ${time}`;

/** A schedule-lesson date, "YYYYMMDD", `dayOffset` days from now. */
const lessonDay = (dayOffset: number) => formatCompactIsDate(addDays(now, dayOffset));

/**
 * Who the demo student is.
 *
 * Not cosmetic. Screens gate real controls on these IDs — DocsSheet disables
 * every download button while `studiumId` is null — so without an identity the
 * demo renders five live-looking buttons that do nothing when tapped, which is
 * a worse first impression than not offering them. With it, a tap reaches the
 * network guard and the student is told why it stopped.
 *
 * The IDs are outside IS Mendelu's real 6-digit student range and every
 * request carrying them is blocked before it leaves the device anyway; they
 * exist only so the URL builders have something to build with.
 */
export const demoContext = {
  studiumId: '900001',
  studentId: '900001',
  obdobiId: '900',
  facultyId: '900',
  fullName: 'Jana Ukázková',
  userFaculty: 'PEF',
  userSemester: demoPeriodLabel(now),
} as const;

export const demoDataset: SocietyDataset = {
  id: 'demo',
  name: 'Ukázka',

  exams: [
    {
      version: 1,
      id: 'exam-alg',
      name: 'Algoritmizace',
      code: 'DEM-ALG',
      sections: [
        {
          id: 'alg-zkouska',
          name: 'zkouška',
          type: 'exam',
          status: 'registered',
          registeredTerm: {
            id: 'alg-term-1',
            date: term(14),
            time: '09:00',
            room: 'Q01',
            teacher: 'doc. Ing. Petr Novák, Ph.D.',
            teacherId: 'novak-petr',
            deregistrationDeadline: termAt(13, '23:59'),
          },
          terms: [
            {
              id: 'alg-term-1',
              date: term(14),
              time: '09:00',
              capacity: { occupied: 18, total: 25, raw: '18/25' },
              full: false,
              room: 'Q01',
              teacher: 'doc. Ing. Petr Novák, Ph.D.',
              teacherId: 'novak-petr',
              registrationStart: termAt(0, '00:00'),
              registrationEnd: termAt(13, '23:59'),
              attemptTypes: ['regular'],
              canRegisterNow: true,
            },
          ],
        },
      ],
    },
    {
      version: 1,
      id: 'exam-sta',
      name: 'Statistika',
      code: 'DEM-STA',
      sections: [
        {
          id: 'sta-zkouska',
          name: 'zkouška',
          type: 'exam',
          status: 'open',
          terms: [
            {
              id: 'sta-term-1',
              date: term(21),
              time: '10:00',
              capacity: { occupied: 15, total: 20, raw: '15/20' },
              full: false,
              room: 'Z18',
              teacher: 'Ing. Jana Dvořáková, Ph.D.',
              teacherId: 'dvorakova-jana',
              registrationStart: termAt(8, '00:00'),
              registrationEnd: termAt(20, '23:59'),
              attemptTypes: ['regular'],
              canRegisterNow: true,
            },
          ],
        },
      ],
    },
  ],

  schedule: [
    {
      id: 'sched-today-alg',
      date: lessonDay(0),
      startTime: '08:00',
      endTime: '09:30',
      courseCode: 'DEM-ALG',
      courseName: 'Algoritmizace',
      room: 'Q01',
      roomStructured: { name: 'Q01', id: 'q01' },
      teachers: [{ fullName: 'doc. Ing. Petr Novák, Ph.D.', shortName: 'Novák', id: 'novak-petr' }],
      isExam: false,
      isConsultation: 'false',
      studyId: '',
      facultyCode: 'PEF',
      isDefaultCampus: 'true',
      courseId: 'dem-alg',
      campus: 'Brno',
      isSeminar: 'false',
      periodId: '',
    },
    {
      id: 'sched-today-sta',
      date: lessonDay(0),
      startTime: '10:00',
      endTime: '11:30',
      courseCode: 'DEM-STA',
      courseName: 'Statistika',
      room: 'Z18',
      roomStructured: { name: 'Z18', id: 'z18' },
      teachers: [
        { fullName: 'Ing. Jana Dvořáková, Ph.D.', shortName: 'Dvořáková', id: 'dvorakova-jana' },
      ],
      isExam: false,
      isConsultation: 'false',
      studyId: '',
      facultyCode: 'PEF',
      isDefaultCampus: 'true',
      courseId: 'dem-sta',
      campus: 'Brno',
      isSeminar: 'true',
      periodId: '',
    },
    {
      id: 'sched-yesterday-eko',
      date: lessonDay(-1),
      startTime: '13:00',
      endTime: '14:30',
      courseCode: 'DEM-EKO',
      courseName: 'Mikroekonomie',
      room: 'Q01',
      roomStructured: { name: 'Q01', id: 'q01' },
      teachers: [{ fullName: 'doc. Ing. Petr Novák, Ph.D.', shortName: 'Novák', id: 'novak-petr' }],
      isExam: false,
      isConsultation: 'false',
      studyId: '',
      facultyCode: 'PEF',
      isDefaultCampus: 'true',
      courseId: 'dem-eko',
      campus: 'Brno',
      isSeminar: 'false',
      periodId: '',
    },
    {
      id: 'sched-tomorrow-sta-seminar',
      date: lessonDay(1),
      startTime: '15:00',
      endTime: '16:30',
      courseCode: 'DEM-STA',
      courseName: 'Statistika',
      room: 'Z18',
      roomStructured: { name: 'Z18', id: 'z18' },
      teachers: [
        { fullName: 'Ing. Jana Dvořáková, Ph.D.', shortName: 'Dvořáková', id: 'dvorakova-jana' },
      ],
      isExam: false,
      isConsultation: 'false',
      studyId: '',
      facultyCode: 'PEF',
      isDefaultCampus: 'true',
      courseId: 'dem-sta',
      campus: 'Brno',
      isSeminar: 'true',
      periodId: '',
    },
  ],

  syllabuses: {},
  success_rates: {},

  studyPlan: {
    cz: {
      title: 'Ukázkový studijní plán',
      isFulfilled: false,
      creditsAcquired: 96,
      creditsRequired: 180,
      blocks: [
        {
          title: '3. semestr',
          groups: [
            {
              name: 'Povinné předměty',
              statusDescription: 'Splněno 2 z 3',
              minCount: 3,
              subjects: [
                {
                  id: 'demo-alg',
                  code: 'DEM-ALG',
                  name: 'Algoritmizace',
                  credits: 6,
                  type: 'povinný',
                  isEnrolled: true,
                  isFulfilled: true,
                  enrollmentCount: 1,
                  fulfillmentDate: '2026-01-28',
                  rawStatusText: 'splněno',
                },
                {
                  id: 'demo-sta',
                  code: 'DEM-STA',
                  name: 'Statistika',
                  credits: 5,
                  type: 'povinný',
                  isEnrolled: true,
                  isFulfilled: false,
                  enrollmentCount: 1,
                  rawStatusText: 'zapsáno',
                },
                {
                  id: 'demo-eko',
                  code: 'DEM-EKO',
                  name: 'Mikroekonomie',
                  credits: 5,
                  type: 'povinný',
                  isEnrolled: true,
                  isFulfilled: true,
                  enrollmentCount: 1,
                  fulfillmentDate: '2026-01-20',
                  rawStatusText: 'splněno',
                },
              ],
            },
          ],
        },
      ],
    },
    en: {
      title: 'Sample study plan',
      isFulfilled: false,
      creditsAcquired: 96,
      creditsRequired: 180,
      blocks: [
        {
          title: 'Semester 3',
          groups: [
            {
              name: 'Compulsory courses',
              statusDescription: '2 of 3 completed',
              minCount: 3,
              subjects: [
                {
                  id: 'demo-alg',
                  code: 'DEM-ALG',
                  name: 'Algorithms',
                  credits: 6,
                  type: 'compulsory',
                  isEnrolled: true,
                  isFulfilled: true,
                  enrollmentCount: 1,
                  fulfillmentDate: '2026-01-28',
                  rawStatusText: 'completed',
                },
                {
                  id: 'demo-sta',
                  code: 'DEM-STA',
                  name: 'Statistics',
                  credits: 5,
                  type: 'compulsory',
                  isEnrolled: true,
                  isFulfilled: false,
                  enrollmentCount: 1,
                  rawStatusText: 'enrolled',
                },
                {
                  id: 'demo-eko',
                  code: 'DEM-EKO',
                  name: 'Microeconomics',
                  credits: 5,
                  type: 'compulsory',
                  isEnrolled: true,
                  isFulfilled: true,
                  enrollmentCount: 1,
                  fulfillmentDate: '2026-01-20',
                  rawStatusText: 'completed',
                },
              ],
            },
          ],
        },
      ],
    },
  },

  studyStats: {
    currentSemester: {
      enrolledCredits: 30,
      earnedCredits: 24,
      unearnedCredits: 6,
      completedSubjects: 4,
      gpa: 1.8,
      gpaWithFails: 2.1,
    },
    previousSemester: {
      enrolledCredits: 30,
      earnedCredits: 30,
      unearnedCredits: 0,
      completedSubjects: 5,
      gpa: 1.6,
      gpaWithFails: 1.6,
    },
    totalEarnedCredits: 96,
    creditsLastTwoPeriods: 54,
    repeatedSubjects: 0,
    registrationVouchersInitial: 3,
    registrationVouchersCurrent: 3,
    gpaTotal: 1.7,
    weightedGpaTotal: 1.75,
  },

  studyComparison: {
    rank: 34,
    total: 549,
    percentile: 6.2,
    gpa: 1.7,
    nextBetterGpa: 1.68,
  },
};
