import { CalendarOff } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useEventsFacultySettings } from '../../hooks/useEventsFacultySettings';
import { societyById } from '../../data/societies';
import { filterEvents, monthSections, parseEventDate } from './eventHelpers';
import type { MapEvent } from '../../types/events';

function EventRow({ event, locale, selected, onClick }: {
  event: MapEvent; locale: string; selected: boolean; onClick: () => void;
}) {
  const soc = societyById(event.societyId);
  const d = parseEventDate(event.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const offCampus = !event.coord;
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-base-200 ${selected ? 'bg-base-200' : ''}`}
    >
      <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: soc.color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-base-content">{event.title}</span>
        <span className="block truncate text-[11px] text-base-content/60">
          {d}{event.time ? ` · ${event.time}` : ''} · {soc.name}{event.location ? ` · ${event.location}` : ''}
        </span>
      </span>
      {offCampus && (
        <span className="badge badge-ghost badge-xs flex-shrink-0 self-center">off-campus</span>
      )}
    </button>
  );
}

// Body of the MapSidePanel "Events" tab: an All / My-faculty filter and the
// society events grouped by month, soonest first. Rows open the bottom-left
// detail card (off-campus rows open it too but don't move the map).
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
  const sections = monthSections(visible, locale);
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
            <div key={s.label}>
              <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-base-content/40">
                {s.label}
              </div>
              {s.events.map((e) => (
                <EventRow
                  key={e.id}
                  event={e}
                  locale={locale}
                  selected={e.id === selectedId}
                  onClick={() => focusEvent(e.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
