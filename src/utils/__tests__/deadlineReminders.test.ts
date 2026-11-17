import { describe, it, expect } from 'vitest';
import { deadlineReminders, type DeadlineReminderInputs } from '../deadlineReminders';
import { pragueToInstant } from '../examOpeningReminders';
import type { ExamSection, ExamSubject } from '../../types/exams';
import type { Odevzdavarna } from '../../api/odevzdavarny';

// Tue 1 Dec 2026, 12:00 Prague.
const NOW = pragueToInstant(new Date(2026, 11, 1, 12, 0));
const prague = (y: number, m: number, d: number, h: number, min = 0) =>
  pragueToInstant(new Date(y, m - 1, d, h, min));

const subject = (section: Partial<ExamSection>, code = 'EBC-VWA'): ExamSubject => ({
  version: 1,
  id: code,
  name: 'Vývoj webových aplikací',
  code,
  sections: [{ id: 'zk', name: 'zkouška', type: 'exam', status: 'open', terms: [], ...section }],
});

const box = (extra: Partial<Odevzdavarna> = {}): Odevzdavarna =>
  ({
    courseId: '164073',
    courseCode: 'EBC-M',
    courseNameCs: 'Matlab',
    courseNameEn: 'Matlab',
    name: 'Build MATLAB Proficiency',
    type: 'odevzdavarna-individualni',
    deadline: '05.12.2026 23:59',
    fileCount: 0,
    isOpen: true,
    odevzdavarnaId: 'b1',
    uploadUrl: '',
    ...extra,
  }) as Odevzdavarna;

const inputs = (over: Partial<DeadlineReminderInputs> = {}): DeadlineReminderInputs => ({
  exams: [],
  odevzdavarny: [],
  subjects: undefined,
  nicknames: {},
  studyPlan: null,
  language: 'cz',
  ...over,
});

const kinds = (i: DeadlineReminderInputs) => deadlineReminders(i, NOW).map((r) => r.group);

describe('deadlineReminders: what the phone schedules ahead', () => {
  it('reminds of the student’s own exam at 18:00 Prague time the evening before', () => {
    const [r] = deadlineReminders(
      inputs({
        exams: [
          subject({
            status: 'registered',
            registeredTerm: { id: 't1', date: '07.12.2026', time: '11:00', roomCs: 'Q05 (ČP)' },
          }),
        ],
      }),
      NOW
    );
    expect(r).toMatchObject({ group: 'exam', courseCode: 'EBC-VWA' });
    expect(r!.fireAt).toEqual(prague(2026, 12, 6, 18));
    expect(r!.title).toBe('Zítra: Vývoj webových aplikací');
    expect(r!.body).toBe('11:00 · zkouška · Q05 (ČP)');
  });

  it('does not schedule an evening that has already passed', () => {
    const exams = [
      subject({
        status: 'registered',
        registeredTerm: { id: 't1', date: '02.12.2026', time: '08:00' },
      }),
    ];
    // The evening before is 1 Dec 18:00, still ahead at noon.
    expect(kinds(inputs({ exams }))).toEqual(['exam']);
    const late = pragueToInstant(new Date(2026, 11, 1, 19, 0));
    expect(deadlineReminders(inputs({ exams }), late)).toEqual([]);
  });

  it('reminds a day before the last chance to register closes, when not registered', () => {
    const [r] = deadlineReminders(
      inputs({
        exams: [
          subject({
            terms: [
              {
                id: 'a',
                date: '14.12.2026',
                time: '11:00',
                registrationStart: '20.11.2026 00:00',
                registrationEnd: '05.12.2026 13:00',
              },
              {
                id: 'b',
                date: '10.12.2026',
                time: '11:00',
                registrationStart: '20.11.2026 00:00',
                registrationEnd: '03.12.2026 13:00',
              },
            ],
          }),
        ],
      }),
      NOW
    );
    expect(r).toMatchObject({ group: 'closing' });
    expect(r!.fireAt).toEqual(prague(2026, 12, 4, 13));
  });

  it('says nothing about closing while a term with no end still takes registrations', () => {
    const exams = [
      subject({
        terms: [
          { id: 'a', date: '14.12.2026', time: '11:00', registrationEnd: '05.12.2026 13:00' },
          { id: 'b', date: '20.12.2026', time: '11:00' },
        ],
      }),
    ];
    expect(kinds(inputs({ exams }))).toEqual([]);
  });

  it('reminds a day before a box closes, unless it is handed in', () => {
    const [r] = deadlineReminders(inputs({ odevzdavarny: [box()] }), NOW);
    expect(r).toMatchObject({ group: 'box', title: 'Matlab: odevzdání do zítra' });
    expect(r!.fireAt).toEqual(prague(2026, 12, 4, 23, 59));
    expect(r!.body).toContain('Build MATLAB Proficiency');
    expect(kinds(inputs({ odevzdavarny: [box({ isOpen: false })] }))).toEqual([]);
  });

  it('gives each reminder a stable id below 10⁹', () => {
    const i = inputs({ odevzdavarny: [box()] });
    const [a] = deadlineReminders(i, NOW);
    const [b] = deadlineReminders(i, new Date(NOW.getTime() + 3_600_000));
    expect(a!.id).toBe(b!.id);
    expect(a!.id).toBeLessThan(1_000_000_000);
  });

  it('keeps a reminder whose time has passed but whose event is ahead, when asked', () => {
    const i = inputs({ odevzdavarny: [box({ deadline: '02.12.2026 11:00' })] });
    expect(deadlineReminders(i, NOW)).toEqual([]);
    expect(deadlineReminders(i, NOW, { includeDue: true })).toHaveLength(1);
  });
});
