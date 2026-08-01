import { describe, it, expect } from 'vitest';
import { buildDayAgenda, type AgendaRow } from '../dayAgenda';
import { makeLesson as lesson } from '../../../test/fixtures/lesson';

function isEventRow(row: AgendaRow): row is Extract<AgendaRow, { type: 'event' }> {
  return row.type === 'event';
}

describe('buildDayAgenda', () => {
  it('returns an empty list for a day with no lessons', () => {
    expect(buildDayAgenda([], '2026-04-20')).toEqual([]);
  });

  it('returns lessons for the requested day in start order', () => {
    const rows = buildDayAgenda(
      [
        lesson({ id: 'b', startTime: '13:00', endTime: '14:50' }),
        lesson({ id: 'a', startTime: '09:00', endTime: '10:50' }),
      ],
      '2026-04-20'
    );
    expect(rows.filter(isEventRow).map((r) => r.lesson.id)).toEqual(['a', 'b']);
  });

  it('inserts a gap row when the gap is 60 minutes or more', () => {
    const rows = buildDayAgenda(
      [
        lesson({ id: 'a', startTime: '09:00', endTime: '10:50' }),
        lesson({ id: 'b', startTime: '13:00', endTime: '14:50' }),
      ],
      '2026-04-20'
    );
    expect(rows.map((r) => r.type)).toEqual(['event', 'gap', 'event']);
    expect(rows[1]).toEqual({ type: 'gap', minutes: 130 });
  });

  it('does not insert a gap for short breaks', () => {
    const rows = buildDayAgenda(
      [
        lesson({ id: 'a', startTime: '09:00', endTime: '10:50' }),
        lesson({ id: 'b', startTime: '11:00', endTime: '12:50' }),
      ],
      '2026-04-20'
    );
    expect(rows.map((r) => r.type)).toEqual(['event', 'event']);
  });

  it('excludes lessons on other days', () => {
    const rows = buildDayAgenda([lesson({ date: '20260421' })], '2026-04-20');
    expect(rows).toEqual([]);
  });

  it('inserts a gap row when the gap is exactly 60 minutes', () => {
    const rows = buildDayAgenda(
      [
        lesson({ id: 'c', startTime: '09:00', endTime: '10:00' }),
        lesson({ id: 'd', startTime: '11:00', endTime: '12:00' }),
      ],
      '2026-04-20'
    );
    expect(rows.map((r) => r.type)).toEqual(['event', 'gap', 'event']);
    expect(rows[1]).toEqual({ type: 'gap', minutes: 60 });
  });

  it('does not insert a gap row when the gap is 59 minutes', () => {
    const rows = buildDayAgenda(
      [
        lesson({ id: 'e', startTime: '09:00', endTime: '10:00' }),
        lesson({ id: 'f', startTime: '10:59', endTime: '11:59' }),
      ],
      '2026-04-20'
    );
    expect(rows.map((r) => r.type)).toEqual(['event', 'event']);
  });
});
