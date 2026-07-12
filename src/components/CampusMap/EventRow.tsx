import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { CATEGORY_EMOJI_SRC } from '../../data/eventCategories';
import { relativeDayLabel } from './eventHelpers';
import type { MapEvent } from '../../types/events';

// Shared list row for both the public Events tab (EventsList) and the
// organizer's own-events panel (MyEventsPanel). `subline` lets the caller
// override the default "day · time" line — e.g. MyEventsPanel shows a
// "goes live" countdown for scheduled events instead. `actions` renders
// row-level controls (edit/delete) as siblings of the clickable body: the
// body stays a single <button>, so the controls can't nest inside it.
export function EventRow({
  event,
  locale,
  t,
  selected,
  onClick,
  subline,
  actions,
}: {
  event: MapEvent;
  locale: string;
  t: (k: string) => string;
  selected: boolean;
  onClick: () => void;
  subline?: string;
  actions?: ReactNode;
}) {
  const day =
    subline ?? `${relativeDayLabel(event.date, locale, t)}${event.time ? ` · ${event.time}` : ''}`;
  return (
    <div
      className={`flex items-stretch border-l-2 transition-colors ${
        selected ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-base-200'
      }`}
    >
      <button
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
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
      {actions && <div className="flex flex-shrink-0 items-center gap-0.5 pr-1.5">{actions}</div>}
    </div>
  );
}
