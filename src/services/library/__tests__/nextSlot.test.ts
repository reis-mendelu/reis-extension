import { describe, it, expect } from 'vitest';
import {
  bookableRangesOnDay,
  bookableRangesToday,
  computeNextSlot,
  isBookableToday,
  isRoomFreeAt,
  parseAvailabilityItems,
} from '@/services/library/nextSlot';
import type { AvailabilityBlock } from '@/types/library';

const day: AvailabilityBlock[] = [
  { status: 'OUT_OF_OFFICE', start: '2026-07-17T00:00:00', end: '2026-07-17T08:00:00' },
  { status: 'AVAILABLE', start: '2026-07-17T08:00:00', end: '2026-07-17T12:00:00' },
  { status: 'BUSY', start: '2026-07-17T12:00:00', end: '2026-07-17T13:00:00' },
  { status: 'AVAILABLE', start: '2026-07-17T14:00:00', end: '2026-07-17T16:00:00' },
  { status: 'OUT_OF_OFFICE', start: '2026-07-17T16:00:00', end: '2026-07-18T00:00:00' },
];

describe('parseAvailabilityItems', () => {
  it('strips the status prefix and keeps local dateTime', () => {
    const blocks = parseAvailabilityItems([
      {
        status: 'BOOKINGSAVAILABILITYSTATUS_AVAILABLE',
        startDateTime: { dateTime: '2026-07-17T08:00:00', timeZone: 'x' },
        endDateTime: { dateTime: '2026-07-17T12:00:00', timeZone: 'x' },
      },
    ]);
    expect(blocks).toEqual([
      { status: 'AVAILABLE', start: '2026-07-17T08:00:00', end: '2026-07-17T12:00:00' },
    ]);
  });
});

describe('computeNextSlot (1h lead)', () => {
  it('picks the next hour-aligned slot ≥ now+1h', () => {
    const now = new Date('2026-07-17T09:10:00');
    expect(computeNextSlot(day, 60, now)).toBe('2026-07-17T11:00:00');
  });
  it('skips a busy hour to the next available block', () => {
    const now = new Date('2026-07-17T11:30:00');
    expect(computeNextSlot(day, 60, now)).toBe('2026-07-17T14:00:00');
  });
  it('returns null when nothing bookable remains in the window', () => {
    const now = new Date('2026-07-17T15:30:00');
    expect(computeNextSlot(day, 60, now)).toBeNull();
  });
});

describe('computeNextSlot (2-day lead, seminar)', () => {
  it('returns null within a single day window', () => {
    const now = new Date('2026-07-17T09:00:00');
    expect(computeNextSlot(day, 2880, now)).toBeNull();
  });
});

describe('isBookableToday', () => {
  it('is true when the earliest slot falls today', () => {
    const now = new Date('2026-07-17T09:10:00');
    expect(isBookableToday(day, 60, now)).toBe(true);
  });
  it('is false when the only slot is on a future day', () => {
    const futureOnly: AvailabilityBlock[] = [
      { status: 'AVAILABLE', start: '2026-07-20T08:00:00', end: '2026-07-20T12:00:00' }, // Mon
    ];
    const now = new Date('2026-07-17T09:00:00');
    expect(isBookableToday(futureOnly, 60, now)).toBe(false);
  });
  it('is false for the 2-day-lead seminar room (next slot is never today)', () => {
    const now = new Date('2026-07-17T09:00:00');
    expect(isBookableToday(day, 2880, now)).toBe(false);
  });
});

