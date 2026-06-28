import { CalendarOff, MapPin } from 'lucide-react';
import { CATEGORY_EMOJI_SRC } from '../../data/eventCategories';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useEventsFacultySettings } from '../../hooks/useEventsFacultySettings';
import { societyById } from '../../data/societies';
import { filterEvents, weekSections, relativeDayLabel } from './eventHelpers';
import type { MapEvent } from '../../types/events';

function EventRow({ event, locale, t, selected, onClick }: {
  event: MapEvent; locale: string; t: (k: string) => string; selected: boolean; onClick: () => void;
}) {
  const day = relativeDayLabel(event.date, locale, t);
  // "what it's about" reads from the title + a category cue; "where" from the
  // location. The society isn't shown — at launch there's only one, so it's noise.
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-base-200 ${selected ? 'bg-base-200' : ''}`}
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
        <span className="block truncate text-[13px] font-semibold text-base-content">{event.title}</span>
        <span className="mt-0.5 block truncate text-[11px] capitalize text-base-content/60">
          {day}{event.time ? ` · ${event.time}` : ''}
        </span>
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

// Body of the MapSidePanel "Events" tab: an All / My-faculty filter and the
// upcoming events grouped into "This week" / "Next week", soonest first. Rows
// open the bottom-left detail card (off-campus rows open it too but don't move
// the map).
export function EventsList() {
  const events = useAppStore((s) => s.mapEvents);
  const filter = useAppStore((s) => s.eventFilter);
  const setFilter = useAppStore((s) => s.setEventFilter);
  const selection = useAppStore((s) => s.mapSelection);
  const focusEvent = useAppStore((s) => s.focusEventById);
  const { subscribedFaculties } = useEventsFacultySettings();
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  const visible = filterEvents(events, filter, (id) => societyById(id).facultyKey, subscribedFaculties);
  const sections = weekSections(visible);
  const selectedId = selection?.kind === 'event' ? selection.event.id : null;

  return (
    <div className="flex max-h-[60vh] flex-col">
      <div className="flex gap-1.5 px-2 py-2">
        {(['all', 'faculty'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn btn-xs rounded-full ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
          >
            {f === 'all' ? t('map.allSocieties') : t('map.myFaculty')}
          </button>
        ))}
      </div>
      <div className="overflow-y-auto">
        {sections.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-4 py-8 text-center text-base-content/60">
            <CalendarOff size={28} className="opacity-40" />
            <p className="text-sm">{t('map.noEvents')}</p>
          </div>
        ) : (
          sections.map((s) => (
            <div key={s.key}>
              <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-base-content/40">
                {t(`map.${s.key}`)}
              </div>
              {s.events.map((e) => (
                <EventRow
                  key={e.id}
                  event={e}
                  locale={locale}
                  t={t}
                  selected={e.id === selectedId}
                  onClick={() => focusEvent(e.id, { fly: true })}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
