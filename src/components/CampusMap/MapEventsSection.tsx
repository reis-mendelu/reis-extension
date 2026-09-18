import { CalendarOff } from 'lucide-react';
import { useVisibleMapEvents } from '../../hooks/useVisibleMapEvents';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { weekSections } from './eventHelpers';
import { EventRow } from './EventRow';

// The events tab body shared by the desktop MapSidePanel and the mobile map
// sheet's Akce tab: the upcoming events grouped into "This week" / "Next week",
// soonest first. Rows open the bottom-left detail card on desktop (off-campus
// rows open it too but don't move the map).
//
// No society filter. The chips left the phone first — nine of them above a list
// that is usually two or three events long — and the desktop row was the same
// control with more room rather than a better one. What made them worth
// deleting instead of hiding is that `eventFilter` PERSISTED in the shared
// store: a choice made on one surface went on narrowing another that had no
// control to clear it, which twice shipped as pins and rows disagreeing about
// what was on the map. A list two or three events long does not need a filter;
// it needs to be read.
export function MapEventsSection() {
  // This panel only ever renders on the student map — the admin console has its
  // own list — so the public feed is the only source, filtered to what this
  // student should be shown (a society can mark an event for its followers).
  const events = useVisibleMapEvents();
  const selection = useAppStore((s) => s.mapSelection);
  const focusEvent = useAppStore((s) => s.focusEventById);
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  const sections = weekSections(events);
  const selectedId = selection?.kind === 'event' ? selection.event.id : null;

  return (
    <div className="flex max-h-[60vh] flex-col">
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
