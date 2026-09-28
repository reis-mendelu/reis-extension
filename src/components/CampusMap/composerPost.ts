import type { PostInput } from '../../api/societyPosts';
import type { EventCategory, MapEvent } from '../../types/events';
import type { RoomIndexEntry } from '../../types/campusMap';
import { EVENT_CATEGORIES } from '../../data/eventCategories';
import { roomCodeToName } from './mapHelpers';

export type Room = { code: string; name: string; coord: [number, number] };

/**
 * The composer's initial room, derived from the event being edited or
 * duplicated. Only a campus event with both a room code and a coordinate
 * counts — anything else (offcampus, tba, or a legacy row missing one of the
 * two) starts with no room picked.
 */
export function initialRoom(source: MapEvent | null, index: RoomIndexEntry[]): Room | null {
  if (source?.venueKind !== 'campus' || !source.roomCode || !source.coord) return null;
  return {
    code: source.roomCode,
    // roomCode is the IS-internal code ("BA39N1009"); show the hall name.
    name: source.location ?? roomCodeToName(source.roomCode, index),
    coord: source.coord,
  };
}

/**
 * The composer's initial off-campus place name: a display name from the
 * place search, or null for a pin dropped by hand or a tba event.
 */
export function initialPlaceName(source: MapEvent | null): string | null {
  return source && source.venueKind !== 'campus' ? (source.location ?? null) : null;
}

/**
 * The columns an edit writes — exactly the fields the composer shows, and no
 * others. `toRow` (societyPosts) is the create-side mapping and stamps the
 * ownership columns; an edit must not. The composer now has an end-date
 * field, so the patch writes it — but it still never writes `visible_from`,
 * which the composer has no field for: writing it would null a value the
 * society never saw.
 */
export function toPatch(input: PostInput) {
  return {
    title: input.title,
    body: input.body,
    category: input.category,
    date: input.date,
    end_date: input.endDate ?? null,
    time: input.time ?? null,
    venue_kind: input.venueKind,
    room_code: input.roomCode ?? null,
    coord_lng: input.coordLng ?? null,
    coord_lat: input.coordLat ?? null,
    location: input.location ?? null,
    url: input.url ?? null,
    // Editable, so it has to be in the patch. Left out, an audience change
    // saved cleanly and kept the old value in the database while the form
    // showed the society its new choice.
    subscribers_only: input.subscribersOnly ?? false,
  };
}

/**
 * The category of the society's latest-dated event: what a new one starts on,
 * since most societies run one kind of thing (Deskovky, a quiz night). Null for
 * a first event, or a stored value this build does not know.
 */
export function latestCategory(
  posts: ReadonlyArray<{ date: string; category: string }>
): EventCategory | null {
  const latest = posts.reduce<{ date: string; category: string } | null>(
    (best, p) => (!best || p.date > best.date ? p : best),
    null
  );
  return latest && (EVENT_CATEGORIES as readonly string[]).includes(latest.category)
    ? (latest.category as EventCategory)
    : null;
}
