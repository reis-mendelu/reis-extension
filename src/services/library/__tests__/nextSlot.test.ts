import { describe, it, expect } from 'vitest';
import { computeNextSlot, parseAvailabilityItems } from '@/services/library/nextSlot';
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
      { status: 'BOOKINGSAVAILABILITYSTATUS_AVAILABLE', startDateTime: { dateTime: '2026-07-17T08:00:00', timeZone: 'x' }, endDateTime: { dateTime: '2026-07-17T12:00:00', timeZone: 'x' } },
    ]);
    expect(blocks).toEqual([{ status: 'AVAILABLE', start: '2026-07-17T08:00:00', end: '2026-07-17T12:00:00' }]);
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
