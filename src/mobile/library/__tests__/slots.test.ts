import { describe, it, expect } from 'vitest';
import { freeHours, hourSummary, DAILY_CAP, overCap } from '../slots';
import type { Block } from '../availability';

const free = (day: string, from: string, to: string): Block => ({
  status: 'free',
  start: `${day}T${from}`,
  end: `${day}T${to}`,
});
const TUE = '2026-11-10';
const early = new Date(2026, 10, 10, 6, 0);

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
    const now = new Date(2026, 10, 10, 9, 30);
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

describe('hourSummary', () => {
  it('counts the free hours and names the next one', () => {
    const now = new Date(2026, 10, 10, 9, 30);
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
