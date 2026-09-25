import isRoomPlacesJson from '../../data/map/isRoomPlaces.json';
import type { RoomIndexEntry } from '../../types/campusMap';
import { isNonPhysicalRoom, lookupRoomEntry, normalizeRoomKey } from './lookupRoom';

/**
 * Where a room is when the map has no floor plan for it.
 *
 * The MENDELU map draws rooms in seven buildings. Everything else — buildings
 * D, T, J, P… on Černá Pole, the FRRMS building at Černá Pole II, the Lednice
 * campus, CSA — is a building or a campus the map CAN show, just not a room in
 * it. reis-data pairs each IS room with that place (`placeIsRooms.mjs`, from
 * IS's public room catalogue) and ships `isRoomPlaces.json`.
 *
 * A timetable prints the campus in brackets when it is not Černá Pole
 * ("ZFAC1 (Led)"), and that is what tells same-named rooms apart. Without a
 * campus, a name found on two campuses resolves to nothing rather than a guess.
 */
export interface RoomPlaceEntry {
  label: string;
  campus: string;
  kind: 'poi' | 'landmark' | 'remote' | 'building';
  id: number;
  /** A readable name when IS's label is a technical handle ("ucebna_utechov"). */
  display?: string;
}

export type RoomPlace = Pick<RoomPlaceEntry, 'kind' | 'id' | 'label'>;

export function makeRoomPlaceLookup(entries: readonly RoomPlaceEntry[]) {
  const byLabel = new Map<string, RoomPlaceEntry[]>();
  for (const e of entries) {
    const key = normalizeRoomKey(e.label);
    byLabel.set(key, [...(byLabel.get(key) ?? []), e]);
  }
  return (raw: string | null | undefined): RoomPlace | null => {
    if (!raw || !raw.trim() || isNonPhysicalRoom(raw)) return null;
    const bracketed = raw.trim().match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    const label = (bracketed?.[1] ?? raw).trim();
    const campus = bracketed?.[2]?.trim();
    const hits = (byLabel.get(normalizeRoomKey(label)) ?? []).filter(
      (e) => !campus || e.campus === campus
    );
    const distinct = new Set(hits.map((e) => `${e.kind}:${e.id}`));
    const hit = hits[0];
    if (!hit || distinct.size !== 1) return null;
    // `label` is what the map card names the room: the display name when IS's
    // own label is a technical handle. Matching above always uses IS's label.
    return { kind: hit.kind, id: hit.id, label: hit.display ?? hit.label };
  };
}

export const lookupRoomPlace = makeRoomPlaceLookup(isRoomPlacesJson as RoomPlaceEntry[]);

export type RoomTarget =
  { kind: 'room'; entry: RoomIndexEntry } | { kind: 'place'; place: RoomPlace };

/** The room when the map draws it, else the building or campus it is in. */
export function lookupRoomTarget(
  raw: string | null | undefined,
  index: RoomIndexEntry[]
): RoomTarget | null {
  const entry = lookupRoomEntry(raw, index);
  if (entry) return { kind: 'room', entry };
  const place = lookupRoomPlace(raw);
  return place ? { kind: 'place', place } : null;
}
