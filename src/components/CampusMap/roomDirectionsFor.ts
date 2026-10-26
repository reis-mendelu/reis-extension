import { map3dEnabled } from '../../data/map/buildingModels';
import { ROOM_ENTRANCES } from '../../data/map/roomEntrances';
import { roomDirections, type Step } from '../../utils/indoor/roomDirections';
import { roomLabel } from './mapHelpers';
import type { MapSelection, RoomsCollection } from '../../types/campusMap';

/** A selected room's directions, as the card shows them. */
export interface RoomDirectionsView {
  label: string;
  level: number;
  steps: Step[];
}

/**
 * The directions for the selected room, or null: not a room, a building the
 * directions do not cover yet, its plan not loaded, or no staircase serving its
 * floor. They ride the 3D flag — one switch for the new room view — so off,
 * every shell shows exactly what it showed before.
 */
export function directionsFor(
  sel: MapSelection | null,
  roomsByBuilding: Record<number, RoomsCollection>
): RoomDirectionsView | null {
  if (!map3dEnabled()) return null;
  const ref =
    sel?.kind === 'room'
      ? {
          building: sel.room.buildingId,
          id: sel.room.id,
          label: roomLabel(sel.room.name, sel.room.passportNumber, sel.room.nickname),
        }
      : sel?.kind === 'roomRef'
        ? {
            building: sel.entry.buildingId,
            id: sel.entry.placeId,
            label: roomLabel(sel.entry.name, sel.entry.code, sel.entry.nickname),
          }
        : null;
  if (!ref) return null;
  const entrance = ROOM_ENTRANCES[ref.building];
  const rooms = roomsByBuilding[ref.building]?.features;
  const target = rooms?.find((f) => f.properties.id === ref.id);
  const level = target?.properties.floorLevel;
  if (!entrance || !rooms || !target || level === null || level === undefined) return null;
  const steps = roomDirections(rooms, target, entrance);
  if (!steps) return null;
  // The last step names the room as the heading does (roomLabel), not by its raw plan name.
  return {
    label: ref.label,
    level,
    steps: steps.map((st) => (st.kind === 'arrive' ? { ...st, name: ref.label } : st)),
  };
}
