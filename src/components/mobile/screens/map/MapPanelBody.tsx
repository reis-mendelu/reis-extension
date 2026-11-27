import { EventDetailCard } from '../../../CampusMap/EventDetailCard';
import { SocietyPinCard } from '../../../CampusMap/SocietyPinCard';
import { SportPlaceCard } from '../../../CampusMap/SportPlaceCard';
import { MapEventsSection } from '../../../CampusMap/MapEventsSection';
import { RoomDirections } from '../../../CampusMap/RoomDirections';
import { LibraryCard } from './library/LibraryCard';
import type { LibraryView } from './library/libraryOf';
import type { MapEvent } from '../../../../types/events';
import type { SocietyPin, SportPlace } from '../../../../types/campusMap';

export interface MapPanelBodyProps {
  selectedEvent: MapEvent | null;
  /** A society pin (`map_pins`), tapped on the map. Optional, as above. */
  selectedSocietyPin?: SocietyPin | null;
  /** A Sportera place, tapped on the map. Optional, as above. */
  selectedSportPlace?: SportPlace | null;
  /** The library's rooms, or one of them (`featureId`), on phone and iPad. */
  selectedLibrary?: LibraryView | null;
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
export function MapPanelBody({
  selectedEvent,
  selectedSocietyPin = null,
  selectedSportPlace = null,
  selectedLibrary = null,
  flush = false,
}: MapPanelBodyProps) {
  if (selectedEvent) {
    return (
      <div className={flush ? 'px-5' : 'px-4'}>
        <EventDetailCard event={selectedEvent} flush={flush} />
      </div>
    );
  }
  if (selectedLibrary) {
    return <LibraryCard view={selectedLibrary} flush={flush} />;
  }
  if (selectedSocietyPin) {
    return (
      <div className={flush ? 'px-5' : 'px-4'}>
        <SocietyPinCard pin={selectedSocietyPin} flush={flush} />
      </div>
    );
  }
  if (selectedSportPlace) {
    return (
      <div className={flush ? 'px-5' : 'px-4'}>
        <SportPlaceCard place={selectedSportPlace} flush={flush} />
      </div>
    );
  }
  // A room's directions sit above the events; RoomDirections renders nothing
  // when there are none.
  return (
    <>
      <div className={`${flush ? 'px-5' : 'px-4'} empty:hidden pb-3`}>
        <RoomDirections />
      </div>
      <MapEventsSection />
    </>
  );
}
