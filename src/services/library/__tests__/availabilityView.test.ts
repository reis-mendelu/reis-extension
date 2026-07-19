import { describe, it, expect } from 'vitest';
import { pickableDays, openStartHours } from '@/services/library/availabilityView';
import type { AvailabilityBlock } from '@/types/library';

// Local Y-M-D (not toISOString, which is UTC and would shift local midnight).
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const blocks: AvailabilityBlock[] = [
  { status: 'OUT_OF_OFFICE', start: '2026-07-16T00:00:00', end: '2026-07-16T08:00:00' },
  { status: 'AVAILABLE', start: '2026-07-16T08:00:00', end: '2026-07-16T16:00:00' }, // Thu
  { status: 'AVAILABLE', start: '2026-07-17T08:00:00', end: '2026-07-17T12:00:00' }, // Fri
  { status: 'BUSY', start: '2026-07-17T12:00:00', end: '2026-07-17T13:00:00' },
  { status: 'AVAILABLE', start: '2026-07-18T09:00:00', end: '2026-07-18T11:00:00' }, // Sat (closed)
  { status: 'AVAILABLE', start: '2026-07-20T08:00:00', end: '2026-07-20T16:00:00' }, // Mon
];

describe('pickableDays', () => {
  it('includes today plus future open days, dropping the past', () => {
    const now = new Date('2026-07-17T09:00:00'); // Friday
    expect(pickableDays(blocks, now).map(ymd)).toEqual(['2026-07-17', '2026-07-20']);
  });
  it('excludes weekend days even when the mailbox reports them free', () => {
    const now = new Date('2026-07-17T09:00:00');
    expect(pickableDays(blocks, now).map(ymd)).not.toContain('2026-07-18'); // Saturday
  });
  it('includes today (a weekday) even when nothing remains bookable today', () => {
    const now = new Date('2026-07-20T23:00:00'); // Monday, after hours
    expect(pickableDays(blocks, now).map(ymd)).toEqual(['2026-07-20']);
  });
});

describe('openStartHours', () => {
  it('lists distinct whole-hour starts across all available blocks', () => {
    // 08–16 → 8..15, 08–12 → 8..11, 09–11 → 9,10 ⇒ union 8..15
    expect(openStartHours(blocks)).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
  });
  it('ignores busy and out-of-office blocks', () => {
    const busyOnly: AvailabilityBlock[] = [
      { status: 'BUSY', start: '2026-07-17T08:00:00', end: '2026-07-17T16:00:00' },
    ];
    expect(openStartHours(busyOnly)).toEqual([]);
  });
  it('scopes hours to a given day so other days do not leak', () => {
    // Fri open 08–12 → 8..11; Mon open 08–16 → 8..15
    expect(openStartHours(blocks, new Date('2026-07-17T00:00:00'))).toEqual([8, 9, 10, 11]);
    expect(openStartHours(blocks, new Date('2026-07-20T00:00:00'))).toEqual([
      8, 9, 10, 11, 12, 13, 14, 15,
    ]);
  });
});
