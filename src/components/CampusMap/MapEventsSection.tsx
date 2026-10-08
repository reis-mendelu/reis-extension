import { CalendarOff, ChevronDown, ChevronRight } from 'lucide-react';
import { useVisibleMapEvents } from '../../hooks/useVisibleMapEvents';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { weekSections } from './eventHelpers';
import { EventRow } from './EventRow';
import { useSeenSignal } from '../../hooks/ui/useSeenSignal';
import { eventDirectLink } from './eventLinks';
import { resolveSociety } from '../../utils/societies/resolveSociety';
import { trackEventSignal } from '../../api/eventSignals';
import type { MapEvent } from '../../types/events';

// The events tab body shared by the desktop MapSidePanel and the mobile map
// sheet's Akce tab: the upcoming events grouped into This week / Next week /
// Later, soonest first, with Later collapsed by default (it holds the rest of
// the semester). Rows open the bottom-left detail card on desktop (off-campus
// rows open it too but don't move the map) — unless the card would add nothing
// to the row, and then the row is its link (eventDirectLink).
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
  const laterExpanded = useAppStore((s) => s.mapLaterExpanded);
  const societies = useAppStore((s) => s.societies);
  const toggleLater = useAppStore((s) => s.toggleMapLater);
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
              {s.key === 'later' ? (
                <button
                  type="button"
                  onClick={toggleLater}
                  aria-expanded={laterExpanded}
                  className="flex w-full items-center gap-1 border-l-2 border-transparent px-3 pb-1 pt-2 text-left text-[11px] font-bold uppercase tracking-wide text-base-content/60"
                >
                  {laterExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {t('map.later')} ({s.events.length})
                </button>
              ) : (
                <div className="border-l-2 border-transparent px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-base-content/60">
                  {t(`map.${s.key}`)}
                </div>
              )}
              {(s.key !== 'later' || laterExpanded) &&
                s.events.map((e) => {
                  const direct = eventDirectLink(e, resolveSociety(societies, e.societyId));
                  return (
                    <SeenEventRow
                      key={e.id}
                      event={e}
                      locale={locale}
                      t={t}
                      selected={e.id === selectedId}
                      href={direct?.href}
                      // A row that IS the link counts as Link, the number the
                      // card's button gives; it never opens, so never Opened.
                      onClick={() =>
                        direct
                          ? void trackEventSignal(e.id, 'link')
                          : focusEvent(e.id, { fly: true })
                      }
                    />
                  );
                })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** A student-list row that counts as Seen once on screen (spec 2026-10-08). */
function SeenEventRow(props: {
  event: MapEvent;
  locale: string;
  t: (k: string, p?: Record<string, string | number>) => string;
  selected: boolean;
  onClick: () => void;
  href?: string;
}) {
  return <EventRow {...props} seenRef={useSeenSignal<HTMLDivElement>(props.event.id)} />;
}