describe('bookableRangesToday', () => {
  it('returns every available range today, clipped to the lead-time cutoff', () => {
    const now = new Date('2026-07-17T09:10:00');
    expect(bookableRangesToday(day, 60, now)).toEqual([
      { start: '2026-07-17T11:00:00', end: '2026-07-17T12:00:00' },
      { start: '2026-07-17T14:00:00', end: '2026-07-17T16:00:00' },
    ]);
  });
  it('merges touching available blocks into one range', () => {
    const split: AvailabilityBlock[] = [
      { status: 'AVAILABLE', start: '2026-07-17T08:00:00', end: '2026-07-17T10:00:00' },
      { status: 'AVAILABLE', start: '2026-07-17T10:00:00', end: '2026-07-17T12:00:00' },
    ];
    const now = new Date('2026-07-17T06:00:00');
    expect(bookableRangesToday(split, 60, now)).toEqual([
      { start: '2026-07-17T08:00:00', end: '2026-07-17T12:00:00' },
    ]);
  });
  it('is empty when nothing bookable remains today', () => {
    const now = new Date('2026-07-17T15:30:00');
    expect(bookableRangesToday(day, 60, now)).toEqual([]);
  });
  it('is empty for the 2-day-lead seminar room (never bookable today)', () => {
    const now = new Date('2026-07-17T09:00:00');
    expect(bookableRangesToday(day, 2880, now)).toEqual([]);
  });
});

describe('bookableRangesOnDay', () => {
  const twoDays: AvailabilityBlock[] = [
    { status: 'AVAILABLE', start: '2026-07-17T08:00:00', end: '2026-07-17T12:00:00' }, // Fri
    { status: 'AVAILABLE', start: '2026-07-20T08:00:00', end: '2026-07-20T16:00:00' }, // Mon
  ];
  it('returns a future day whole open window (lead cutoff already passed)', () => {
    const now = new Date('2026-07-17T09:00:00');
    const target = new Date('2026-07-20T00:00:00');
    expect(bookableRangesOnDay(twoDays, 60, target, now)).toEqual([
      { start: '2026-07-20T08:00:00', end: '2026-07-20T16:00:00' },
    ]);
  });
  it('clips the current day by the lead cutoff', () => {
    const now = new Date('2026-07-17T09:10:00');
    const target = new Date('2026-07-17T00:00:00');
    expect(bookableRangesOnDay(twoDays, 60, target, now)).toEqual([
      { start: '2026-07-17T11:00:00', end: '2026-07-17T12:00:00' },
    ]);
  });
});

describe('weekend closure (library shut Sat/Sun)', () => {
  const sat: AvailabilityBlock[] = [
    { status: 'AVAILABLE', start: '2026-07-18T08:00:00', end: '2026-07-18T16:00:00' }, // Saturday
  ];
  it('bookableRangesOnDay is empty on a Saturday even when the mailbox is free', () => {
    const now = new Date('2026-07-17T09:00:00');
    expect(bookableRangesOnDay(sat, 60, new Date('2026-07-18T00:00:00'), now)).toEqual([]);
  });
  it('isRoomFreeAt is false for a Saturday slot', () => {
    const now = new Date('2026-07-17T09:00:00');
    expect(isRoomFreeAt(sat, 60, new Date('2026-07-18T10:00:00'), now)).toBe(false);
  });
  it('computeNextSlot skips the weekend to the next weekday', () => {
    const spanning: AvailabilityBlock[] = [
      { status: 'AVAILABLE', start: '2026-07-18T08:00:00', end: '2026-07-18T16:00:00' }, // Sat
      { status: 'AVAILABLE', start: '2026-07-20T08:00:00', end: '2026-07-20T16:00:00' }, // Mon
    ];
    const now = new Date('2026-07-18T07:00:00'); // Saturday morning
    expect(computeNextSlot(spanning, 60, now)).toBe('2026-07-20T08:00:00');
  });
});

describe('isRoomFreeAt', () => {
  it('is true for an hour fully inside an available block past the lead cutoff', () => {
    const now = new Date('2026-07-17T09:10:00');
    expect(isRoomFreeAt(day, 60, new Date('2026-07-17T14:00:00'), now)).toBe(true);
  });
  it('is false inside a busy block', () => {
    const now = new Date('2026-07-17T09:00:00');
    expect(isRoomFreeAt(day, 60, new Date('2026-07-17T12:00:00'), now)).toBe(false);
  });
  it('is false before the lead cutoff even if the block is available', () => {
    const now = new Date('2026-07-17T09:10:00');
    // 10:00 is inside the 08–12 block but < now+1h rounded, so not bookable
    expect(isRoomFreeAt(day, 60, new Date('2026-07-17T09:00:00'), now)).toBe(false);
  });
});
