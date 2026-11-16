import { describe, it, expect, vi } from 'vitest';
import { bookHours, cancelLibraryBlock, bookedOn } from '../bookingService';
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

const availability = (from: number, to: number) => ({
  status: 200,
  data: {
    staffAvailabilityResponse: [
      {
        availabilityItems: [
          {
            status: 'BOOKINGSAVAILABILITYSTATUS_AVAILABLE',
            startDateTime: { dateTime: `${DAY}T${String(from).padStart(2, '0')}:00:00` },
            endDateTime: { dateTime: `${DAY}T${String(to).padStart(2, '0')}:00:00` },
          },
        ],
      },
    ],
  },
});
const freeAll = availability(7, 19);
const created = (n: number) => ({
  status: 200,
  data: { appointment: { id: `A${n}`, selfServiceAppointmentId: `S${n}` } },
});

/** Availability answers `avail`; each create answers the next of `creates`. */
function http(
  avail: { status: number; data: unknown },
  ...creates: { status: number; data: unknown }[]
) {
  let i = 0;
  return vi.fn<BookingsHttp>(async (req) =>
    req.url.endsWith('GetStaffAvailability') ? avail : creates[Math.min(i++, creates.length - 1)]!
  );
}
const input = (h: BookingsHttp, from = 15, to = 16, existing: CalendarCustomEvent[] = []) => ({
  http: h,
  room,
  title: 'Studovna – Individuální 1',
  day: DAY,
  from,
  to,
  who,
  existing,
  now,
});
const creates = (h: ReturnType<typeof http>) =>
  h.mock.calls.filter(([r]) => r.url.endsWith('/appointments'));

describe('bookHours', () => {
  it('re-checks the hour, books it and returns the calendar block', async () => {
    const h = http(freeAll, created(1));
    const r = await bookHours(input(h));
    expect(r).toEqual({
      kind: 'ok',
      events: [
        {
          id: 'library:A1',
          title: 'Studovna – Individuální 1',
          date: '20261110',
          startTime: '15:00',
          endTime: '16:00',
          room: 'Individuální 1',
          libraryBooking: { featureId: room.featureId, selfServiceIds: ['S1'] },
        },
      ],
    });
  });

  it('books every hour of a stretch at once and records it as ONE block', async () => {
    const h = http(freeAll, created(1), created(2), created(3));
    const r = await bookHours(input(h, 14, 17));
    expect(creates(h)).toHaveLength(3);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.startTime).toBe('14:00');
    expect(r.events[0]!.endTime).toBe('17:00');
    expect(r.events[0]!.libraryBooking?.selfServiceIds).toEqual(['S1', 'S2', 'S3']);
  });

  it('keeps what was booked when an hour is lost, and says so', async () => {
    const h = http(freeAll, created(1), {
      status: 400,
      data: { error: { message: 'Staff not available' } },
    });
    const r = await bookHours(input(h, 14, 17));
    expect(creates(h)).toHaveLength(3);
    expect(r.kind).toBe('partial');
    if (r.kind !== 'partial') return;
    expect(r.events.map((e) => `${e.startTime}-${e.endTime}`)).toEqual(['14:00-15:00']);
    expect(r.events[0]!.libraryBooking?.selfServiceIds).toEqual(['S1']);
    expect(r.stopped).toBe('taken');
  });

  it('records an hour the library never answered for, once a fresh read shows it taken', async () => {
    // The first real booking (2026-11-16): made at the library, nothing in reIS.
    let reads = 0;
    const h = vi.fn<BookingsHttp>(async (req) => {
      if (req.url.endsWith('GetStaffAvailability'))
        return reads++ === 0 ? freeAll : availability(16, 19);
      throw new Error('timeout');
    });
    const r = await bookHours(input(h, 15, 16));
    expect(r.kind).toBe('unconfirmed');
    if (r.kind !== 'unconfirmed') return;
    expect(r.events[0]).toMatchObject({
      startTime: '15:00',
      endTime: '16:00',
      libraryBooking: { featureId: room.featureId, selfServiceIds: [], unconfirmed: true },
    });
  });

  it('reads a create answer that arrives as text', async () => {
    const h = http(freeAll, {
      status: 200,
      data: JSON.stringify({ appointment: { id: 'A9', selfServiceAppointmentId: 'S9' } }),
    });
    const r = await bookHours(input(h));
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.events[0]!.libraryBooking?.selfServiceIds).toEqual(['S9']);
  });

  it('does not book anything when one hour of the stretch went meanwhile', async () => {
    const h = http(availability(14, 16), created(1));
    expect((await bookHours(input(h, 14, 17))).kind).toBe('taken');
    expect(creates(h)).toHaveLength(0);
  });

  it('says offline when availability cannot be read', async () => {
    const h = http({ status: 500, data: {} }, created(1));
    expect((await bookHours(input(h))).kind).toBe('offline');
  });

  it('counts hours against the cap of four a day, without a request', async () => {
    const mine: CalendarCustomEvent = {
      id: 'library:x',
      title: 't',
      date: '20261110',
      startTime: '08:00',
      endTime: '11:00',
      libraryBooking: { featureId: 1, selfServiceIds: ['a', 'b', 'c'] },
    };
    const h = http(freeAll, created(1));
    expect(await bookHours(input(h, 15, 17, [mine]))).toEqual({ kind: 'cap', cap: 4, left: 1 });
    expect(h).not.toHaveBeenCalled();
    expect((await bookHours(input(h, 15, 16, [mine]))).kind).toBe('ok');
  });

  it('passes taken, unknown and failed through when nothing was booked', async () => {
    const taken = http(freeAll, {
      status: 400,
      data: { error: { message: 'Staff not available' } },
    });
    expect((await bookHours(input(taken))).kind).toBe('taken');
    const lost = vi.fn<BookingsHttp>(async (req) => {
      if (req.url.endsWith('GetStaffAvailability')) return freeAll;
      throw new Error('timeout');
    });
    expect((await bookHours(input(lost))).kind).toBe('unknown');
    const bad = http(freeAll, { status: 500, data: {} });
    expect((await bookHours(input(bad))).kind).toBe('failed');
  });
});

