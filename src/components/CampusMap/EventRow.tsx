import { MapPin } from 'lucide-react';
import { CATEGORY_EMOJI_SRC } from '../../data/eventCategories';
import { relativeDayLabel } from './eventHelpers';
import type { MapEvent } from '../../types/events';

// Shared list row for both the public Events tab (EventsList) and the
// organizer's own-events panel (MyEventsPanel). `subline` lets the caller
// override the default "day · time" line — e.g. MyEventsPanel shows a
// "goes live" countdown for scheduled events instead.
export function EventRow({
  event,
  locale,
  t,
  selected,
  onClick,
  subline,
}: {
  event: MapEvent;
  locale: string;
  t: (k: string) => string;
  selected: boolean;
  onClick: () => void;
  subline?: string;
}) {
  const day =
    subline ?? `${relativeDayLabel(event.date, locale, t)}${event.time ? ` · ${event.time}` : ''}`;
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-l-2 px-3 py-2 text-left transition-colors ${
        selected ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-base-200'
      }`}
    >
      {/* poster thumbnail; falls back to a neutral tile with the colour emoji */}
      <span className="h-[52px] w-[52px] flex-shrink-0 overflow-hidden rounded-lg">
        {event.imageUrl ? (
          <img src={event.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-base-200">
            <img src={CATEGORY_EMOJI_SRC[event.category]} alt="" className="h-7 w-7" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-base-content">
          {event.title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-base-content/60">{day}</span>
        {event.location && (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-base-content/60">
            <MapPin size={11} className="flex-shrink-0" />
            <span className="truncate">{event.location}</span>
          </span>
        )}
      </span>
    </button>
  );
}
