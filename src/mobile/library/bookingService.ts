import { fetchRoomBlocks } from './availability';
import { cancelBooking, type CancelOutcome } from './cancelBooking';
import { createBooking, type BookingWho } from './createBooking';
import { DAILY_CAP, freeHours, overCap } from './slots';
import type { BookingsHttp } from './bookingsBase';
import type { LibraryRoom } from '../../data/map/libraryRooms';
import type { CalendarCustomEvent } from '../../types/calendarTypes';

const pad = (n: number) => String(n).padStart(2, '0');
const compact = (day: string) => day.replaceAll('-', '');

/** How many library bookings this device already made for `day` (`YYYY-MM-DD`). */
export const bookedOn = (events: CalendarCustomEvent[], day: string): number =>
  events.filter((e) => e.libraryBooking && e.date === compact(day)).length;

export type BookResult =
  | { kind: 'ok'; event: CalendarCustomEvent }
  | { kind: 'cap'; cap: number }
  /** Gone between the list and the tap, or Bookings says someone has it. */
  | { kind: 'taken' }
  /** The re-check could not be made: nothing was booked. */
  | { kind: 'offline' }
  /** The create call got no answer. The booking may exist; never retried here. */
  | { kind: 'unknown' }
  | { kind: 'failed'; status: number };

export interface BookInput {
  http: BookingsHttp;
  room: LibraryRoom;
  /** The calendar block's title, already in the student's language. */
  title: string;
  day: string;
  hour: number;
  who: BookingWho;
  /** The device's calendar custom events, for the daily cap. */
  existing: CalendarCustomEvent[];
  now: Date;
}

/**
 * One booking, checked twice: the cap on the device, then the hour itself, read
 * fresh, because the list the student tapped from can be minutes old. Only then
 * is anything created.
 */
export async function bookRoom(i: BookInput): Promise<BookResult> {
  if (overCap(bookedOn(i.existing, i.day))) return { kind: 'cap', cap: DAILY_CAP };
  const next = new Date(`${i.day}T12:00:00`);
  next.setDate(next.getDate() + 1);
  const toDay = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
  const blocks = await fetchRoomBlocks(i.http, i.room.staffMemberId, i.day, toDay);
  if (blocks === null) return { kind: 'offline' };
  if (!freeHours(blocks, i.day, i.now).includes(i.hour)) return { kind: 'taken' };

  const start = `${i.day}T${pad(i.hour)}:00:00`;
  const end = `${i.day}T${pad(i.hour + 1)}:00:00`;
  const r = await createBooking(i.http, i.room, { start, end }, i.who);
  if (r.kind !== 'ok') return r;
  return {
    kind: 'ok',
    event: {
      id: `library:${r.appointmentId}`,
      title: i.title,
      date: compact(i.day),
      startTime: `${pad(i.hour)}:00`,
      endTime: `${pad(i.hour + 1)}:00`,
      room: i.room.nameCs,
      libraryBooking: { featureId: i.room.featureId, selfServiceId: r.selfServiceId },
    },
  };
}

/** Cancels the real booking behind a calendar block. The block itself is the caller's to remove. */
export async function cancelLibraryBlock(
  http: BookingsHttp,
  block: CalendarCustomEvent
): Promise<CancelOutcome> {
  const key = block.libraryBooking?.selfServiceId;
  if (!key) return { kind: 'failed', status: 0 };
  return cancelBooking(http, key);
}
