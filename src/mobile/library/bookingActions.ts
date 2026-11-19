import { useAppStore } from '../../store/useAppStore';
import { translate } from '../../i18n/translate';
import { getUserParams } from '../../utils/userParams';
import { bookHours, cancelLibraryBlock, type BlockCancel, type BookResult } from './bookingService';
import { useLibraryStore } from './libraryStore';
import { nativeBookingsHttp } from './transport';
import type { BookingsHttp } from './bookingsBase';
import { LIBRARY_ROOMS, type LibraryRoom } from '../../data/map/libraryRooms';
import { logError } from '../../utils/reportError';

export interface BookAction {
  room: LibraryRoom;
  day: string;
  /** The stretch of hours, `to` exclusive. */
  from: number;
  to: number;
  lang: 'cz' | 'en';
  http?: BookingsHttp;
  now?: Date;
}

/**
 * Books a stretch of hours as the signed-in student and puts what was booked in
 * their calendar (also when only the first hours went through), taking those
 * hours off the list.
 *
 * The faculty answer is the short code ("PEF") and the e-mail is IS's own, with
 * the xlogin address as the fallback every MENDELU account has.
 */
export async function bookAndRecord(a: BookAction): Promise<BookResult> {
  const lib = useLibraryStore.getState();
  if (!lib.startWrite()) return { kind: 'busy' };
  try {
    return await bookUnlocked(a);
  } finally {
    useLibraryStore.getState().endWrite();
  }
}

async function bookUnlocked(a: BookAction): Promise<BookResult> {
  const me = await getUserParams();
  const email = me?.email || (me?.username ? `${me.username}@mendelu.cz` : '');
  if (!me || !email) return { kind: 'failed', status: 0 };
  const app = useAppStore.getState();
  const r = await bookHours({
    http: a.http ?? nativeBookingsHttp,
    room: a.room,
    title: translate(a.lang, 'mobile.library.blockTitle', {
      room: a.lang === 'cz' ? a.room.nameCs : a.room.nameEn,
    }),
    day: a.day,
    from: a.from,
    to: a.to,
    who: {
      name: me.fullName,
      email,
      studentId: me.studentId,
      faculty: me.facultyLabel ?? '',
    },
    existing: app.customEvents,
    now: a.now ?? new Date(),
  });
  if (r.kind === 'ok' || r.kind === 'partial' || r.kind === 'unconfirmed') {
    let unsaved = 0;
    for (const e of r.events) {
      // One failed calendar write (storage quota) must not drop the hours
      // after it: each was booked and its cancel key belongs in the calendar.
      // A failure is counted and returned: the block is in memory but will not
      // survive a restart, so the student has to be told.
      try {
        await app.addCalendarCustomEvent(e);
      } catch (err) {
        unsaved++;
        logError('Library.record', err);
      }
      for (let h = Number(e.startTime.slice(0, 2)); h < Number(e.endTime.slice(0, 2)); h++)
        useLibraryStore.getState().markTaken(a.room.featureId, a.day, h);
    }
    if (unsaved > 0) return { ...r, unsaved };
  }
  return r;
}

/**
 * Cancels the real booking behind a calendar block, then drops the block. Hours
 * that could not be cancelled stay, each still tied to its own key: a key at
 * index i holds the hour startTime + i, so a block keeps exactly the hours it
 * can still cancel, split where a cancelled hour leaves a gap.
 */
