import { useState } from 'react';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
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
 * What will be booked, and the two buttons. The phone shows it in a sheet
 * (LibraryBookSheet), the iPad inside the map's side panel next to the hours it
 * came from. The button locks the moment it is pressed and stays locked until
 * the library has answered, so a second tap cannot book twice; a slow answer is
 * "unknown", never a retry.
 */
export function LibraryConfirm({
  pick,
  onClose,
  onSending,
}: {
  pick: LibraryPick;
  onClose: () => void;
  /** Told when the request starts, so a sheet around this cannot be swiped away mid-booking. */
  onSending?: (sending: boolean) => void;
}) {
  const { t, language } = useTranslation();
  const [sending, setSendingState] = useState(false);
  // Another booking or cancel from this device is still running.
  const writing = useLibraryStore((s) => s.writing);
  const setSending = (v: boolean) => {
    setSendingState(v);
    onSending?.(v);
  };
  const room = LIBRARY_ROOMS.find((r) => r.featureId === pick.featureId);
  if (!room) return null;
  const name = language === 'cz' ? room.nameCs : room.nameEn;
  const when = `${hh(pick.from)}–${hh(pick.to)}`;
  const date = new Date(`${pick.day}T12:00:00`).toLocaleDateString(
    language === 'cz' ? 'cs' : 'en',
    { weekday: 'long', day: 'numeric', month: 'long' }
  );

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
    if (sending) return;
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
      // Booked: the pick is spent, and the card lists the booking at its top.
      // The room stays chosen, so the map stays on it.
      if (r.kind === 'ok' || r.kind === 'partial' || r.kind === 'unconfirmed')
        useLibraryStore.getState().setPicked([]);
    } catch (err) {
      logError('Library.book', err);
      toast.error(t('mobile.library.failed'));
    }
    onClose();
  };

  return (
    <div data-testid="library-confirm" className="flex flex-col gap-3">
      <p className="text-sm text-base-content/70">{t('mobile.library.confirmBody')}</p>
      <div className="flex flex-col gap-1.5 rounded-xl bg-base-200 p-3 ring-1 ring-base-content/10">
        <span className="text-md font-semibold text-base-content">{name}</span>
        <span className="flex items-center gap-1.5 text-sm text-base-content/70">
          <CalendarDays size={13} aria-hidden="true" />
          {date}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-base-content/70">
          <Clock size={13} aria-hidden="true" />
          {when}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-base-content/70">
          <MapPin size={13} aria-hidden="true" />
          {t('mobile.library.place')}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          className="min-h-11 flex-1 rounded-xl border border-base-300 text-base font-semibold text-base-content/70"
        >
          {t('common.back')}
        </button>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={sending || writing}
          className="btn btn-primary min-h-11 flex-1 rounded-xl text-base"
        >
          {sending ? t('mobile.library.sending') : t('mobile.library.confirm')}
        </button>
      </div>
      {sending && (
        <p role="status" className="text-xs text-base-content/70">
          {t('mobile.library.slow')}
        </p>
      )}
    </div>
  );
}
