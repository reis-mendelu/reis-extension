import { fetchRoomBlocks } from './availability';
import { cancelBooking } from './cancelBooking';
import { createBooking, type BookingWho } from './createBooking';
import { DAILY_CAP, freeHours } from './slots';
import type { BookingsHttp } from './bookingsBase';
import type { LibraryRoom } from '../../data/map/libraryRooms';
import type { CalendarCustomEvent } from '../../types/calendarTypes';
import { hoursOf, libraryRoomOf, type OwnBooking } from './ownBooking';

const pad = (n: number) => String(n).padStart(2, '0');
const compact = (day: string) => day.replaceAll('-', '');

/** How many library HOURS this device already booked for `day` (`YYYY-MM-DD`). */
export const bookedOn = (events: OwnBooking[], day: string): number =>
  events
    .filter((e) => libraryRoomOf(e) !== null && e.date === compact(day))
    .reduce((n, e) => n + hoursOf(e), 0);

/** Why part of a stretch did not go through. */
type Stop = 'taken' | 'unknown' | 'failed';

export type BookResult =
  /** Every hour booked, with its cancel key. */
  | { kind: 'ok'; events: CalendarCustomEvent[] }
  /** Some hours booked, the rest not: `events` holds what was. */
  | { kind: 'partial'; events: CalendarCustomEvent[]; stopped: Stop }
  /**
   * The library never answered for some hours, and a fresh read shows them
   * taken: almost certainly ours. They go in the calendar without a cancel key
   * rather than vanish, which is what happened on the first real booking
   * (2026-11-16): a booking in the library, an e-mail, nothing in reIS.
   */
  | { kind: 'unconfirmed'; events: CalendarCustomEvent[] }
  | { kind: 'cap'; cap: number; left: number }
  /** Another booking or cancel is still running on this device: nothing was sent. */
  | { kind: 'busy' }
  /** Gone between the list and the tap, or Bookings says someone has it. */
  | { kind: 'taken' }
  /** The re-check could not be made: nothing was booked. */
  | { kind: 'offline' }
  /** The create call got no answer and nothing shows it took. Never retried here. */
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

const nextDayOf = (day: string) => {
  const next = new Date(`${day}T12:00:00`);
  next.setDate(next.getDate() + 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
};

/** One hour's outcome: booked (with its keys), likely ours (no answer, now taken), or not. */
type HourOutcome =
  | { hour: number; kind: 'ok'; appointmentId: string; selfServiceId: string }
  | { hour: number; kind: 'likely' }
  | { hour: number; kind: Stop; status?: number };

/**
 * A stretch of hours in one room. Checked twice first: the cap on the device,
 * then every hour, read fresh, because the list the student picked from can be
 * minutes old. Then every hour is created at once (each library service is one
 * hour long, and the service takes 10–40 s to answer, so one after another made
 * three hours take two minutes). Whatever was booked is kept and recorded,
 * never dropped: an hour with no answer is read again, and if it is now taken
 * it is recorded too, without a cancel key.
 */
export async function bookHours(i: BookInput): Promise<BookResult> {
  const hours = Array.from({ length: i.to - i.from }, (_, k) => i.from + k);
  const left = DAILY_CAP - bookedOn(i.existing, i.day);
  if (hours.length > left) return { kind: 'cap', cap: DAILY_CAP, left: Math.max(0, left) };
  const blocks = await fetchRoomBlocks(i.http, i.room.staffMemberId, i.day, nextDayOf(i.day));
  if (blocks === null) return { kind: 'offline' };
  const free = freeHours(blocks, i.day, i.now);
  if (!hours.every((h) => free.includes(h))) return { kind: 'taken' };

  const results: HourOutcome[] = await Promise.all(
    hours.map(async (hour): Promise<HourOutcome> => {
      const r = await createBooking(
        i.http,
        i.room,
        { start: `${i.day}T${pad(hour)}:00:00`, end: `${i.day}T${pad(hour + 1)}:00:00` },
        i.who
      );
      return r.kind === 'ok'
        ? { hour, ...r }
        : { hour, kind: r.kind, status: 'status' in r ? r.status : undefined };
    })
  );
  if (results.some((r) => r.kind === 'unknown')) {
    const after = await fetchRoomBlocks(i.http, i.room.staffMemberId, i.day, nextDayOf(i.day));
    const stillFree = after ? freeHours(after, i.day, i.now) : null;
    for (const [k, r] of results.entries())
      if (r.kind === 'unknown' && stillFree && !stillFree.includes(r.hour))
        results[k] = { hour: r.hour, kind: 'likely' };
  }

  const events = blocksOf(i, results);
  const stops = results.filter((r) => r.kind !== 'ok' && r.kind !== 'likely');
  if (events.length === 0) {
    const s = stops[0]!;
    return s.kind === 'failed'
      ? { kind: 'failed', status: s.status ?? 0 }
      : { kind: s.kind as 'taken' | 'unknown' };
  }
  if (stops.length) return { kind: 'partial', events, stopped: stops[0]!.kind as Stop };
  if (results.some((r) => r.kind === 'likely')) return { kind: 'unconfirmed', events };
  return { kind: 'ok', events };
}

/** One calendar block per run of consecutive hours that are booked the same way. */
function blocksOf(i: BookInput, results: HourOutcome[]): CalendarCustomEvent[] {
  const out: CalendarCustomEvent[] = [];
  let run: HourOutcome[] = [];
  const flush = () => {
    if (!run.length) return;
    const first = run[0]!;
    const keys = run.flatMap((r) => (r.kind === 'ok' ? [r.selfServiceId] : []));
    const likely = first.kind === 'likely';
    out.push({
      id: `library:${first.kind === 'ok' ? first.appointmentId : `${i.room.featureId}-${i.day}-${first.hour}`}`,
      title: i.title,
      date: compact(i.day),
      startTime: `${pad(first.hour)}:00`,
      endTime: `${pad(first.hour + run.length)}:00`,
      room: i.room.nameCs,
      libraryBooking: {
        featureId: i.room.featureId,
        selfServiceIds: keys,
        ...(likely ? { unconfirmed: true } : {}),
      },
    });
    run = [];
  };
  for (const r of results) {
    const booked = r.kind === 'ok' || r.kind === 'likely';
    const prev = run[run.length - 1];
    if (!booked || (prev && (prev.kind !== r.kind || prev.hour + 1 !== r.hour))) flush();
    if (booked) run.push(r);
  }
  flush();
  return out;
}

export type BlockCancel =
  | { kind: 'ok'; left: [] }
  | { kind: 'busy'; left: [] }
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
