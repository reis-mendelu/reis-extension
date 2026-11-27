import { describe, it, expect } from 'vitest';
import {
  gridRows,
  growHours,
  spanOf,
  tapCell,
  type CellState,
  type GridPick,
} from '../libraryGrid';
import { LIBRARY_ROOMS } from '../../../data/map/libraryRooms';
import type { Block } from '../availability';

const [a, b] = LIBRARY_ROOMS;
const A = a!.featureId;
const B = b!.featureId;
// Monday 16 November 2026, 09:30. The library sells 07–19; with an hour's notice 11:00 is the first row.
const NOW = new Date('2026-11-16T09:30:00+01:00');
const DAY = '2026-11-16';
const free = (from: number, to: number): Block => ({
  status: 'free',
  start: `${DAY}T${String(from).padStart(2, '0')}:00`,
  end: `${DAY}T${String(to).padStart(2, '0')}:00`,
});

describe('gridRows', () => {
  it('draws no row for hours that are gone, and marks free, taken and unknown cells', () => {
    const rows = gridRows({ [A]: [free(7, 19)], [B]: [free(13, 19)] }, DAY, NOW, new Set([15]), []);
    expect(rows[0]!.hour).toBe(11);
    expect(rows.map((r) => r.hour)).toEqual([11, 12, 13, 14, 15, 16, 17, 18]);
    expect(rows[0]!.cells[A]).toBe('free');
    expect(rows[0]!.cells[B]).toBe('taken');
    expect(rows[2]!.cells[B]).toBe('free');
    // A room the library did not answer for is "could not ask", never "taken".
    expect(rows[0]!.cells[LIBRARY_ROOMS[2]!.featureId]).toBe('unknown');
    expect(rows.find((r) => r.hour === 15)!.lesson).toBe(true);
    expect(rows.find((r) => r.hour === 14)!.lesson).toBe(false);
  });

  it('shows the student’s own booking as theirs, over whatever the library says', () => {
    const rows = gridRows({ [A]: [free(7, 19)] }, DAY, NOW, new Set(), [
      {
        id: 'library:X',
        date: '20261116',
        startTime: '14:00',
        endTime: '16:00',
        libraryBooking: { featureId: A },
      },
    ]);
    const at = (h: number) => rows.find((r) => r.hour === h)!.cells[A];
    expect([at(13), at(14), at(15), at(16)]).toEqual(['free', 'mine', 'mine', 'free']);
  });

  it('has no rows left after the last bookable hour', () => {
    expect(
      gridRows({ [A]: [free(7, 19)] }, DAY, new Date('2026-11-16T17:30:00+01:00'), new Set(), [])
    ).toEqual([]);
  });
});

describe('tapCell', () => {
  const state =
    (taken: number[] = []) =>
    (room: number, hour: number): CellState =>
      room === A && hour >= 11 && hour <= 18 && !taken.includes(hour) ? 'free' : 'taken';
  const pick = (hours: number[], room = A): GridPick => ({ room, hours });

  it('starts a pick on a free cell and ignores a taken one', () => {
    expect(tapCell(null, A, 14, state(), 4)).toEqual(pick([14]));
    expect(tapCell(null, A, 14, state([14]), 4)).toBeNull();
    expect(tapCell(null, B, 14, state(), 4)).toBeNull();
  });

  it('grows by a neighbour, shrinks from an end, clears the last hour', () => {
    let p = tapCell(null, A, 14, state(), 4);
    p = tapCell(p, A, 15, state(), 4);
    p = tapCell(p, A, 13, state(), 4);
    expect(p).toEqual(pick([13, 14, 15]));
    expect(tapCell(p, A, 13, state(), 4)).toEqual(pick([14, 15]));
    expect(tapCell(p, A, 15, state(), 4)).toEqual(pick([13, 14]));
    expect(tapCell(pick([14]), A, 14, state(), 4)).toBeNull();
  });

  it('starts over on a far cell or another room, and stops growing at what is left of the day', () => {
    expect(tapCell(pick([14, 15]), A, 17, state(), 4)).toEqual(pick([17]));
    expect(tapCell(pick([14, 15]), B, 14, (r) => (r === B ? 'free' : 'taken'), 4)).toEqual(
      pick([14], B)
    );
    expect(tapCell(pick([14, 15]), A, 16, state(), 2)).toEqual(pick([14, 15]));
    expect(tapCell(null, A, 14, state(), 0)).toBeNull();
  });

  it('does not grow over a taken hour', () => {
    expect(tapCell(pick([14]), A, 15, state([15]), 4)).toEqual(pick([14]));
  });
});

describe('growHours and spanOf', () => {
  const state = (room: number, hour: number): CellState =>
    room === A && hour !== 16 && hour >= 11 && hour <= 18 ? 'free' : 'taken';
  it('offers a + above and below while the pick can grow, and not over a taken hour', () => {
    expect(growHours({ room: A, hours: [14, 15] }, state, 4)).toEqual([13]);
    expect(growHours({ room: A, hours: [14] }, state, 4)).toEqual([13, 15]);
    expect(growHours({ room: A, hours: [13, 14] }, state, 4)).toEqual([12, 15]);
    // 16 is taken, so a pick ending at 15 cannot grow downwards past it.
    expect(growHours({ room: A, hours: [14, 15] }, state, 4)).toEqual([13]);
    expect(growHours({ room: A, hours: [12, 13] }, state, 2)).toEqual([]);
    expect(growHours(null, state, 4)).toEqual([]);
  });
  it('gives the span with an exclusive end', () => {
    expect(spanOf({ room: A, hours: [14, 15] })).toEqual({ from: 14, to: 16 });
    expect(spanOf(null)).toBeNull();
  });
});
