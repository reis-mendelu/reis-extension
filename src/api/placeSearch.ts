import { logError } from '../utils/reportError';

// Photon (komoot) geocoding — free, keyless, OSM-licensed, and CORS-open
// (Access-Control-Allow-Origin: *), so the iframe can call it directly. Results
// are OSM/ODbL, which plots freely on our Leaflet/Carto basemap (unlike Google
// Places / Mapbox, whose terms require rendering on their own maps). Used by the
// society composer to attach an off-campus venue by name instead of clicking the
// map. See docs: https://photon.komoot.io/
const PHOTON_URL = 'https://photon.komoot.io/api';
// Bias results toward MENDELU / Brno so "Česká" or "Lužánky" resolve locally.
const BIAS_LAT = 49.21;
const BIAS_LON = 16.6144;
// Restrict to a Czech Republic bounding box (minLon,minLat,maxLon,maxLat) so a
// global namesake — e.g. a "Utopia" in the US or Munich — can't outrank the Brno
// venue. Nearly every society event is in Brno/CZ; the lat/lon bias then ranks
// Brno first within the box.
const CZ_BBOX = '12.09,48.55,18.86,51.06';
const MIN_QUERY = 2;

export interface PhotonFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    osm_id: number;
    osm_type: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    osm_value?: string;
  };
}

export interface PlaceResult {
  id: string;
  name: string;
  /** Short human context line, e.g. "Brno, Dvořákova". */
  context: string;
  /** [lng, lat] — same order as MapEvent.coord. */
  coord: [number, number];
}

// Pure feature → PlaceResult mapping, kept out of the network call so it's
// unit-testable. A place with neither name nor street is unusable and returns
// null (the caller drops it).
export function toPlaceResult(f: PhotonFeature): PlaceResult {
  const p = f.properties;
  const name = p.name ?? p.street ?? '';
  const context = [p.city ?? p.district, p.name ? p.street : undefined].filter(Boolean).join(', ');
  return {
    id: `${p.osm_type}${p.osm_id}`,
    name,
    context,
    coord: f.geometry.coordinates,
  };
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY) return [];
  const url = `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=6&lat=${BIAS_LAT}&lon=${BIAS_LON}&bbox=${CZ_BBOX}&lang=default`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      logError('Api.searchPlaces', new Error(`photon ${res.status}`));
      return [];
    }
    const data = (await res.json()) as { features?: PhotonFeature[] };
    return (data.features ?? []).map(toPlaceResult).filter((r) => r.name.length > 0);
  } catch (err) {
    logError('Api.searchPlaces', err);
    return [];
  }
}
