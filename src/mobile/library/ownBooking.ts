import { LIBRARY_ROOMS } from '../../data/map/libraryRooms';

/** The calendar fields a library booking keeps (a `CalendarCustomEvent`). */
export interface OwnBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  room?: string;
  libraryBooking?: { featureId: number };
}

/**
 * The library room of one of the student's calendar events, if it is a library
 * booking. Blocks saved before storage kept `libraryBooking` (2026-11-16) still
 * carry a `library:` id and the room's name, so they are recognised by those:
 * still real bookings that hold their hours and count toward the daily cap.
 */
export function libraryRoomOf(e: OwnBooking): number | null {
  if (e.libraryBooking) return e.libraryBooking.featureId;
  if (!e.id.startsWith('library:')) return null;
  const name = (e.room ?? '').trim();
  const r = LIBRARY_ROOMS.find(
    (x) => x.nameCs === name || x.nameEn === name || x.bookingsName === name
  );
  return r?.featureId ?? null;
}

/** The hours a booking holds. */
export const hoursOf = (e: OwnBooking): number =>
  Math.max(1, Number(e.endTime.slice(0, 2)) - Number(e.startTime.slice(0, 2)));
