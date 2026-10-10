import { describe, it, expect } from 'vitest';
import { scheduleRows, defaultRange, compactStudyPlan } from '../shape';
import { toResult, CHARACTER_LIMIT } from '../format';

// The shape IS returns, seen live 2026-10-10 (one lecture).
const lesson = (date: string, start = '15:00') => ({
  date,
  isConsultation: 'false',
  room: 'Q01',
  roomStructured: { name: 'Q01', id: '430' },
  studyId: '1',
  endTime: '16:50',
  facultyCode: 'PEF',
  id: '1955078',
  startTime: start,
  isDefaultCampus: 'true',
  courseId: '164226',
  courseName: 'Management',
  campus: 'Brno - Černá Pole',
  isSeminar: 'false',
  teachers: [
    { fullName: 'doc. Ing. A, Ph.D.', id: '1', shortName: 'A. Chládková' },
    { fullName: 'doc. Ing. B, Ph.D.', id: '2', shortName: 'B. Stojanová' },
  ],
  courseCode: 'EBC-MNG',
  periodId: '829',
  courseNameCs: 'Management',
  courseNameEn: 'Management',
  roomCs: 'Q01',
  roomEn: 'Q01',
});

describe('scheduleRows', () => {
  it('keeps only lessons in the window, as compact sorted rows', () => {
    const rows = scheduleRows(
      [
        lesson('20261020', '09:00'),
        lesson('20260921'),
        lesson('20261013', '15:00'),
        lesson('20261013', '07:00'),
      ],
      '2026-10-10',
      '2026-10-24'
    );
    expect(rows.map((r) => `${r.date} ${r.start}`)).toEqual([
      '2026-10-13 07:00',
      '2026-10-13 15:00',
      '2026-10-20 09:00',
    ]);
    expect(rows[0]).toEqual({
      date: '2026-10-13',
      start: '07:00',
      end: '16:50',
      code: 'EBC-MNG',
      subject: 'Management',
      kind: 'lecture',
      room: 'Q01',
      campus: 'Brno - Černá Pole',
      teachers: 'A. Chládková, B. Stojanová',
    });
  });

  it('a whole semester fits in one answer even when asked for all of it', () => {
    const semester = Array.from({ length: 13 * 12 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 8, 21) + Math.floor(i / 12) * 7 * 86_400_000);
      return lesson(d.toISOString().slice(0, 10).replace(/-/g, ''), `${7 + (i % 12)}:00`);
    });
    const rows = scheduleRows(semester, '2026-09-01', '2027-02-28');
    expect(rows).toHaveLength(156);
    const text = toResult(rows, 'markdown').content[0]!.text;
    expect(text.length).toBeLessThan(CHARACTER_LIMIT);
  });

  it('defaults to today and the next 14 days', () => {
    expect(defaultRange(new Date(2026, 9, 10, 12))).toEqual({
      from: '2026-10-10',
      to: '2026-10-24',
    });
  });
});

describe('compactStudyPlan', () => {
  it('keeps the structure and cuts each subject to what answers "what is left"', () => {
    const plan = {
      title: 'B-OI',
      creditsAcquired: 59,
      blocks: [
        {
          title: '1. semestr',
          groups: [
            {
              name: 'Povinné',
              statusDescription: 'SPLNĚNA',
              subjects: [
                {
                  id: 159410,
                  code: 'EBC-ALG',
                  name: 'Algoritmizace',
                  type: 'zk',
                  credits: 6,
                  enrollmentCount: 1,
                  isEnrolled: false,
                  isFulfilled: true,
                  rawStatusText: 'SPLNĚNO (05.01.2026)',
                  fulfillmentDate: '05.01.2026',
                },
              ],
            },
          ],
        },
      ],
    };
    expect(compactStudyPlan(plan)).toEqual({
      title: 'B-OI',
      creditsAcquired: 59,
      blocks: [
        {
          title: '1. semestr',
          groups: [
            {
              name: 'Povinné',
              statusDescription: 'SPLNĚNA',
              subjects: [
                {
                  code: 'EBC-ALG',
                  name: 'Algoritmizace',
                  type: 'zk',
                  credits: 6,
                  isEnrolled: false,
                  isFulfilled: true,
                  fulfillmentDate: '05.01.2026',
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('passes through anything that is not a plan', () => {
    expect(compactStudyPlan(null)).toBeNull();
  });
});
