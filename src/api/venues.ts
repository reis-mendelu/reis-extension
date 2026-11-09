import type {
  Bilingual,
  SocietyPin,
  Venue,
  VenueHours,
  VenueLunchDay,
  VenueMenuSection,
} from '../types/campusMap';
import { supabase } from '../services/spolky/supabaseClient';
import { SUPABASE_URL } from '../services/supabase/config';
import { logError } from '../utils/reportError';

export const VENUE_PHOTO_BUCKET = 'venue-photos';

export const VENUE_COLUMNS =
  'id, association_id, title, kind, place, address, room_code, coord_lng, coord_lat, hours, closed_from, closed_until, lunch, lunch_week, menu, photos, url, instagram, prices_checked, sort_order';

/** A `venues` row as PostgREST returns it. The jsonb columns are untyped on the wire. */
export interface VenueRow {
  id: string;
  association_id: string;
  title: string;
  kind: unknown;
  place: unknown;
  address: unknown;
  room_code: string | null;
  coord_lng: number;
  coord_lat: number;
  hours: unknown;
  closed_from: string | null;
  closed_until: string | null;
  lunch: unknown;
  lunch_week: unknown;
  menu: unknown;
  photos: string[] | null;
  url: string | null;
  instagram: string | null;
  prices_checked: string | null;
  sort_order: number;
}

/**
 * A path in the public `venue-photos` bucket, as a URL. Paths only: a full URL
 * in the row would make the card load an image from a host reIS does not
 * disclose, so it is dropped rather than followed.
 */
export function venuePhotoUrl(path: unknown): string | null {
  if (typeof path !== 'string' || !/^[a-z0-9][a-z0-9/_.-]*$/i.test(path) || path.includes('..'))
    return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${VENUE_PHOTO_BUCKET}/${path}`;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function bilingual(v: unknown): Bilingual | null {
  if (!isObj(v) || typeof v.cz !== 'string' || !v.cz.trim()) return null;
  return { cz: v.cz, en: typeof v.en === 'string' && v.en.trim() ? v.en : v.cz };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function hours(v: unknown): VenueHours[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (h): h is VenueHours =>
      isObj(h) &&
      Number.isInteger(h.day) &&
      (h.day as number) >= 1 &&
      (h.day as number) <= 7 &&
      typeof h.open === 'string' &&
      typeof h.close === 'string' &&
      TIME.test(h.open) &&
      TIME.test(h.close) &&
      h.open < h.close
  );
}

function menu(v: unknown): VenueMenuSection[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((s) => {
    const title = isObj(s) ? bilingual(s.title) : null;
    if (!isObj(s) || typeof s.id !== 'string' || !title || !Array.isArray(s.items)) return [];
    const items = s.items.filter(
      (i): i is { name: string; price: number | string } =>
        isObj(i) &&
        typeof i.name === 'string' &&
        (typeof i.price === 'number' || typeof i.price === 'string')
    );
    if (items.length === 0) return [];
    return [
      {
        id: s.id,
        title,
        photo: venuePhotoUrl(s.photo),
        items: items.map((i) => ({ name: i.name, price: i.price })),
      },
    ];
  });
}

function lunch(v: unknown): Venue['lunch'] {
  if (!isObj(v)) return null;
  const name = bilingual(v.name);
  if (!name || typeof v.price !== 'number') return null;
  return { name, note: bilingual(v.note), price: v.price };
}

/** `lunch_week`: { days: [{ date, soup, dishes }] }, filled weekly by reIS. */
function lunchDays(v: unknown): VenueLunchDay[] {
  if (!isObj(v) || !Array.isArray(v.days)) return [];
  return v.days.flatMap((d) => {
    if (!isObj(d) || typeof d.date !== 'string' || !DATE.test(d.date)) return [];
    const dishes = Array.isArray(d.dishes)
      ? d.dishes.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      : [];
    const soup = typeof d.soup === 'string' && d.soup.trim() ? d.soup : null;
    return soup || dishes.length ? [{ date: d.date, soup, dishes }] : [];
  });
}

/**
 * One row to the pin the map draws. Pure, so the shaping is tested without the
 * network. A row whose identity or place is unusable is dropped (null); a bad
 * jsonb field only empties that part of the card.
 */
export function venueRowToPin(r: VenueRow): SocietyPin | null {
  const kind = bilingual(r.kind);
  const place = bilingual(r.place);
  const address = bilingual(r.address);
  if (!kind || !place || !address || !r.title?.trim()) return null;
  const closure =
    r.closed_from && r.closed_until && DATE.test(r.closed_from) && DATE.test(r.closed_until)
      ? { from: r.closed_from, until: r.closed_until }
      : null;
  const url = r.url && /^https:\/\//.test(r.url) ? r.url : null;
  return {
    id: `venue:${r.id}`,
    societyId: r.association_id,
    title: r.title,
    description: null,
    url,
    coord: [r.coord_lng, r.coord_lat],
    venue: {
      kind,
      place,
      address,
      roomCode: r.room_code,
      hours: hours(r.hours),
      closure,
      lunch: lunch(r.lunch),
      lunchDays: lunchDays(r.lunch_week),
      menu: menu(r.menu),
      photos: (r.photos ?? []).flatMap((p) => venuePhotoUrl(p) ?? []),
      instagram: r.instagram && /^[A-Za-z0-9._]{1,30}$/.test(r.instagram) ? r.instagram : null,
      source:
        url && r.prices_checked && DATE.test(r.prices_checked)
          ? { url, checked: r.prices_checked }
          : null,
    },
  };
}

/**
 * The active venues (`venues`; RLS returns only `is_active` rows), or null when
 * the answer is not known — the slice keeps what it had. Before the release
 * creates the table this fails, and the map simply has no venues.
 */
export async function fetchVenuePins(): Promise<SocietyPin[] | null> {
  const { data, error } = await supabase.from('venues').select(VENUE_COLUMNS).order('sort_order');
  if (error) {
    logError('Api.fetchVenuePins', error);
    return null;
  }
  return ((data ?? []) as VenueRow[]).flatMap((r) => venueRowToPin(r) ?? []);
}
