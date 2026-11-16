import { CircleCheck } from 'lucide-react';
import { useAppStore } from '../../../../../store/useAppStore';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { LIBRARY_ROOMS } from '../../../../../data/map/libraryRooms';
import { libraryRoomOf } from '../../../../../mobile/library/ownBooking';
import { openBooking } from './openLibrary';

/**
 * The student's own library bookings on the card's day, at the top: the
 * confirmation a booking used to lack (a toast nobody saw, Dominik on the
 * Pixel, 2026-11-16), and the way to cancel one without going to the calendar.
 */
export function MyBookings({ day }: { day: string }) {
  const { t, language } = useTranslation();
  const events = useAppStore((s) => s.customEvents);
  const compact = day.replaceAll('-', '');
  const mine = events
    .filter((e) => libraryRoomOf(e) !== null && e.date === compact)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (mine.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-base-content/60">
        {t('mobile.library.mine')}
      </h3>
      <ul className="space-y-1">
        {mine.map((e) => {
          const r = LIBRARY_ROOMS.find((x) => x.featureId === libraryRoomOf(e));
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => openBooking(e.id)}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-xl bg-success/10 px-3 text-left ring-1 ring-success/40"
              >
                <CircleCheck size={16} className="flex-shrink-0 text-success" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-base-content">
                  {r ? (language === 'cz' ? r.nameCs : r.nameEn) : e.room}
                </span>
                <span className="flex-shrink-0 text-[13px] tabular-nums text-base-content/80">
                  {e.startTime}–{e.endTime}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
