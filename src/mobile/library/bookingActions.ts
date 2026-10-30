import { useAppStore } from '../../store/useAppStore';
import { translate } from '../../i18n/translate';
import { getUserParams } from '../../utils/userParams';
import { bookRoom, cancelLibraryBlock, type BookResult } from './bookingService';
import type { CancelOutcome } from './cancelBooking';
import { useLibraryStore } from './libraryStore';
import { nativeBookingsHttp } from './transport';
import type { BookingsHttp } from './bookingsBase';
import type { LibraryRoom } from '../../data/map/libraryRooms';

export interface BookAction {
  room: LibraryRoom;
  day: string;
  hour: number;
  lang: 'cz' | 'en';
  http?: BookingsHttp;
  now?: Date;
}

/**
 * Books a room as the signed-in student and, only when it worked, puts the block
 * in their calendar and takes the hour off the list.
 *
 * The faculty answer is the short code ("PEF") and the e-mail is IS's own, with
 * the xlogin address as the fallback every MENDELU account has.
 */
export async function bookAndRecord(a: BookAction): Promise<BookResult> {
  const me = await getUserParams();
  const email = me?.email || (me?.username ? `${me.username}@mendelu.cz` : '');
  if (!me || !email) return { kind: 'failed', status: 0 };
  const app = useAppStore.getState();
  const r = await bookRoom({
    http: a.http ?? nativeBookingsHttp,
    room: a.room,
    title: translate(a.lang, 'mobile.library.blockTitle', {
      room: a.lang === 'cz' ? a.room.nameCs : a.room.nameEn,
    }),
    day: a.day,
    hour: a.hour,
    who: {
      name: me.fullName,
      email,
      studentId: me.studentId,
      faculty: me.facultyLabel ?? '',
    },
    existing: app.customEvents,
    now: a.now ?? new Date(),
  });
  if (r.kind === 'ok') {
    await app.addCalendarCustomEvent(r.event);
    useLibraryStore.getState().markTaken(a.room.featureId, a.day, a.hour);
  }
  return r;
}

/** Cancels the real booking behind a calendar block, then drops the block. A failure keeps both. */
export async function cancelAndRemove(
  eventId: string,
  http: BookingsHttp = nativeBookingsHttp
): Promise<CancelOutcome> {
  const app = useAppStore.getState();
  const block = app.customEvents.find((e) => e.id === eventId);
  if (!block) return { kind: 'gone' };
  const r = await cancelLibraryBlock(http, block);
  if (r.kind === 'ok' || r.kind === 'gone') await app.removeCalendarCustomEvent(eventId);
  return r;
}
