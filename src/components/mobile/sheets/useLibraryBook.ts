import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '../../../hooks/useTranslation';
import { useLibraryStore } from '../../../mobile/library/libraryStore';
import { LIBRARY_ROOMS } from '../../../data/map/libraryRooms';
import { bookAndRecord } from '../../../mobile/library/bookingActions';
import { logError } from '../../../utils/reportError';
import type { BookResult } from '../../../mobile/library/bookingService';

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

export interface LibraryPick {
  featureId: number;
  day: string;
  /** The stretch of hours, `to` exclusive. */
  from: number;
  to: number;
}

/**
 * Books one pick and says how it went. Shared by the confirm sheet (the first
 * booking, which shows what the library receives) and the card's own check button
 * (every later one). The button locks the moment it is pressed and stays locked
 * until the library has answered, so a second tap cannot book twice; a slow answer
 * is "unknown", never a retry.
 */
export function useLibraryBook(
  pick: LibraryPick,
  onDone: () => void,
  onSending?: (sending: boolean) => void
) {
  const { t, language } = useTranslation();
  const [sending, setSendingState] = useState(false);
  const room = LIBRARY_ROOMS.find((r) => r.featureId === pick.featureId);
  const name = room ? (language === 'cz' ? room.nameCs : room.nameEn) : '';
  const when = `${hh(pick.from)}–${hh(pick.to)}`;
  const setSending = (v: boolean) => {
    setSendingState(v);
    onSending?.(v);
  };

  const say = (r: BookResult) => {
    // Booked, but the phone could not keep it: it lasts only until a restart.
    if ('unsaved' in r && r.unsaved) {
      toast.error(t('mobile.library.unsaved'));
      return;
    }
    if (r.kind === 'ok') toast.success(t('mobile.library.booked', { room: name, time: when }));
    else if (r.kind === 'unconfirmed') toast.warning(t('mobile.library.unconfirmed'));
    else if (r.kind === 'partial')
      toast.warning(
        t('mobile.library.partial', {
          time: r.events.map((e) => `${e.startTime}–${e.endTime}`).join(', '),
        })
      );
    else if (r.kind === 'busy') toast.error(t('mobile.library.busy'));
    else if (r.kind === 'taken') toast.error(t('mobile.library.taken'));
    else if (r.kind === 'cap') toast.error(t('mobile.library.cap', { cap: r.cap }));
    else if (r.kind === 'offline') toast.error(t('mobile.library.checkFailed'));
    else if (r.kind === 'unknown') toast.error(t('mobile.library.unknown'));
    else toast.error(t('mobile.library.failed'));
  };

  const confirm = async () => {
    if (sending || !room) return;
    setSending(true);
    try {
      const r = await bookAndRecord({
        room,
        day: pick.day,
        from: pick.from,
        to: pick.to,
        lang: language,
      });
      // Kept in the device's diagnostic log, which the student may attach to a report.
      if (
        r.kind === 'failed' ||
        r.kind === 'unknown' ||
        r.kind === 'unconfirmed' ||
        r.kind === 'partial'
      )
        logError('Library.book', new Error(r.kind === 'failed' ? `status ${r.status}` : r.kind));
      say(r);
      // Booked: the pick is spent, and the card lists the booking at its top. The
      // student has now seen what the library receives, once.
      if (r.kind === 'ok' || r.kind === 'partial' || r.kind === 'unconfirmed') {
        useLibraryStore.getState().clearPick();
        useLibraryStore.getState().markNoticeSeen();
      }
    } catch (err) {
      logError('Library.book', err);
      toast.error(t('mobile.library.failed'));
    }
    setSending(false);
    onDone();
  };

  return { sending, confirm, room, name, when };
}
