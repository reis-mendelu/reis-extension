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

import { bookAndRecord, cancelAndRemove, extendBooking } from '../bookingActions';
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

describe('cancelAndRemove', () => {
  const block = {
    id: 'library:A1',
    title: 't',
    date: '20261110',
    startTime: '15:00',
    endTime: '16:00',
    libraryBooking: { featureId: room.featureId, selfServiceIds: ['S1'] },
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
  it('keeps only the hours it could not cancel, each with its own key and time', async () => {
    useAppStore.setState({
      customEvents: [
        {
          ...block,
          endTime: '17:00',
          libraryBooking: { featureId: room.featureId, selfServiceIds: ['S1', 'S2'] },
        },
      ],
    });
    let n = 0;
    const h: BookingsHttp = vi.fn(async () => ({ status: n++ === 0 ? 200 : 500, data: {} }));
    const r = await cancelAndRemove('library:A1', h);
    expect(r).toEqual({ kind: 'failed', status: 500, left: ['S2'] });
    // 15:00 was cancelled; 16:00 stays, as its own 16:00–17:00 block.
    expect(useAppStore.getState().customEvents).toEqual([
      expect.objectContaining({
        id: 'library:A1-16',
        startTime: '16:00',
        endTime: '17:00',
        libraryBooking: { featureId: room.featureId, selfServiceIds: ['S2'] },
      }),
    ]);
  });

  // Every key that still holds an hour at the library must be saved at every
  // step: the app can be closed between two writes.
  const logWrites = () => {
    const log: string[] = [];
    const s = useAppStore.getState();
    useAppStore.setState({
      addCalendarCustomEvent: async (e) => {
        log.push(`add ${e.id}`);
        await s.addCalendarCustomEvent(e);
      },
      updateCalendarCustomEvent: async (id, patch) => {
        log.push(`update ${id}`);
        await s.updateCalendarCustomEvent(id, patch);
      },
      removeCalendarCustomEvent: async (id) => {
        log.push(`remove ${id}`);
        await s.removeCalendarCustomEvent(id);
      },
    });
    return log;
  };
  const twoHours = {
    ...block,
    endTime: '17:00',
    libraryBooking: { featureId: room.featureId, selfServiceIds: ['S1', 'S2'] },
  };
  it('saves the hours it keeps before it drops the original block', async () => {
    useAppStore.setState({ customEvents: [twoHours] });
    const log = logWrites();
    let n = 0;
    await cancelAndRemove(
      'library:A1',
      vi.fn(async () => ({ status: n++ === 0 ? 200 : 500, data: {} }))
    );
    expect(log).toEqual(['add library:A1-16', 'remove library:A1']);
  });
  it('rewrites the original block in place when its first hour is kept', async () => {
    useAppStore.setState({ customEvents: [twoHours] });
    const log = logWrites();
    let n = 0;
    await cancelAndRemove(
      'library:A1',
      vi.fn(async () => ({ status: n++ === 0 ? 500 : 200, data: {} }))
    );
    expect(log).toEqual(['update library:A1']);
    expect(useAppStore.getState().customEvents).toEqual([
      expect.objectContaining({
        id: 'library:A1',
        startTime: '15:00',
        endTime: '16:00',
        libraryBooking: { featureId: room.featureId, selfServiceIds: ['S1'] },
      }),
    ]);
  });

  it('shrinks the original only after the later hours are saved', async () => {
    useAppStore.setState({
      customEvents: [
        {
          ...block,
          endTime: '18:00',
          libraryBooking: { featureId: room.featureId, selfServiceIds: ['S1', 'S2', 'S3'] },
        },
      ],
    });
    const log = logWrites();
    let n = 0;
    // 15:00 fails, 16:00 is cancelled, 17:00 fails.
    await cancelAndRemove(
      'library:A1',
      vi.fn(async () => ({ status: n++ === 1 ? 200 : 500, data: {} }))
    );
    expect(log).toEqual(['add library:A1-17', 'update library:A1']);
    expect(
      useAppStore
        .getState()
        .customEvents.map((e) => e.id)
        .sort()
    ).toEqual(['library:A1', 'library:A1-17']);
  });

  it('frees the cancelled hours for booking again, and reads afresh next time', async () => {
    useAppStore.setState({ customEvents: [block] });
    useLibraryStore.setState({
      blocks: {
        [room.featureId]: [
          { status: 'free', start: '2026-11-10T07:00', end: '2026-11-10T19:00' },
          { status: 'busy', start: '2026-11-10T15:00', end: '2026-11-10T16:00' },
        ],
      },
      fetchedAt: 1,
    });
    await cancelAndRemove('library:A1', http({ status: 200, data: {} }));
    expect(useLibraryStore.getState().blocks[room.featureId]).toHaveLength(1);
    expect(useLibraryStore.getState().fetchedAt).toBeNull();
  });

  it('refuses a second write while one is running', async () => {
    useAppStore.setState({ customEvents: [block] });
    useLibraryStore.setState({ writing: true });
    expect((await cancelAndRemove('library:A1', http({ status: 200, data: {} }))).kind).toBe(
      'busy'
    );
    expect(
      (
        await bookAndRecord({
          http: http({ status: 200, data: {} }),
          room,
          day: '2026-11-10',
          from: 15,
          to: 16,
          lang: 'cz',
          now,
        })
      ).kind
    ).toBe('busy');
    useLibraryStore.setState({ writing: false });
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
