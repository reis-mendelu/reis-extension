import { validateExternalUrl } from '../../mobile/openExternal';
import type { PostInput } from '../../api/societyPosts';
import { findEventEmoji } from '../../data/eventEmoji';
import type { EventCategory } from '../../types/events';

export interface ComposerDraft {
  title: string;
  description: string;
  /** A Twemoji code; its category follows from the catalog. */
  emoji: string;
  /** The event's own category ('other' for a new one): kept while the emoji
   *  is the one it started with, and when this build does not ship `emoji`. */
  fallbackCategory: EventCategory;
  /** The emoji the edited event started with; null for a new event. */
  startEmoji: string | null;
  date: string;
  endDate: string;
  time: string;
  room: { code: string; coord: [number, number] } | null;
  coord: [number, number] | null;
  placeName: string | null;
  url: string;
  subscribersOnly: boolean;
}

// A society publishes what it knows. A semester list has a title and a date;
// the place and time follow later (venue_kind 'tba', time null).
export function isComposerReady(d: {
  title: string;
  date: string;
  endDate: string;
  urlInvalid: boolean;
}): boolean {
  if (!d.title.trim() || !d.date || d.urlInvalid) return false;
  return !d.endDate || d.endDate >= d.date;
}

// Never 'online': no producer of it exists, so editing an online row would
// save it as 'tba'.
export function deriveVenue(
  room: { code: string } | null,
  coord: [number, number] | null
): 'campus' | 'offcampus' | 'tba' {
  return room ? 'campus' : coord ? 'offcampus' : 'tba';
}

export const isUrlInvalid = (url: string) => url.trim() !== '' && !validateExternalUrl(url.trim());

export function buildPostInput(d: ComposerDraft): PostInput {
  const venueKind = deriveVenue(d.room, d.coord);
  return {
    title: d.title.trim(),
    body: d.description.trim(),
    // The catalog decides the category older builds file it under.
    // An untouched picture keeps the event's category: the backfill files the
    // Finland trip under 'trip', while 🇫🇮 alone means 'culture'.
    category:
      d.emoji === d.startEmoji
        ? d.fallbackCategory
        : (findEventEmoji(d.emoji)?.category ?? d.fallbackCategory),
    emoji: d.emoji,
    date: d.date,
    endDate: d.endDate && d.endDate > d.date ? d.endDate : null,
    time: d.time || null,
    venueKind,
    roomCode: d.room?.code ?? null,
    coordLng: d.coord?.[0] ?? null,
    coordLat: d.coord?.[1] ?? null,
    location: d.room ? null : d.placeName,
    url: d.url.trim() || null,
    subscribersOnly: d.subscribersOnly,
  };
}
