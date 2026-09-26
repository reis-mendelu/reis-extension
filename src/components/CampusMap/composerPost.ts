import type { PostInput } from '../../api/societyPosts';
import type { EventCategory } from '../../types/events';
import { EVENT_CATEGORIES } from '../../data/eventCategories';

/**
 * The columns an edit writes — exactly the fields the composer shows, and no
 * others. `toRow` (societyPosts) is the create-side mapping and stamps the
 * ownership columns; an edit must not, and it must not touch `end_date` or
 * `visible_from` either, which the composer has no field for: writing them
 * would null a value the society never saw.
 */
export function toPatch(input: PostInput) {
  return {
    title: input.title,
    body: input.body,
    category: input.category,
    date: input.date,
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
