export type FacultyKey = 'mendelu' | 'pef' | 'af' | 'ldf' | 'zf' | 'frrms';

export interface EventOrganizer {
  key: FacultyKey;
  cz: string;
  en: string;
  color: string;
}

export type EventCategory =
  | 'party'
  | 'boardgames'
  | 'trip'
  | 'quiz'
  | 'sports'
  | 'film'
  | 'karaoke'
  | 'culture'
  | 'social'
  | 'other';

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
  ldf: {
    key: 'ldf',
    cz: 'Lesnická a dřevařská fakulta',
    en: 'Faculty of Forestry and Wood Technology',
    color: '#0a5028',
  },
  pef: {
    key: 'pef',
    cz: 'Provozně ekonomická fakulta',
    en: 'Faculty of Business and Economics',
    color: '#0046a0',
  },
  zf: { key: 'zf', cz: 'Zahradnická fakulta', en: 'Faculty of Horticulture', color: '#8c0a00' },
  frrms: {
    key: 'frrms',
    cz: 'Fakulta regionálního rozvoje a mezinárodních studií',
    en: 'Faculty of Regional Development and International Studies',
    color: '#c32897',
  },
};

export const COLOR_TO_FACULTY: Record<string, FacultyKey> = Object.fromEntries(
  Object.values(ORGANIZERS).map((o) => [o.color, o.key])
) as Record<string, FacultyKey>;

export const ALL_FACULTY_KEYS: FacultyKey[] = ['mendelu', 'pef', 'af', 'ldf', 'zf', 'frrms'];

// A student society/union that authors map events (ESN, SU PEF, AU FRRMS). The
// catalog lives in the Supabase `societies` table and reaches the app through
// the societies slice; `src/data/societies.ts` is only the first-launch seed.
// The pin ring + list dot use `color`; `glyph` is the tile fallback for a
// missing logo. `facultyKey` drives first-run auto-follow and the audience label.
export interface Society {
  id: string;
  name: string;
  /** Short label for compact UI (host line, chips): "SUPEF" vs "SU PEF". */
  shortName: string;
  color: string;
  /** Text shown on the colour tile when there is no logo, derived from shortName. */
  glyph: string;
  /** Public URL of the logo in the society-logos bucket. Absent until one is
   *  uploaded, and in the bundled seed; every call site falls back to `glyph`. */
  logo?: string;
  facultyKey: FacultyKey;
  /** New students of `facultyKey` follow this society on first run. */
  autoFollowFaculty: boolean;
  /** Who the society is for when no faculty says it (ESN: the Erasmus students). */
  audienceLabel: 'erasmus' | null;
  sortOrder: number;
  /** Hidden societies still resolve for their old events; they leave lists. */
  isActive: boolean;
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
  /** Show only to students who follow this society. Noise control, not access
   *  control — see utils/eventAudience. Absent on rows written before the
   *  column existed, which are open to everyone. */
  subscribersOnly?: boolean;
}

export const FACULTY_LABEL_TO_KEY: Record<string, FacultyKey> = {
  PEF: 'pef',
  AF: 'af',
  LDF: 'ldf',
  ZF: 'zf',
  FRRMS: 'frrms',
  ICV: 'mendelu',
};
