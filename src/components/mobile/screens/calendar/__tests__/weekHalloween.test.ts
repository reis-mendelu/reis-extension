import { describe, it, expect } from 'vitest';
import { weekHalloweenSpots, halloweenDays } from '../weekHalloween';
import type { BlockLesson } from '../../../../../types/calendarTypes';

const h = (hh: number, mm = 0) => hh * 60 + mm;
const RANGE = { start: 7, end: 17 };
const day = (iso: string, ...lessons: [number, number][]) => ({
  iso,
  lessons: lessons.map(([start, end]) => ({ start, end })),
});

/**
 * Where Týden's Halloween decorations go (spec 2026-10-30, Dominik's pick):
 * only into space no lesson uses — a spider down a column free at the top, a
 * pumpkin on the bottom line of a column free at the end. Blocks never get one.
 */
describe('weekHalloweenSpots', () => {
  it('hangs the spider in today when today is free at the top', () => {
    const spots = weekHalloweenSpots(
      [day('mo', [h(7), h(9)]), day('fr', [h(11), h(13)])],
      RANGE,
      'fr'
    );
    expect(spots.spiderDay).toBe('fr');
    expect(spots.spiderFreeMin).toBe(h(11) - h(7));
  });

  it('otherwise in the rightmost column free at the top', () => {
    const spots = weekHalloweenSpots(
      [day('mo', [h(10), h(12)]), day('tu', [h(7), h(9)]), day('we', [h(13), h(15)])],
      RANGE,
      'tu'
    );
    expect(spots.spiderDay).toBe('we');
  });

  it('hangs no spider when every column starts within two hours', () => {
    const spots = weekHalloweenSpots(
      [day('mo', [h(8), h(9)]), day('tu', [h(7), h(9)])],
      RANGE,
      'mo'
    );
    expect(spots.spiderDay).toBeNull();
  });

  it('sits up to two pumpkins on columns free at the end, not under the spider', () => {
    const spots = weekHalloweenSpots(
      [
        day('mo', [h(15), h(17)]),
        day('tu', [h(7), h(9)]),
        day('we'),
        day('th', [h(9), h(11)]),
        day('fr'),
      ],
      RANGE,
      'fr'
    );
    expect(spots.spiderDay).toBe('fr');
    expect(spots.pumpkinDays).toEqual(['th', 'we']);
  });

  it('sits none where every column runs to the end', () => {
    const spots = weekHalloweenSpots(
      [day('mo', [h(7), h(17)]), day('tu', [h(7), h(17)])],
      RANGE,
      'mo'
    );
    expect(spots.spiderDay).toBeNull();
    expect(spots.pumpkinDays).toEqual([]);
  });

  // PR #618 review: the marks read what is DRAWN — an exam's 90-minute floor —
  // and skip a lesson with no usable time instead of passing NaN on.
  it('reads drawn exam ends and skips unusable times', () => {
    const l = (date: string, startTime: string, endTime: string, isExam = false) =>
      ({ date, startTime, endTime, isExam }) as BlockLesson;
    const days = halloweenDays(
      ['2026-11-02'],
      [l('20261102', '15:00', '15:10', true), l('20261102', '', '')]
    );
    expect(days).toEqual([{ iso: '2026-11-02', lessons: [{ start: h(15), end: h(16, 30) }] }]);
  });
});