describe('bookedOn', () => {
  it('counts the booked hours of library blocks of that day', () => {
    const e = (id: string, date: string, ids: string[] | null): CalendarCustomEvent => ({
      id,
      title: 't',
      date,
      startTime: '10:00',
      endTime: ids ? `1${ids.length}:00` : '11:00',
      ...(ids ? { libraryBooking: { featureId: 1, selfServiceIds: ids } } : {}),
    });
    expect(
      bookedOn(
        [e('a', '20261110', ['1', '2']), e('b', '20261110', null), e('c', '20261111', ['3'])],
        DAY
      )
    ).toBe(2);
  });
});

describe('cancelLibraryBlock', () => {
  const block: CalendarCustomEvent = {
    id: 'library:A1',
    title: 't',
    date: '20261110',
    startTime: '15:00',
    endTime: '17:00',
    libraryBooking: { featureId: 1, selfServiceIds: ['S1', 'S2'] },
  };
  it('cancels every hour of the block by its key', async () => {
    const h = vi.fn<BookingsHttp>(async () => ({ status: 200, data: {} }));
    expect(await cancelLibraryBlock(h, block)).toEqual({ kind: 'ok', left: [] });
    expect(h.mock.calls.map(([r]) => r.url.split('/').pop())).toEqual(['S1', 'S2']);
  });
  it('treats gone as done and keeps the hours it could not cancel', async () => {
    const gone = vi.fn<BookingsHttp>(async () => ({ status: 404, data: {} }));
    expect((await cancelLibraryBlock(gone, block)).kind).toBe('ok');
    let n = 0;
    const half = vi.fn<BookingsHttp>(async () => ({ status: n++ === 0 ? 200 : 500, data: {} }));
    expect(await cancelLibraryBlock(half, block)).toEqual({
      kind: 'failed',
      status: 500,
      left: ['S2'],
    });
  });
  it('refuses a block that is not a library booking', async () => {
    const h = vi.fn<BookingsHttp>();
    const r = await cancelLibraryBlock(h, { ...block, libraryBooking: undefined });
    expect(r.kind).toBe('failed');
    expect(h).not.toHaveBeenCalled();
  });
});
