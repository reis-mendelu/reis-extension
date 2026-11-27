import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { freeHours, hourSummary, DAILY_CAP, overCap } from '../slots';
import type { Block } from '../availability';
import { hourGone } from '../libraryDay';

const free = (day: string, from: string, to: string): Block => ({
  status: 'free',
  start: `${day}T${from}`,
  end: `${day}T${to}`,
});
const TUE = '2026-11-10';
// Instants, not the machine's wall clock: Bookings' hours are Prague's, and CI
// runs in UTC.
const early = new Date('2026-11-10T06:00:00+01:00');
const nineThirty = new Date('2026-11-10T09:30:00+01:00');

describe('freeHours', () => {
  it('lists whole hours inside a free block, 07 to 19', () => {
    const hours = freeHours([free(TUE, '07:00', '19:00')], TUE, early);
    expect(hours).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });
  it('drops hours that a busy block cuts in two', () => {
    const blocks: Block[] = [
      free(TUE, '07:00', '10:30'),
      { status: 'busy', start: `${TUE}T10:30`, end: `${TUE}T12:00` },
      free(TUE, '12:00', '19:00'),
    ];
    const hours = freeHours(blocks, TUE, early);
    expect(hours).not.toContain(10);
    expect(hours).not.toContain(11);
    expect(hours).toContain(9);
    expect(hours).toContain(12);
  });
  it('is empty on a whole-day busy block and on weekends', () => {
    expect(
      freeHours([{ status: 'busy', start: `${TUE}T00:00`, end: `${TUE}T23:59` }], TUE, early)
    ).toEqual([]);
    expect(freeHours([free('2026-11-14', '07:00', '19:00')], '2026-11-14', early)).toEqual([]);
  });
  it('needs one hour of notice', () => {
    const now = nineThirty;
    const hours = freeHours([free(TUE, '07:00', '19:00')], TUE, now);
    expect(hours[0]).toBe(11);
  });
  it('drops an hour a busy block overlays on a free one', () => {
    const blocks: Block[] = [
      free(TUE, '07:00', '19:00'),
      { status: 'busy', start: `${TUE}T15:00`, end: `${TUE}T16:00` },
    ];
    const hours = freeHours(blocks, TUE, early);
    expect(hours).not.toContain(15);
    expect(hours).toContain(14);
    expect(hours).toContain(16);
  });
  it('treats unknown blocks as not free', () => {
    expect(freeHours([], TUE, early)).toEqual([]);
  });
});

// A student abroad (Erasmus, a trip home): the phone's zone is not Prague's,
// but the room is booked in Prague. 9:30 in Prague is 3:30 in New York.
describe('freeHours on a phone outside Prague', () => {
  const savedTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'America/New_York';
  });
  afterAll(() => {
    // Assigning undefined would set the string "undefined".
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
  });

  it('really runs in another zone', () => {
    expect(new Date(2026, 10, 10).getTimezoneOffset()).toBe(300);
  });
  it("counts the hour of notice from Prague's clock", () => {
    const hours = freeHours([free(TUE, '07:00', '19:00')], TUE, nineThirty);
    expect(hours[0]).toBe(11);
  });
  it('has nothing left once Prague is past the last hour', () => {
    const evening = new Date('2026-11-10T18:30:00+01:00'); // 12:30 in New York
    expect(freeHours([free(TUE, '07:00', '19:00')], TUE, evening)).toEqual([]);
    expect(hourGone(TUE, 18, evening)).toBe(true);
    expect(hourGone(TUE, 11, nineThirty)).toBe(false);
    expect(hourGone(TUE, 10, nineThirty)).toBe(true);
  });
});

describe('hourSummary', () => {
  it('counts the free hours and names the next one', () => {
    const now = nineThirty;
    const s = hourSummary([free(TUE, '07:00', '19:00')], TUE, now);
    expect(s).toEqual({ count: 8, next: 11 });
  });
});

describe('cap', () => {
  it('stops at four a day', () => {
    expect(DAILY_CAP).toBe(4);
    expect(overCap(3)).toBe(false);
    expect(overCap(4)).toBe(true);
  });
});
