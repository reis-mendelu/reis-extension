import { useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { useAppStore } from '../../../../../store/useAppStore';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { useWideViewport } from '../../../../../hooks/ui/useWideViewport';
import { LIBRARY_ROOMS } from '../../../../../data/map/libraryRooms';
import { LibraryConfirm } from '../../../sheets/LibraryConfirm';

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/**
 * The rooms free for the picked hours, smallest first. A tap books that room:
 * the phone opens the confirm sheet, the iPad shows it right under the row; on
 * both the map closes in on the room, so the student sees where it is.
 */
export function FreeRooms({
  rooms,
  day,
  span,
  chosen,
}: {
  rooms: number[];
  day: string;
  span: { from: number; to: number };
  chosen: number | null;
}) {
  const { t, language } = useTranslation();
  const wide = useWideViewport();
  const pushSheet = useAppStore((s) => s.pushSheet);
  // The iPad's confirm opens under its row, often below the panel's fold.
  const confirmRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (wide && chosen !== null) confirmRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [wide, chosen]);
  const pick = (featureId: number) => {
    useAppStore.getState().selectMapLibrary(featureId);
    if (!wide) pushSheet({ kind: 'libraryBook', featureId, day, ...span });
  };
  return (
    <section>
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-base-content/60">
        {t('mobile.library.freeAt', { time: `${hh(span.from)}–${hh(span.to)}` })}
      </h3>
      <ul className="space-y-1">
        {rooms.map((id) => {
          const r = LIBRARY_ROOMS.find((x) => x.featureId === id)!;
          const open = wide && chosen === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => pick(id)}
                aria-expanded={wide ? open : undefined}
                className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl bg-base-100 px-3 text-left ring-1 ${
                  chosen === id ? 'ring-primary' : 'ring-base-content/10'
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-base-content">
                  {language === 'cz' ? r.nameCs : r.nameEn}
                </span>
                <span className="flex-shrink-0 text-[13px] text-base-content/70">
                  {r.seats === 1
                    ? t('mobile.library.seatsOne')
                    : t('mobile.library.seats', { n: r.seats })}
                </span>
                <ChevronRight
                  size={16}
                  className="flex-shrink-0 text-base-content/40"
                  aria-hidden="true"
                />
              </button>
              {open && (
                <div
                  ref={confirmRef}
                  className="mt-1 scroll-mb-4 rounded-2xl bg-base-100 p-3 ring-1 ring-primary/50"
                >
                  <LibraryConfirm
                    pick={{ featureId: id, day, ...span }}
                    onClose={() => useAppStore.getState().selectMapLibrary()}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
