import { CalendarDays, Clock, MapPin } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useLibraryStore } from '../../../mobile/library/libraryStore';
import { useLibraryBook, type LibraryPick } from './useLibraryBook';

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
  // Another booking or cancel from this device is still running.
  const writing = useLibraryStore((s) => s.writing);
  const { sending, confirm, room, name, when } = useLibraryBook(pick, onClose, onSending);
  if (!room) return null;
  const date = new Date(`${pick.day}T12:00:00`).toLocaleDateString(
    language === 'cz' ? 'cs' : 'en',
    { weekday: 'long', day: 'numeric', month: 'long' }
  );

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
