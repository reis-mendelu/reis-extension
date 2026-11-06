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

import { bookAndRecord, cancelAndRemove } from '../bookingActions';
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
    const r = await bookAndRecord({ http: h, room, day: '2026-11-10', hour: 15, lang: 'cz', now });
    expect(r.kind).toBe('ok');
    const events = useAppStore.getState().customEvents;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: 'Studovna – Individuální studovna 1',
      libraryBooking: { selfServiceId: 'S1' },
    });
    expect(
      useLibraryStore.getState().blocks[room.featureId]?.some((b) => b.status === 'busy')
    ).toBe(true);
  });

  it('adds nothing when the hour is taken', async () => {
    const h = http({ status: 400, data: { message: 'Staff not available' } });
    const r = await bookAndRecord({ http: h, room, day: '2026-11-10', hour: 15, lang: 'en', now });
    expect(r.kind).toBe('taken');
    expect(useAppStore.getState().customEvents).toHaveLength(0);
  });
});

describe('cancelAndRemove', () => {
  const block = {
    id: 'library:A1',
    title: 't',
    date: '20261110',
    startTime: '15:00',
    endTime: '16:00',
    libraryBooking: { featureId: room.featureId, selfServiceId: 'S1' },
  };
  it('removes the block once the booking is cancelled', async () => {
    useAppStore.setState({ customEvents: [block] });
    const r = await cancelAndRemove('library:A1', http({ status: 200, data: {} }));
    expect(r.kind).toBe('ok');
    expect(useAppStore.getState().customEvents).toHaveLength(0);
  });
  it('keeps the block when the cancel failed', async () => {
    useAppStore.setState({ customEvents: [block] });
    const r = await cancelAndRemove('library:A1', http({ status: 500, data: {} }));
    expect(r.kind).toBe('failed');
    expect(useAppStore.getState().customEvents).toHaveLength(1);
  });
});
