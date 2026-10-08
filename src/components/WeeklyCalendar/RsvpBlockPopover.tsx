import { useEffect } from 'react';
import { X, Clock, MapPin, CalendarX } from 'lucide-react';
import type { CalendarCustomEvent } from '../../types/calendarTypes';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { popoverPosition, formatDateLabel } from '../../utils/calendarPopover';

const POPOVER_W = 300;
const POPOVER_H = 200;

/**
 * What clicking an answered society event does in the desktop calendar.
 *
 * It used to open `CustomEventModal`, as any custom block does, and both of
 * that modal's actions lied. The block is derived from the student's "Mám
 * zájem" (`planRsvpBlocks`), so deleting it lasted until the next
 * reconciliation put it back, and an edited time was overwritten with the
 * society's. So this shows the event read-only and offers the one removal that
 * holds: withdrawing the answer, which is what takes the block away.
 *
 * No "show on map": the desktop calendar has no path to the map at all, by a
 * recorded decision (`desktopHasNoShowOnMap.test.ts`).
 */
export function RsvpBlockPopover({
  event,
  anchor,
  onClose,
}: {
  event: CalendarCustomEvent;
  anchor?: { x: number; y: number };
  onClose: () => void;
}) {
  const { t, language } = useTranslation();
  const withdrawRsvpBlock = useAppStore((s) => s.withdrawRsvpBlock);
  const pos = anchor ? popoverPosition(anchor, POPOVER_W, POPOVER_H) : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const box = (
    <div
      role="dialog"
      aria-label={event.title}
      className="bg-base-100 border border-base-300 rounded-2xl shadow-2xl overflow-hidden"
      style={
        pos ? { position: 'fixed', ...pos, zIndex: 9999, width: POPOVER_W } : { width: '100%' }
      }
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-2 px-4 pt-3">
        <h3 className="min-w-0 flex-1 pt-1 text-lg font-medium leading-tight text-base-content">
          {event.title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-base-content"
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-2 px-4 pb-4 pt-2">
        <div className="flex items-center gap-2 text-sm text-base-content/70">
          <Clock size={14} className="shrink-0 text-base-content/40" />
          <span>
            {formatDateLabel(event.date, language)} · {event.startTime} – {event.endTime}
          </span>
        </div>
        {event.room && (
          <div className="flex items-center gap-2 text-sm text-base-content/70">
            <MapPin size={14} className="shrink-0 text-base-content/40" />
            <span className="min-w-0 truncate">{event.room}</span>
          </div>
        )}

        <p className="pt-1 text-xs text-base-content/70">{t('rsvpBlock.note')}</p>
        <button
          type="button"
          onClick={() => {
            void withdrawRsvpBlock(event.id);
            onClose();
          }}
          // The glyph carries the red, not the label: text-error on these
          // surfaces fails AA in both themes (verify:ui, 3.4–3.5:1).
          className="btn btn-sm w-full gap-1.5"
        >
          <CalendarX size={14} className="text-error" /> {t('rsvpBlock.remove')}
        </button>
      </div>
    </div>
  );

  if (pos) {
    return (
      <>
        <div className="fixed inset-0 z-[9998]" onClick={onClose} />
        {box}
      </>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div className="max-w-xs w-full mx-4">{box}</div>
    </div>
  );
}
