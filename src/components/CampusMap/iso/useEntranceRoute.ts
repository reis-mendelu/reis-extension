import { useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { roomDirectionsView, type RoomDirectionsView } from '../roomDirectionsFor';
import type { MapSelection, RoomProperties, RoomsCollection } from '../../../types/campusMap';

export interface EntranceRoute {
  /** The room that is picked, when the way to it can be offered: a door and a staircase are mapped. */
  pick: RoomProperties | null;
  /** The way from the entrance to the room the student asked it for, or null. */
  way: RoomDirectionsView | null;
}

const buildingOf = (sel: MapSelection | null) =>
  sel?.kind === 'room'
    ? sel.room.buildingId
    : sel?.kind === 'roomRef'
      ? sel.entry.buildingId
      : null;

/**
 * The entrance route of the open building. `pick` is the room picked now, where the way to it
 * can be offered (no door or no staircase mapped: null). `way` is the route the student asked for;
 * it outlives the selection, which a change of floor clears.
 */
export function useEntranceRoute(): EntranceRoute {
  const sel = useAppStore((s) => s.mapSelection);
  const asked = useAppStore((s) => s.isoRouteTo);
  const rooms = useAppStore((s) => s.roomsByBuilding);
  const open = useAppStore((s) => s.activeBuildingId);
  return useMemo(() => {
    const here = (c: RoomsCollection | undefined, view: RoomDirectionsView | null) =>
      c ? view : null;
    const offer = open !== null && buildingOf(sel) === open ? roomDirectionsView(sel, rooms) : null;
    const id =
      sel?.kind === 'room' ? sel.room.id : sel?.kind === 'roomRef' ? sel.entry.placeId : null;
    const pick =
      offer && id !== null
        ? ((sel?.kind === 'room'
            ? sel.room
            : rooms[open!]?.features.find((f) => f.properties.id === id)?.properties) ?? null)
        : null;
    const way =
      open !== null && asked && asked.buildingId === open
        ? here(rooms[open], roomDirectionsView({ kind: 'room', room: asked }, rooms))
        : null;
    return { pick, way };
  }, [sel, asked, rooms, open]);
}
