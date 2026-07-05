import { CalendarOff } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useEventsFacultySettings } from '../../hooks/useEventsFacultySettings';
import { ALL_SOCIETIES } from '../../data/societies';
import { readableTextColor } from '../../utils/readableTextColor';
import { filterEvents, weekSections } from './eventHelpers';
import { EventRow } from './EventRow';

// Body of the MapSidePanel "Events" tab: an All / My-faculty filter and the
// upcoming events grouped into "This week" / "Next week", soonest first. Rows
// open the bottom-left detail card (off-campus rows open it too but don't move
// the map).
export function EventsList() {
  const mode = useAppStore((s) => s.mapMode);
  const publicEvents = useAppStore((s) => s.mapEvents);
  const societyEvents = useAppStore((s) => s.societyMapEvents);
  // MapSidePanel renders MyEventsPanel in society mode, so this list is student-only
  // in practice; the mode check keeps the source correct if that ever changes.
  const events = mode === 'society' ? societyEvents : publicEvents;
  const filter = useAppStore((s) => s.eventFilter);
  const setFilter = useAppStore((s) => s.setEventFilter);
  const selection = useAppStore((s) => s.mapSelection);
  const focusEvent = useAppStore((s) => s.focusEventById);
  const { subscribedFaculties } = useEventsFacultySettings();
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  const visible = filterEvents(events, filter);
  const sections = weekSections(visible);
  const selectedId = selection?.kind === 'event' ? selection.event.id : null;

  // Society filter chips: "All" first, then the societies with the student's own
  // faculty spolek (e.g. SU PEF for a PEF student) always leading. Stable sort
  // keeps the remaining societies in their catalog order.
  const homeFaculty = subscribedFaculties.find((k) => k !== 'mendelu');
  const societies = [...ALL_SOCIETIES].sort(
    (a, b) => (a.facultyKey === homeFaculty ? 0 : 1) - (b.facultyKey === homeFaculty ? 0 : 1),
  );
  const chipBase = 'btn btn-xs flex-shrink-0 whitespace-nowrap rounded-full';

  return (
    <div className="flex max-h-[60vh] flex-col">
      <div className="custom-scrollbar flex gap-1.5 overflow-x-auto px-2 py-2">
        {/* "Vše" keeps the brand primary; each society chip fills with its own
            brand colour when active, so the colour legend pays off here */}
        <button
          onClick={() => setFilter('all')}
          className={`${chipBase} ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
        >
          {t('map.allSocieties')}
        </button>
        {societies.map((s) => {
          const active = filter === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setFilter(s.id)}
              className={`${chipBase} ${active ? 'border-transparent' : 'btn-ghost'}`}
              style={active ? { backgroundColor: s.color, color: readableTextColor(s.color) } : undefined}
            >
              {s.shortName}
            </button>
          );
        })}
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
              <div className="border-l-2 border-transparent px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-base-content/60">
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
