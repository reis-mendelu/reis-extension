import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../utils/userParams', () => ({
  getUserParams: vi.fn(async () => ({
    fullName: 'Jana Nováková',
    email: 'xnovak7@mendelu.cz',
    username: 'xnovak7',
    studentId: '123456',
    facultyLabel: 'PEF',
  })),
}));

vi.mock('../../../api/featureUsage', () => ({ trackFeatureSignal: vi.fn(async () => true) }));

import { trackFeatureSignal } from '../../../api/featureUsage';
import { bookAndRecord, extendBooking } from '../bookingActions';
import { useLibraryStore } from '../libraryStore';
import { useAppStore } from '../../../store/useAppStore';
import type { BookingsHttp } from '../bookingsBase';
import { LIBRARY_ROOMS } from '../../../data/map/libraryRooms';

const room = LIBRARY_ROOMS[0]!;
const free = {
  staffAvailabilityResponse: [
    {
      availabilityItems: [
        {
          status: 'BOOKINGSAVAILABILITYSTATUS_AVAILABLE',
          startDateTime: { dateTime: '2026-11-10T07:00:00' },
          endDateTime: { dateTime: '2026-11-10T19:00:00' },
        },
      ],
    },
  ],
};
const http = (create: { status: number; data: unknown }): BookingsHttp =>
  vi.fn(async (req) =>
    req.url.endsWith('GetStaffAvailability') ? { status: 200, data: free } : create
  );
const now = new Date(2026, 10, 10, 6, 0);

beforeEach(() => {
  vi.mocked(trackFeatureSignal).mockClear();
  useAppStore.setState({ customEvents: [] });
  useLibraryStore.getState().reset();
});

describe('bookAndRecord', () => {
  it('adds the calendar block and takes the hour off the list', async () => {
    useLibraryStore.setState({ blocks: { [room.featureId]: [] } });
    const h = http({
      status: 200,
      data: { appointment: { id: 'A1', selfServiceAppointmentId: 'S1' } },
    });
    const r = await bookAndRecord({
      http: h,
      room,
      day: '2026-11-10',
      from: 15,
      to: 16,
      lang: 'cz',
      now,
    });
    expect(r.kind).toBe('ok');
    const events = useAppStore.getState().customEvents;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: 'Studovna v knihovně',
      libraryBooking: { selfServiceIds: ['S1'] },
    });
    expect(
      useLibraryStore.getState().blocks[room.featureId]?.some((b) => b.status === 'busy')
    ).toBe(true);
  });

  it('adds nothing when the hour is taken', async () => {
    const h = http({ status: 400, data: { message: 'Staff not available' } });
    const r = await bookAndRecord({
      http: h,
      room,
      day: '2026-11-10',
      from: 15,
      to: 16,
      lang: 'en',
      now,
    });
    expect(r.kind).toBe('taken');
    expect(useAppStore.getState().customEvents).toHaveLength(0);
  });

  it('counts the install once a booking went through, and not a refused one', async () => {
    useLibraryStore.setState({ blocks: { [room.featureId]: [] } });
    const refused = http({ status: 400, data: { message: 'Staff not available' } });
    await bookAndRecord({
      http: refused,
      room,
      day: '2026-11-10',
      from: 15,
      to: 16,
      lang: 'cz',
      now,
    });
    expect(trackFeatureSignal).not.toHaveBeenCalled();
    const made = http({
      status: 200,
      data: { appointment: { id: 'A1', selfServiceAppointmentId: 'S1' } },
    });
    await bookAndRecord({ http: made, room, day: '2026-11-10', from: 15, to: 16, lang: 'cz', now });
    expect(trackFeatureSignal).toHaveBeenCalledExactlyOnceWith('library_booking_made');
  });
});

describe('bookAndRecord, a failed save', () => {
  it('says which booked blocks the phone could not save, and still records the rest', async () => {
    const h: BookingsHttp = vi.fn(async (req) =>
      req.url.endsWith('GetStaffAvailability')
        ? { status: 200, data: free }
        : { status: 200, data: { appointment: { id: 'A1', selfServiceAppointmentId: 'S1' } } }
    );
    const add = vi
      .spyOn(useAppStore.getState(), 'addCalendarCustomEvent')
      .mockRejectedValueOnce(new Error('quota'));
    const r = await bookAndRecord({
      http: h,
      room,
      day: '2026-11-10',
      from: 15,
      to: 16,
      lang: 'cz',
      now,
    });
    expect(r).toMatchObject({ kind: 'ok', unsaved: 1 });
    add.mockRestore();
  });
});

describe('extendBooking', () => {
  it('keeps the new hour as its own block if the booking was cancelled meanwhile', async () => {
    const orig = {
      id: 'library:A1',
      title: 't',
      date: '20261110',
      startTime: '15:00',
      endTime: '16:00',
      libraryBooking: { featureId: room.featureId, selfServiceIds: ['S1'] },
    };
    useAppStore.setState({ customEvents: [orig] });
    const h: BookingsHttp = vi.fn(async (req) => {
      if (req.url.endsWith('GetStaffAvailability')) return { status: 200, data: free };
      // The original disappears while the new hour is being booked.
      useAppStore.setState({ customEvents: [] });
      return { status: 200, data: { appointment: { id: 'A2', selfServiceAppointmentId: 'S2' } } };
    });
    expect((await extendBooking('library:A1', 'cz', h, now)).kind).toBe('ok');
    expect(useAppStore.getState().customEvents).toEqual([
      expect.objectContaining({ id: 'library:A2', startTime: '16:00', endTime: '17:00' }),
    ]);
  });

  it('books the next hour and folds it into the same block', async () => {
    useAppStore.setState({
      customEvents: [
        {
          id: 'library:A1',
          title: 't',
          date: '20261110',
          startTime: '15:00',
          endTime: '16:00',
          libraryBooking: { featureId: room.featureId, selfServiceIds: ['S1'] },
        },
      ],
    });
    const h = http({
      status: 200,
      data: { appointment: { id: 'A2', selfServiceAppointmentId: 'S2' } },
    });
    const r = await extendBooking('library:A1', 'cz', h, now);
    expect(r.kind).toBe('ok');
    const events = useAppStore.getState().customEvents;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'library:A1',
      startTime: '15:00',
      endTime: '17:00',
      libraryBooking: { selfServiceIds: ['S1', 'S2'] },
    });
  });
});
