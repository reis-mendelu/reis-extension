import { EventDetailCard } from '../../../CampusMap/EventDetailCard';
import { MapEventsSection } from '../../../CampusMap/MapEventsSection';
import { BuildingRoomList } from './BuildingRoomList';
import { useAppStore } from '../../../../store/useAppStore';
import type { MapSheetTab } from '../../../../store/types';
import type { MapEvent } from '../../../../types/events';

export interface MapPanelBodyProps {
  selectedEvent: MapEvent | null;
  activeTab: MapSheetTab;
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
 */
export function MapPanelBody({ selectedEvent, activeTab, flush = false }: MapPanelBodyProps) {
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);

  if (selectedEvent) {
    return (
      <div className={flush ? 'px-5' : 'px-4'}>
        <EventDetailCard event={selectedEvent} flush={flush} />
      </div>
    );
  }
  return (
    <>
      {activeTab === 'akce' && <MapEventsSection showFilter={false} />}
      {activeTab === 'budova' && activeBuildingId !== null && (
        <BuildingRoomList buildingId={activeBuildingId} />
      )}
    </>
  );
}
