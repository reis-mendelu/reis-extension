import roomsIndexJson from '../../data/map/rooms-index.json';

const INDEX = roomsIndexJson as { code: string; floorLevel: number | null }[];

/**
 * The map's floor level of a venue's IS room (BZ00N1015 → 0), or null when the
 * room is not on a floor plan. The room code's own digits do not say it: budova
 * Z's BZ00N rooms sit on four levels. The index is the store's already
 * (createMapSlice), so this costs no extra bundle.
 */
export function venueFloorLevel(roomCode: string | null): number | null {
  if (!roomCode) return null;
  return INDEX.find((e) => e.code === roomCode)?.floorLevel ?? null;
}
