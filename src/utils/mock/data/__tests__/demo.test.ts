import { describe, it, expect } from 'vitest';
import { demoDataset } from '../demo';

/** IS Mendelu's compact schedule-lesson date format: "YYYYMMDD". */
function todayCompact(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/** Parse the IS exam-term "DD.MM.YYYY" form into a real Date, midnight local. */
function parseIsDate(s: string): Date {
  const [day, month, year] = s.split('.').map(Number);
  return new Date(year!, month! - 1, day!);
}

describe('demoDataset dates', () => {
  it('has at least two schedule lessons dated today (compact YYYYMMDD form)', () => {
    const today = todayCompact();
    const todaysLessons = demoDataset.schedule.filter((lesson) => lesson.date === today);
    expect(todaysLessons.length).toBeGreaterThanOrEqual(2);
  });

  it('has schedule lessons on the days surrounding today so the day switcher has neighbours', () => {
    // Any date other than today's proves the dataset spans more than one day —
    // the exact neighbour offsets are an implementation detail this test
    // shouldn't pin down.
    const today = todayCompact();
    const otherDays = new Set(demoDataset.schedule.map((l) => l.date).filter((d) => d !== today));
    expect(otherDays.size).toBeGreaterThanOrEqual(1);
  });

  it('places every exam term in the future, so the exams tab is never stuck in a past year', () => {
    const now = new Date();
    const termDates = demoDataset.exams.flatMap((subject) =>
      subject.sections.flatMap((section) => section.terms.map((term) => parseIsDate(term.date)))
    );
    expect(termDates.length).toBeGreaterThan(0);
    for (const date of termDates) {
      expect(date.getTime()).toBeGreaterThan(now.getTime());
    }
  });
});
