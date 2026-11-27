import { vi } from 'vitest';
import { useAppStore } from '../../../store/useAppStore';
import { useLibraryStore } from '../libraryStore';
import type { BookingsHttp } from '../bookingsBase';
import { LIBRARY_ROOMS } from '../../../data/map/libraryRooms';
import { IndexedDBService } from '../../../services/storage/IndexedDBService';
import type { CalendarCustomEvent } from '../../../types/calendarTypes';

/** Shared by the cancel tests (bookingActions.cancel*.test.ts). */
export const room = LIBRARY_ROOMS[0]!;
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
export const http = (create: { status: number; data: unknown }): BookingsHttp =>
  vi.fn(async (req) =>
    req.url.endsWith('GetStaffAvailability') ? { status: 200, data: free } : create
  );
export const now = new Date(2026, 10, 10, 6, 0);

export const block: CalendarCustomEvent = {
  id: 'library:A1',
  title: 't',
  date: '20261110',
  startTime: '15:00',
  endTime: '16:00',
  libraryBooking: { featureId: room.featureId, selfServiceIds: ['S1'] },
};
export const twoHours: CalendarCustomEvent = {
  ...block,
  endTime: '17:00',
  libraryBooking: { featureId: room.featureId, selfServiceIds: ['S1', 'S2'] },
};

// The store's own calendar writes, captured before any test wraps them, so
// every test starts from the real ones whatever the one before it did.
const real = (() => {
  const s = useAppStore.getState();
  return {
    addCalendarCustomEvent: s.addCalendarCustomEvent,
    updateCalendarCustomEvent: s.updateCalendarCustomEvent,
    removeCalendarCustomEvent: s.removeCalendarCustomEvent,
    replaceCalendarCustomEvents: s.replaceCalendarCustomEvents,
  };
})();

/** For beforeEach: an empty calendar in memory and storage, the real writes, a fresh library. */
export async function resetCancelState(): Promise<void> {
  useAppStore.setState({ customEvents: [], ...real });
  await IndexedDBService.clear('custom_events');
  useLibraryStore.getState().reset();
}

/**
 * Every key that still holds an hour at the library must be saved at every
 * step: the app can be closed between two writes. So a cancel is ONE write,
 * a single IndexedDB transaction, never a sequence of them. This logs every
 * calendar write; the single-transaction one still goes through.
 */
export function logWrites(): string[] {
  const log: string[] = [];
  const note = (what: string) => async () => {
    log.push(what);
  };
  useAppStore.setState({
    addCalendarCustomEvent: note('add'),
    updateCalendarCustomEvent: note('update'),
    removeCalendarCustomEvent: note('remove'),
    replaceCalendarCustomEvents: async (put, drop) => {
      log.push(`replace put ${put.map((e) => e.id).join(',')} drop ${drop.join(',')}`);
      await real.replaceCalendarCustomEvents(put, drop);
    },
  });
  return log;
}

/** What IndexedDB holds, by id. */
export const stored = async (): Promise<CalendarCustomEvent[]> =>
  ((await IndexedDBService.getAllWithKeys('custom_events')) ?? [])
    .map((r) => r.value as CalendarCustomEvent)
    .sort((a, b) => a.id.localeCompare(b.id));

/** The same blocks in memory and in storage, as a real install has them. */
export async function seed(events: CalendarCustomEvent[]): Promise<void> {
  useAppStore.setState({ customEvents: events });
  for (const e of events) await IndexedDBService.set('custom_events', e.id, e);
}
