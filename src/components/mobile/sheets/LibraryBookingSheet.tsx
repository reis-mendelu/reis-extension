import { useEffect, useMemo, useState } from 'react';
import { CircleCheck, MapPin, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';
import { LIBRARY_ROOMS } from '../../../data/map/libraryRooms';
import { useLibraryStore } from '../../../mobile/library/libraryStore';
import { extendBooking } from '../../../mobile/library/bookingActions';
import { canExtend } from '../../../mobile/library/libraryHours';
import { logError } from '../../../utils/reportError';
import { openLibrary } from '../screens/map/library/openLibrary';

/**
 * A library booking, opened from its calendar block or from "Máš rezervováno":
 * the subject drawer's shape (eyebrow, name, the place card with the way to
 * the map) so it reads like the rest of the app, and what can be done with it
 * one tap away: one more hour, another time or room, cancel (Dominik,
 * 2026-11-16, option A of the drawer mockups).
 */
export function LibraryBookingSheet({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const { t, language } = useTranslation();
  const block = useAppStore((s) => s.customEvents.find((e) => e.id === eventId));
  const events = useAppStore((s) => s.customEvents);
  const pushSheet = useAppStore((s) => s.pushSheet);
  const blocks = useLibraryStore((s) => s.blocks);
  const load = useLibraryStore((s) => s.load);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void load();
  }, [load]);
  // Cancelled (or removed) underneath: nothing left to show.
  useEffect(() => {
    if (!block) onClose();
  }, [block, onClose]);
  const lb = block?.libraryBooking;
  const room = LIBRARY_ROOMS.find((r) => r.featureId === lb?.featureId);
  const day = block
    ? `${block.date.slice(0, 4)}-${block.date.slice(4, 6)}-${block.date.slice(6, 8)}`
    : '';
  const keyless = !lb?.selfServiceIds.length;
  const next = useMemo(
    () => (block && lb && !keyless ? canExtend(blocks, events, block, new Date()) : null),
    [blocks, events, block, lb, keyless]
  );
  if (!block) return null;

  const name = room ? (language === 'cz' ? room.nameCs : room.nameEn) : block.room || block.title;
  const d = new Date(`${day}T00:00:00`);
  const wd = d.toLocaleDateString(language === 'cz' ? 'cs' : 'en', { weekday: 'short' });
  // "St 18. 11.": the place card's line has the map button beside it.
  const date = `${wd.charAt(0).toUpperCase()}${wd.slice(1).replace('.', '')} ${d.getDate()}. ${d.getMonth() + 1}.`;
  const toMap = (featureId?: number) => {
    useAppStore.getState().closeAllSheets();
    useAppStore.getState().setMobileTab('map');
    useLibraryStore.getState().setDay(day);
    openLibrary(featureId);
  };
  const extend = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await extendBooking(eventId, language);
      if (r.kind === 'ok')
        toast.success(
          t('mobile.library.extended', { time: `${String(next).padStart(2, '0')}:00` })
        );
      else if (r.kind === 'taken') toast.error(t('mobile.library.taken'));
      else if (r.kind === 'cap') toast.error(t('mobile.library.cap', { cap: r.cap }));
      else if (r.kind === 'unconfirmed') toast.warning(t('mobile.library.unconfirmed'));
      else toast.error(t('mobile.library.failed'));
    } catch (err) {
      logError('Library.extend', err);
      toast.error(t('mobile.library.failed'));
    }
    setBusy(false);
  };

  return (
    <Sheet size="full" variant="screen" onClose={onClose}>
      <SheetHeader
        eyebrow={t('mobile.library.title').toUpperCase()}
        title={name}
        onBack={onClose}
      />
      <div className="flex flex-col gap-2 px-4 pb-8">
        <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-base-100 py-2 pl-3 pr-2">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/15 text-[var(--tone-primary)]">
            <MapPin size={20} aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-md font-bold">{t('mobile.library.place')}</span>
            <span className="text-sm text-base-content/70">
              {date} · {block.startTime}–{block.endTime}
            </span>
          </div>
          <button
            type="button"
            onClick={() => toMap(room?.featureId)}
            className="flex min-h-11 flex-shrink-0 items-center whitespace-nowrap px-2 text-sm font-semibold text-[var(--tone-primary)]"
          >
            {t('mobile.library.onMap')}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-base-100 px-3 py-2.5 ring-1 ring-base-content/10">
          <span className="min-w-0 truncate text-sm text-base-content/80">
            {room &&
              `${room.seats === 1 ? t('mobile.library.seatsOne') : t('mobile.library.seats', { n: room.seats })} · ${t(
                room.kind === 'team' ? 'mobile.library.kindTeam' : 'mobile.library.kindIndividual'
              )}`}
          </span>
          {keyless ? (
            <span className="flex flex-shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-warning">
              <TriangleAlert size={14} aria-hidden /> {t('mobile.library.noKey')}
            </span>
          ) : (
            <span className="flex flex-shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-success">
              <CircleCheck size={14} aria-hidden /> {t('mobile.library.confirmed')}
            </span>
          )}
        </div>
        {keyless && (
          <p className="px-1 text-sm text-base-content/70">
            {t('mobile.library.cancelUnconfirmed')}
          </p>
        )}
        {next !== null && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void extend()}
            className="btn btn-primary min-h-12 rounded-xl"
          >
            {busy
              ? t('mobile.library.sending')
              : t('mobile.library.extend', { time: `${String(next).padStart(2, '0')}:00` })}
          </button>
        )}
        <button
          type="button"
          onClick={() => toMap()}
          className="btn min-h-12 rounded-xl border-0 bg-base-content/10"
        >
          {t('mobile.library.otherTime')}
        </button>
        <button
          type="button"
          onClick={() => pushSheet({ kind: 'libraryCancel', eventId })}
          className="btn btn-ghost mt-4 min-h-12 rounded-xl text-error ring-1 ring-error/40"
        >
          {keyless ? t('mobile.library.removeFromCalendar') : t('mobile.library.cancelAction')}
        </button>
      </div>
    </Sheet>
  );
}
