import { useState } from 'react';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { LIBRARY_ROOMS } from '../../../data/map/libraryRooms';
import { bookAndRecord } from '../../../mobile/library/bookingActions';
import { logError } from '../../../utils/reportError';
import type { BookResult } from '../../../mobile/library/bookingService';

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/**
 * One hour in one room, confirmed. The same shape as the exam ConfirmSheet: a
 * summary of what will be booked, then the two buttons. The button locks the
 * moment it is pressed and the sheet stays until the library has answered, so a
 * second tap cannot book twice; a slow answer is "unknown", never a retry.
 */
export function LibraryBookSheet({
  sheet,
  onClose,
}: {
  sheet: { featureId: number; day: string; hour: number };
  onClose: () => void;
}) {
  const { t, language } = useTranslation();
  const [sending, setSending] = useState(false);
  const room = LIBRARY_ROOMS.find((r) => r.featureId === sheet.featureId);
  if (!room) return null;
  const name = language === 'cz' ? room.nameCs : room.nameEn;
  const when = `${hh(sheet.hour)}–${hh(sheet.hour + 1)}`;
  const date = new Date(`${sheet.day}T12:00:00`).toLocaleDateString(
    language === 'cz' ? 'cs' : 'en',
    { weekday: 'long', day: 'numeric', month: 'long' }
  );

  const say = (r: BookResult) => {
    if (r.kind === 'ok') toast.success(t('mobile.library.booked', { room: name, time: when }));
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
        day: sheet.day,
        hour: sheet.hour,
        lang: language,
      });
      if (r.kind === 'failed') logError('Library.book', new Error(`status ${r.status}`));
      say(r);
    } catch (err) {
      logError('Library.book', err);
      toast.error(t('mobile.library.failed'));
    }
    onClose();
  };

  return (
    <Sheet size="content" onClose={sending ? () => undefined : onClose} elevated>
      <SheetHeader title={t('mobile.library.confirmTitle')} onClose={onClose} />
      <div className="flex flex-col gap-3 px-4 pb-5">
        <p className="text-sm text-base-content/70">{t('mobile.library.confirmBody')}</p>
        <div className="flex flex-col gap-2 rounded-xl bg-base-200 p-3">
          <span className="text-md font-semibold text-base-content">{name}</span>
          <div className="flex flex-col gap-1.5 text-sm text-base-content/70">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={13} className="text-base-content/60" />
              {date}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-base-content/60" />
              {when}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={13} className="text-base-content/60" />
              {t('mobile.library.title')}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="min-h-11 flex-1 rounded-xl border border-base-300 text-base font-semibold text-base-content/70"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={sending}
            className="btn btn-primary min-h-11 flex-1 rounded-xl text-base"
          >
            {sending ? t('mobile.library.sending') : t('mobile.library.confirm')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
