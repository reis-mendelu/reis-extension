import { EventDetailCard } from '../../../CampusMap/EventDetailCard';
import { MapEventsSection } from '../../../CampusMap/MapEventsSection';
import type { MapEvent } from '../../../../types/events';

export interface MapPanelBodyProps {
  selectedEvent: MapEvent | null;
  /** The rail frames its own content, so the card inside it renders flush. */
  flush?: boolean;
}

/**
 * What the map's panel shows — shared by the phone's sheet and the tablet's
 * rail, which differ only in the shell around it.
 *
 * Extracted when the rail stopped being a sheet with `md:` classes on it. The
 * two shells have genuinely different mechanics (detents and a vertical drag
 * versus open/closed and a horizontal one) and nothing in common but this, so
 * a single component doing both had grown a `isRail` ternary in every other
 * line.
 *
 * One event or the events list — there is no third thing and no tab to pick
 * between them any more. The Budova tab that used to live here listed the
 * building's room register (untranslated estate data: 88 rows of toilets,
 * kitchens and offices on Q's ground floor), and the map's own polygons and the
 * search bar are the two ways a student actually finds a room.
 */
export function MapPanelBody({ selectedEvent, flush = false }: MapPanelBodyProps) {
  if (selectedEvent) {
    return (
      <div className={flush ? 'px-5' : 'px-4'}>
        <EventDetailCard event={selectedEvent} flush={flush} />
      </div>
    );
  }
  return <MapEventsSection showFilter={false} />;
}
