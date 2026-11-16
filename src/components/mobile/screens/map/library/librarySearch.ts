import { LIBRARY_ROOMS } from '../../../../../data/map/libraryRooms';
import type { MapSelection } from '../../../../../types/campusMap';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Words a student types for the library's rooms, Czech and English, without diacritics. */
const WORDS = [
  'knihovna',
  'studovna',
  'studovny',
  'library',
  'study room',
  'study rooms',
  'rezervace',
];

/**
 * Whether a map search is asking for the library. "knihovna", "library" and
 * "study room" found nothing before, and "studovna" listed nine rooms, five of
 * them not bookable. Matches a prefix of three letters or more either way, so
 * "stud" and "knih" already find it.
 */
export function isLibraryQuery(q: string): boolean {
  const s = fold(q);
  if (s.length < 3) return false;
  return WORDS.some((w) => w.startsWith(s) || s.startsWith(w));
}

/** The library room a search result points at, if it is one of the six. */
export function libraryRoomOf(m: MapSelection): number | null {
  const id = m.kind === 'roomRef' ? m.entry.placeId : m.kind === 'room' ? m.room.id : null;
  return LIBRARY_ROOMS.some((r) => r.featureId === id) ? id : null;
}

/** A library room's one name, for its search row ("Indiv. studovna 1" in IS's index). */
export function libraryRoomName(id: number | null, lang: 'cz' | 'en'): string | null {
  const r = LIBRARY_ROOMS.find((x) => x.featureId === id);
  return r ? (lang === 'cz' ? r.nameCs : r.nameEn) : null;
}
