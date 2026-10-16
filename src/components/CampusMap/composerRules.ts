import { validateExternalUrl } from '../../mobile/openExternal';
import type { PostInput } from '../../api/societyPosts';
import { findEventEmoji } from '../../data/eventEmoji';
import type { EventCategory, PostKind } from '../../types/events';

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
  /** Absent = event, so a draft built before the toggle existed is one. */
  kind?: PostKind;
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
  const kind = d.kind ?? 'event';
  const notice = kind === 'notice';
  // A notice has no place and no picture. Those fields are hidden, but what
  // was picked before switching to it is still in the draft: drop it here, or
  // an event turned notice keeps its room and an old build pins it (and draws
  // a party popper beside "Hledáš bydlení?" in its Akce list).
  const room = notice ? null : d.room;
  const coord = notice ? null : d.coord;
  const placeName = notice ? null : d.placeName;
  const venueKind = deriveVenue(room, coord);
  return {
    title: d.title.trim(),
    body: d.description.trim(),
    // The catalog decides the category older builds file it under.
    // An untouched picture keeps the event's category: the backfill files the
    // Finland trip under 'trip', while 🇫🇮 alone means 'culture'.
    category: notice
      ? 'other'
      : d.emoji === d.startEmoji
        ? d.fallbackCategory
        : (findEventEmoji(d.emoji)?.category ?? d.fallbackCategory),
    emoji: notice ? null : d.emoji,
    date: d.date,
    endDate: d.endDate && d.endDate > d.date ? d.endDate : null,
    time: d.time || null,
    venueKind,
    roomCode: room?.code ?? null,
    coordLng: coord?.[0] ?? null,
    coordLat: coord?.[1] ?? null,
    location: room ? null : placeName,
    url: d.url.trim() || null,
    subscribersOnly: d.subscribersOnly,
    kind,
  };
}