export async function cancelAndRemove(
  eventId: string,
  http: BookingsHttp = nativeBookingsHttp
): Promise<BlockCancel> {
  const lib = useLibraryStore.getState();
  if (!lib.startWrite()) return { kind: 'busy', left: [] };
  try {
    const app = useAppStore.getState();
    const block = app.customEvents.find((e) => e.id === eventId);
    const lb = block?.libraryBooking;
    if (!block || !lb) return { kind: 'ok', left: [] };
    const r = await cancelLibraryBlock(http, block);
    const left: string[] = r.left;
    if (left.length === lb.selfServiceIds.length) return r;
    const start = Number(block.startTime.slice(0, 2));
    const day = `${block.date.slice(0, 4)}-${block.date.slice(4, 6)}-${block.date.slice(6, 8)}`;
    const hours = lb.selfServiceIds.map((key, i) => ({ key, hour: start + i }));
    const kept = hours.filter((h) => left.includes(h.key));
    // The new blocks are saved before the original goes, and a kept first hour
    // rewrites the original in one write: a key that still holds an hour at the
    // library is in storage at every step, even if the app closes in between.
    const parts = runsOf(kept).map((run) => ({
      first: run[0]!.hour,
      startTime: `${String(run[0]!.hour).padStart(2, '0')}:00`,
      endTime: `${String(run[0]!.hour + run.length).padStart(2, '0')}:00`,
      libraryBooking: { ...lb, selfServiceIds: run.map((h) => h.key) },
    }));
    for (const { first, ...part } of parts) {
      if (first === start) continue;
      // Saved by an earlier attempt that was closed before the original went,
      // and maybe extended since: never written over, or a newer key is lost.
      const id = `${block.id}-${first}`;
      const saved = useAppStore.getState().customEvents.find((e) => e.id === id);
      const keys = part.libraryBooking.selfServiceIds;
      if (saved && keys.every((k) => saved.libraryBooking?.selfServiceIds.includes(k))) continue;
      await app.addCalendarCustomEvent({
        ...block,
        ...part,
        id: saved ? `${id}-${Date.now()}` : id,
      });
    }
    const own = parts.find((p) => p.first === start);
    if (own) {
      const { first: _first, ...part } = own;
      await app.updateCalendarCustomEvent(block.id, part);
    } else await app.removeCalendarCustomEvent(eventId);
    useLibraryStore.getState().markFree(
      lb.featureId,
      day,
      hours.filter((h) => !left.includes(h.key)).map((h) => h.hour)
    );
    return r;
  } finally {
    useLibraryStore.getState().endWrite();
  }
}

/** Consecutive hours, grouped. */
function runsOf<T extends { hour: number }>(items: T[]): T[][] {
  const out: T[][] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last[last.length - 1]!.hour + 1 === it.hour) last.push(it);
    else out.push([it]);
  }
  return out;
}

/**
 * One more hour on the end of a booking, from its drawer. Booked like any
 * hour (re-checked fresh, the daily cap counted); when it goes through it is
 * folded into the same calendar block, so the block reads 17:00–19:00 rather
 * than two blocks side by side, and cancelling it cancels both hours. If the
 * original block is gone by then, the new hour keeps its own block and key.
 */
export async function extendBooking(
  eventId: string,
  lang: 'cz' | 'en',
  http?: BookingsHttp,
  now?: Date
): Promise<BookResult> {
  const block = useAppStore.getState().customEvents.find((e) => e.id === eventId);
  const lb = block?.libraryBooking;
  const room = LIBRARY_ROOMS.find((r) => r.featureId === lb?.featureId);
  if (!block || !lb || !room) return { kind: 'failed', status: 0 };
  const day = `${block.date.slice(0, 4)}-${block.date.slice(4, 6)}-${block.date.slice(6, 8)}`;
  const from = Number(block.endTime.slice(0, 2));
  if (!useLibraryStore.getState().startWrite()) return { kind: 'busy' };
  try {
    const r = await bookUnlocked({ room, day, from, to: from + 1, lang, http, now });
    const added = r.kind === 'ok' && r.events.length === 1 ? r.events[0]! : null;
    const app = useAppStore.getState();
    const current = app.customEvents.find((e) => e.id === eventId);
    const cur = current?.libraryBooking;
    if (added && current && cur && !cur.unconfirmed && current.endTime === block.endTime) {
      await app.updateCalendarCustomEvent(eventId, {
        endTime: added.endTime,
        libraryBooking: {
          ...cur,
          selfServiceIds: [...cur.selfServiceIds, ...(added.libraryBooking?.selfServiceIds ?? [])],
        },
      });
      await app.removeCalendarCustomEvent(added.id);
    }
    return r;
  } finally {
    useLibraryStore.getState().endWrite();
  }
}
