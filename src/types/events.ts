export type FacultyKey = 'mendelu' | 'pef' | 'af' | 'ldf' | 'zf' | 'frrms';

export interface EventOrganizer {
  key: FacultyKey;
  cz: string;
  en: string;
  color: string;
}

export type EventCategory =
  | 'party' | 'boardgames' | 'trip' | 'quiz' | 'sports'
  | 'film' | 'karaoke' | 'culture' | 'social' | 'other';

export interface MendeluEvent {
  title: string;
  url: string;
  date: string;
  endDate: string | null;
  time: string | null;
  location: string | null;
  imageUrl: string | null;
  organizerKey: FacultyKey;
}

export const ORGANIZERS: Record<FacultyKey, EventOrganizer> = {
  mendelu: { key: 'mendelu', cz: 'MENDELU', en: 'MENDELU', color: '#79be15' },
  af: { key: 'af', cz: 'Agronomická fakulta', en: 'Faculty of AgriSciences', color: '#c87800' },
  ldf: { key: 'ldf', cz: 'Lesnická a dřevařská fakulta', en: 'Faculty of Forestry and Wood Technology', color: '#0a5028' },
  pef: { key: 'pef', cz: 'Provozně ekonomická fakulta', en: 'Faculty of Business and Economics', color: '#0046a0' },
  zf: { key: 'zf', cz: 'Zahradnická fakulta', en: 'Faculty of Horticulture', color: '#8c0a00' },
  frrms: { key: 'frrms', cz: 'Fakulta regionálního rozvoje a mezinárodních studií', en: 'Faculty of Regional Development and International Studies', color: '#c32897' },
};

export const COLOR_TO_FACULTY: Record<string, FacultyKey> = Object.fromEntries(
  Object.values(ORGANIZERS).map(o => [o.color, o.key])
) as Record<string, FacultyKey>;

export const ALL_FACULTY_KEYS: FacultyKey[] = ['mendelu', 'pef', 'af', 'ldf', 'zf', 'frrms'];

// A student society/union that authors map events (ESN, SU PEF, AU FRRMS). The
// pin ring + list dot use `color`; `glyph` is the short logo fallback shown when
// an event has no poster image. `facultyKey` drives the "My faculty" filter.
export interface Society {
  id: string;
  name: string;
  /** Short label for compact UI (filter chips, host line) — e.g. "ESN" vs "ESN MENDELU". */
  shortName: string;
  color: string;
  glyph: string;       // short text fallback when the logo image is unavailable
  logo: string;        // runtime path to the shipped society logo (/spolky/<id>.jpg)
  facultyKey: FacultyKey;
}

// An event placed on the campus map. Extends the bell-feed event with an
// explicit picked coordinate (null = off-campus, list-only), the authoring
// society, and an optional room code for the "fly there" affordance.
export interface MapEvent extends MendeluEvent {
  id: string;
  societyId: string;
  coord: [number, number] | null; // [lng, lat]
  roomCode: string | null;
  venueKind: 'campus' | 'online' | 'offcampus';
  category: EventCategory;
}

export const FACULTY_LABEL_TO_KEY: Record<string, FacultyKey> = {
  PEF: 'pef',
  AF: 'af',
  LDF: 'ldf',
  ZF: 'zf',
  FRRMS: 'frrms',
  ICV: 'mendelu',
};
