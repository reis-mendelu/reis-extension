/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { statusLabel } from '@/components/CampusMap/libraryStatus';
import type { RoomAvailability } from '@/types/library';

const room = { leadMinutes: 60 } as { leadMinutes: number };
const avail: RoomAvailability = {
  staffGuid: 'g',
  serviceId: 's',
  webUrl: 'u',
  leadMinutes: 60,
  blocks: [{ status: 'AVAILABLE', start: '2026-07-17T14:00:00', end: '2026-07-17T16:00:00' }],
};
const t = (k: string, o?: any) => (o?.time ? `${k}:${o.time}` : k);

describe('statusLabel', () => {
  it('reports the next same-day slot as free', () => {
    const r = statusLabel(room, avail, new Date('2026-07-17T11:00:00'), t as never, 'cs');
    expect(r.free).toBe(true);
    expect(r.text).toBe('map.libraryNextSlotToday:14:00');
  });
  it('reports fully booked when no slot fits', () => {
    const r = statusLabel(room, avail, new Date('2026-07-17T15:30:00'), t as never, 'cs');
    expect(r.free).toBe(false);
    expect(r.text).toBe('map.libraryFull');
  });
  it('reports unknown (not fully-booked) when availability is missing', () => {
    const r = statusLabel(room, undefined, new Date('2026-07-17T11:00:00'), t as never, 'cs');
    expect(r.known).toBe(false);
    expect(r.free).toBe(false);
  });
  it('marks known true (fully booked) when availability exists but no slot fits', () => {
    const r = statusLabel(room, avail, new Date('2026-07-17T15:30:00'), t as never, 'cs');
    expect(r.known).toBe(true);
    expect(r.free).toBe(false);
  });
  it('marks known true (free) when a slot fits', () => {
    const r = statusLabel(room, avail, new Date('2026-07-17T11:00:00'), t as never, 'cs');
    expect(r.known).toBe(true);
    expect(r.free).toBe(true);
  });
  it('maps the app-internal "cz" locale to Intl-valid "cs" for date/time formatting', () => {
    const r = statusLabel(room, avail, new Date('2026-07-17T11:00:00'), t as never, 'cz');
    expect(r.text).toBe('map.libraryNextSlotToday:14:00');
  });
});
