import { validateExternalUrl } from '../../mobile/openExternal';
import type { PostInput } from '../../api/societyPosts';
import type { EventCategory } from '../../types/events';

export interface ComposerDraft {
  title: string;
  description: string;
  category: EventCategory;
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
    category: d.category,
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
