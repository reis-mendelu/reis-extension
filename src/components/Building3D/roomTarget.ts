import { roomLabel } from '../CampusMap/mapHelpers';
import type { MapSelection } from '../../types/campusMap';

/** What the tilted map needs to know about the room it lights. */
export interface RoomTarget {
  buildingId: number;
  floorLevel: number | null;
  roomId: number | null;
  label: string;
}

/** From a map selection, when it is a room. */
export function targetFromSelection(sel: MapSelection | null): RoomTarget | null {
  if (sel?.kind === 'room') {
    const r = sel.room;
    return {
      buildingId: r.buildingId,
      floorLevel: r.floorLevel,
      roomId: r.id,
      label: roomLabel(r.name, r.passportNumber, r.nickname),
    };
  }
  if (sel?.kind === 'roomRef') {
    const e = sel.entry;
    return {
      buildingId: e.buildingId,
      floorLevel: e.floorLevel,
      roomId: e.placeId,
      label: roomLabel(e.name, e.code, e.nickname),
    };
  }
  return null;
}

/**
 * Where the tilted map cuts the building, and which room it lights: the floor
 * the floor column shows (tapped while tilted, it moves the cut), the room only
 * when it is on that floor of this building.
 */
export function cutTarget(
  target: RoomTarget | null,
  buildingId: number | null,
  floorLevel: number | null
): { level: number | null; room: RoomTarget | null } {
  const here = target !== null && target.buildingId === buildingId ? target : null;
  const level = floorLevel ?? here?.floorLevel ?? null;
  return { level, room: here && here.floorLevel === level ? here : null };
}

/** The scene a tilt started with, and whether it has been rebuilt since. */
export interface TiltEntry {
  key: string;
  moved: boolean;
}

/**
 * Track one stay in 3D: only its first scene glides in from the flat map; any
 * rebuild after that — a floor tap, even one back to the entry floor — appears
 * already tilted. Null while the map is flat.
 */
export function nextTiltEntry(
  prev: TiltEntry | null,
  tilted: boolean,
  key: string
): TiltEntry | null {
  if (!tilted) return null;
  if (!prev) return { key, moved: false };
  return prev.moved || prev.key === key ? prev : { ...prev, moved: true };
}
