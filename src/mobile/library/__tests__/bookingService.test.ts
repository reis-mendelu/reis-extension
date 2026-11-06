import { describe, it, expect, vi } from 'vitest';
import { bookRoom, cancelLibraryBlock, bookedOn } from '../bookingService';
import type { BookingsHttp } from '../bookingsBase';
import type { CalendarCustomEvent } from '../../../types/calendarTypes';
import { LIBRARY_ROOMS } from '../../../data/map/libraryRooms';

const room = LIBRARY_ROOMS[0]!;
const who = {
  name: 'Jana Nováková',
  email: 'xnovak7@mendelu.cz',
  studentId: '123456',
  faculty: 'PEF',
};
const now = new Date(2026, 10, 10, 6, 0);
const DAY = '2026-11-10';

const freeAll = {
  staffAvailabilityResponse: [
    {
      availabilityItems: [
        {
          status: 'BOOKINGSAVAILABILITYSTATUS_AVAILABLE',
          startDateTime: { dateTime: `${DAY}T07:00:00` },
          endDateTime: { dateTime: `${DAY}T19:00:00` },
        },
      ],
    },
  ],
};
const created = { appointment: { id: 'A1', selfServiceAppointmentId: 'S1' } };

/** Availability answers `avail`, appointments answer `create`. */
function http(avail: { status: number; data: unknown }, create: { status: number; data: unknown }) {
  return vi.fn<BookingsHttp>(async (req) =>
    req.url.endsWith('GetStaffAvailability') ? avail : create
  );
}
const input = (h: BookingsHttp, existing: CalendarCustomEvent[] = []) => ({
  http: h,
  room,
  title: 'Knihovna · Individuální studovna 1',
  day: DAY,
  hour: 15,
  who,
  existing,
  now,
});

describe('bookRoom', () => {
  it('re-checks the hour, books it and returns the calendar block', async () => {
    const h = http({ status: 200, data: freeAll }, { status: 200, data: created });
    const r = await bookRoom(input(h));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.event).toMatchObject({
      date: '20261110',
      startTime: '15:00',
      endTime: '16:00',
      libraryBooking: { featureId: room.featureId, selfServiceId: 'S1' },
    });
    expect(h.mock.calls[1]![0].data).toBeTruthy();
  });

  it('does not book when the hour went meanwhile, and never asks Bookings to create', async () => {
    const busy = {
      staffAvailabilityResponse: [{ availabilityItems: [] }],
    };
    const h = http({ status: 200, data: busy }, { status: 200, data: created });
    expect((await bookRoom(input(h))).kind).toBe('taken');
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('says offline when availability cannot be read', async () => {
    const h = http({ status: 500, data: {} }, { status: 200, data: created });
    expect((await bookRoom(input(h))).kind).toBe('offline');
  });

  it('stops at four bookings that day, without a request', async () => {
    const mine = (n: number): CalendarCustomEvent => ({
      id: `library:${n}`,
      title: 't',
      date: '20261110',
      startTime: '08:00',
      endTime: '09:00',
      libraryBooking: { featureId: 1, selfServiceId: String(n) },
    });
    const h = http({ status: 200, data: freeAll }, { status: 200, data: created });
    const r = await bookRoom(input(h, [mine(1), mine(2), mine(3), mine(4)]));
    expect(r.kind).toBe('cap');
    expect(h).not.toHaveBeenCalled();
  });

  it('passes taken, unknown and failed through', async () => {
    const taken = http(
      { status: 200, data: freeAll },
      { status: 400, data: { message: 'Staff not available' } }
    );
    expect((await bookRoom(input(taken))).kind).toBe('taken');
    const lost = vi.fn<BookingsHttp>(async (req) => {
      if (req.url.endsWith('GetStaffAvailability')) return { status: 200, data: freeAll };
      throw new Error('timeout');
    });
    expect((await bookRoom(input(lost))).kind).toBe('unknown');
    const bad = http({ status: 200, data: freeAll }, { status: 500, data: {} });
    expect((await bookRoom(input(bad))).kind).toBe('failed');
  });
});

describe('bookedOn', () => {
  it('counts only library blocks of that day', () => {
    const e = (id: string, date: string, lib: boolean): CalendarCustomEvent => ({
      id,
      title: 't',
      date,
      startTime: '08:00',
      endTime: '09:00',
      ...(lib ? { libraryBooking: { featureId: 1, selfServiceId: id } } : {}),
    });
    expect(
      bookedOn([e('a', '20261110', true), e('b', '20261110', false), e('c', '20261111', true)], DAY)
    ).toBe(1);
  });
});

describe('cancelLibraryBlock', () => {
  const block: CalendarCustomEvent = {
    id: 'library:A1',
    title: 't',
    date: '20261110',
    startTime: '15:00',
    endTime: '16:00',
    libraryBooking: { featureId: 1, selfServiceId: 'S1' },
  };
  it('cancels the real booking by its key', async () => {
    const h = vi.fn<BookingsHttp>(async () => ({ status: 200, data: {} }));
    expect((await cancelLibraryBlock(h, block)).kind).toBe('ok');
    expect(h.mock.calls[0]![0].url.endsWith('/appointments/S1')).toBe(true);
  });
  it('treats gone as done and a failure as not cancelled', async () => {
    const gone = vi.fn<BookingsHttp>(async () => ({ status: 404, data: {} }));
    expect((await cancelLibraryBlock(gone, block)).kind).toBe('gone');
    const bad = vi.fn<BookingsHttp>(async () => ({ status: 500, data: {} }));
    expect((await cancelLibraryBlock(bad, block)).kind).toBe('failed');
  });
  it('refuses a block that is not a library booking', async () => {
    const h = vi.fn<BookingsHttp>();
    const r = await cancelLibraryBlock(h, { ...block, libraryBooking: undefined });
    expect(r.kind).toBe('failed');
    expect(h).not.toHaveBeenCalled();
  });
});
