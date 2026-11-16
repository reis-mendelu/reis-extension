import { fetchRoomBlocks } from './availability';
import { cancelBooking } from './cancelBooking';
import { createBooking, type BookingWho } from './createBooking';
import { DAILY_CAP, freeHours } from './slots';
import type { BookingsHttp } from './bookingsBase';
import type { LibraryRoom } from '../../data/map/libraryRooms';
import type { CalendarCustomEvent } from '../../types/calendarTypes';

const pad = (n: number) => String(n).padStart(2, '0');
const compact = (day: string) => day.replaceAll('-', '');

/** How many library HOURS this device already booked for `day` (`YYYY-MM-DD`). */
export const bookedOn = (events: CalendarCustomEvent[], day: string): number =>
  events
    .filter((e) => e.libraryBooking && e.date === compact(day))
    .reduce((n, e) => n + (e.libraryBooking?.selfServiceIds.length ?? 0), 0);

/** Why a stretch stopped before its end. */
type Stop = 'taken' | 'unknown' | 'failed';

export type BookResult =
  | { kind: 'ok'; event: CalendarCustomEvent }
  /** The first hours were booked, then one was not: `event` holds what was. */
  | { kind: 'partial'; event: CalendarCustomEvent; stopped: Stop }
  | { kind: 'cap'; cap: number; left: number }
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
  /** The stretch of whole hours, `to` exclusive. */
  from: number;
  to: number;
  who: BookingWho;
  /** The device's calendar custom events, for the daily cap. */
  existing: CalendarCustomEvent[];
  now: Date;
}

/**
 * A stretch of hours in one room, checked twice: the cap on the device, then
 * every hour itself, read fresh, because the list the student picked from can be
 * minutes old. Only then is anything created, one hour at a time, because each
 * of the library's services is an hour long. If an hour fails half-way the hours
 * already booked are kept and recorded, never silently dropped.
 */
export async function bookHours(i: BookInput): Promise<BookResult> {
  const hours = Array.from({ length: i.to - i.from }, (_, k) => i.from + k);
  const left = DAILY_CAP - bookedOn(i.existing, i.day);
  if (hours.length > left) return { kind: 'cap', cap: DAILY_CAP, left: Math.max(0, left) };
  const next = new Date(`${i.day}T12:00:00`);
  next.setDate(next.getDate() + 1);
  const toDay = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
  const blocks = await fetchRoomBlocks(i.http, i.room.staffMemberId, i.day, toDay);
  if (blocks === null) return { kind: 'offline' };
  const free = freeHours(blocks, i.day, i.now);
  if (!hours.every((h) => free.includes(h))) return { kind: 'taken' };

  const ids: { appointmentId: string; selfServiceId: string }[] = [];
  for (const h of hours) {
    const r = await createBooking(
      i.http,
      i.room,
      {
        start: `${i.day}T${pad(h)}:00:00`,
        end: `${i.day}T${pad(h + 1)}:00:00`,
      },
      i.who
    );
    if (r.kind === 'ok') {
      ids.push(r);
      continue;
    }
    if (ids.length === 0) return r;
    return { kind: 'partial', event: blockOf(i, ids), stopped: r.kind };
  }
  return { kind: 'ok', event: blockOf(i, ids) };
}

function blockOf(
  i: BookInput,
  ids: { appointmentId: string; selfServiceId: string }[]
): CalendarCustomEvent {
  return {
    id: `library:${ids[0]!.appointmentId}`,
    title: i.title,
    date: compact(i.day),
    startTime: `${pad(i.from)}:00`,
    endTime: `${pad(i.from + ids.length)}:00`,
    room: i.room.nameCs,
    libraryBooking: {
      featureId: i.room.featureId,
      selfServiceIds: ids.map((x) => x.selfServiceId),
    },
  };
}

export type BlockCancel =
  | { kind: 'ok'; left: [] }
  | { kind: 'unknown'; left: string[] }
  | { kind: 'failed'; status: number; left: string[] };

/**
 * Cancels every hour behind a calendar block. "Gone" counts as cancelled. What
 * could not be cancelled is returned in `left`, so the block keeps exactly the
 * keys that still hold a booking. The block itself is the caller's to change.
 */
export async function cancelLibraryBlock(
  http: BookingsHttp,
  block: CalendarCustomEvent
): Promise<BlockCancel> {
  const keys = block.libraryBooking?.selfServiceIds ?? [];
  if (keys.length === 0) return { kind: 'failed', status: 0, left: [] };
  const left: string[] = [];
  let worst: BlockCancel = { kind: 'ok', left: [] };
  for (const key of keys) {
    const r = await cancelBooking(http, key);
    if (r.kind === 'ok' || r.kind === 'gone') continue;
    left.push(key);
    if (worst.kind === 'ok')
      worst =
        r.kind === 'unknown'
          ? { kind: 'unknown', left }
          : { kind: 'failed', status: r.status, left };
  }
  return worst;
}
