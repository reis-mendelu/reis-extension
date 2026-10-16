import type { MapEvent } from '../../types/events';
import type { RoomIndexEntry, RoomsCollection } from '../../types/campusMap';
import { lookupRoomEntry } from '../../utils/rooms/lookupRoom';
import { sortByDate, type VenueGroup } from './eventHelpers';
import { polygonCentroid } from './mapHelpers';

// polygonCentroid averages vertices, so GeoJSON's repeated closing vertex would
// pull the pin toward the ring's start.
function openRing(ring: number[][]): number[][] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  return ring.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]
    ? ring.slice(0, -1)
    : ring;
}

/**
 * The pins to draw while a building's floor view is open.
 *
 * Only events whose room belongs to THIS building. Each sits at its room when
 * the floor plan is in memory (an event's own coord is the building centre, so
 * it would land mid-plan on whatever room happens to be there); until the plan
 * loads it keeps that coord, so the pin never blinks out and back.
 *
 * A room on another floor than the one shown still gets its pin — hiding it is
 * the bug — but flagged, so the layer can draw it as "not on this floor".
 */
export function groupEventsInBuilding(
  events: MapEvent[],
  buildingId: number,
  floorId: number | null,
  rooms: RoomsCollection | undefined,
  index: RoomIndexEntry[]
): VenueGroup[] {
  const groups = new Map<number, VenueGroup>();
  for (const e of events) {
    const entry = e.roomCode ? lookupRoomEntry(e.roomCode, index) : null;
    if (!entry || entry.buildingId !== buildingId) continue;
    const ring = rooms?.features.find((f) => f.properties.id === entry.placeId)?.geometry
      .coordinates[0];
    const coord = ring?.length ? polygonCentroid(openRing(ring)) : e.coord;
    if (!coord) continue;
    const group = groups.get(entry.placeId);
    if (group) group.events.push(e);
    else
      groups.set(entry.placeId, {
        key: `room-${entry.placeId}`,
        coord,
        events: [e],
        floorLevel: entry.floorLevel,
        otherFloor: floorId !== null && entry.floorId !== floorId,
      });
  }
  for (const g of groups.values()) g.events = sortByDate(g.events);
  return [...groups.values()];
}
