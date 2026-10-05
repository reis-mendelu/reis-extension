type Coord = [number, number];

export interface ParsedPoint {
  /** [lng, lat] — same order as MapEvent.coord. */
  coord: Coord;
  /** The place name a Google Maps place link carries, when it has one. */
  name?: string;
}

// The same Czech box placeSearch restricts Photon to. Used only to decide
// which way round a bare pair was typed; a point outside it is still accepted.
const inCz = (lat: number, lng: number) =>
  lat >= 48.55 && lat <= 51.06 && lng >= 12.09 && lng <= 18.86;
const onEarth = (lat: number, lng: number) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

function point(lat: number, lng: number, name?: string): ParsedPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // A pair copied from a tool that writes lng first: swap only when that is
  // the one order that lands in Czechia, so a real point abroad is untouched.
  if (!inCz(lat, lng) && inCz(lng, lat)) [lat, lng] = [lng, lat];
  if (!onEarth(lat, lng)) return null;
  return name ? { coord: [lng, lat], name } : { coord: [lng, lat] };
}

const num = (s: string) => Number(s.replace(',', '.'));

// A stray % in a pasted link must not throw out of the search box.
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Pasted text that is a web address — never a name worth geocoding. */
export const isLink = (text: string) => /^https?:\/\//i.test(text.trim());

function fromUrl(text: string): ParsedPoint | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const place = /\/maps\/place\/([^/@]+)/.exec(url.pathname)?.[1];
  const label = place ? decode(place.replace(/\+/g, ' ')).trim() : undefined;
  // A pin dropped where nothing is named comes back as /place/49°12'28.4"N…:
  // the point itself, which is no name to publish.
  const name = label && !parseCoordinate(label) ? label : undefined;
  const href = decode(url.href);
  // Google: !3d<lat>!4d<lng> is the place's own pin; @<lat>,<lng> is only
  // where the viewport was centred, so it comes second.
  const pin =
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(href) ?? /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(href);
  if (pin) return point(Number(pin[1]), Number(pin[2]), name);
  for (const key of ['q', 'query', 'll', 'center']) {
    const m = /^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/.exec(url.searchParams.get(key) ?? '');
    if (m) return point(Number(m[1]), Number(m[2]), name);
  }
  // Mapy.cz: x is longitude, y latitude.
  const x = url.searchParams.get('x');
  const y = url.searchParams.get('y');
  if (x && y) return point(Number(y), Number(x), name);
  return null;
}

const DMS =
  /^(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:[.,]\d+)?)["″]\s*([NS])[\s,;]+(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:[.,]\d+)?)["″]\s*([EW])$/i;

function fromDms(text: string): ParsedPoint | null {
  const m = DMS.exec(text);
  if (!m) return null;
  const deg = (d: string, mi: string, s: string, hemi: string) =>
    (Number(d) + Number(mi) / 60 + num(s) / 3600) * (/[SW]/i.test(hemi) ? -1 : 1);
  return point(deg(m[1]!, m[2]!, m[3]!, m[4]!), deg(m[5]!, m[6]!, m[7]!, m[8]!));
}

// Decimal degrees, decimals required so "602 00" or "2024, 2025" stay text.
// A comma separator needs dot decimals; comma decimals need ; or a space.
const PAIR_DOT = /^(-?\d{1,3}\.\d+)\s*[NS]?\s*[,;\s]\s*(-?\d{1,3}\.\d+)\s*[EW]?$/i;
const PAIR_COMMA = /^(-?\d{1,3},\d+)\s*[NS]?\s*(?:;\s*|\s+)(-?\d{1,3},\d+)\s*[EW]?$/i;

/**
 * A coordinate an organiser pasted into the venue search — a "lat, lng" pair,
 * degrees-minutes-seconds, or a Google Maps / Apple Maps / Mapy.cz link — or
 * null when the text is a name to search for. A short link (maps.app.goo.gl)
 * is null: its place is behind a redirect the browser cannot follow for us.
 */
export function parseCoordinate(input: string): ParsedPoint | null {
  const text = input.trim();
  if (isLink(text)) return fromUrl(text);
  const pair = PAIR_DOT.exec(text) ?? PAIR_COMMA.exec(text);
  if (pair) return point(num(pair[1]!), num(pair[2]!));
  return fromDms(text);
}
