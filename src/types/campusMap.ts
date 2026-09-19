export type RoomCategory =
  'teaching' | 'office' | 'service' | 'circulation' | 'structure' | 'other';

export interface RoomProperties {
  id: number;
  buildingId: number;
  floorId: number;
  floorLevel: number | null;
  name: string;
  type: string;
  category: RoomCategory;
  label: string;
  // `nickname` = the human hall label from the MENDELU map API (e.g. "A01" for
  // BA01N1052); null when the API has none. Optional so data cached before it
  // shipped still types. Resolved for display via roomLabel().
  nickname?: string | null;
  passportNumber: string | null;
  seats: number | null;
  hasProjector: boolean;
  hasWhiteboard: boolean;
  code: number | null;
}
export interface RoomFeature {
  type: 'Feature';
  geometry: { type: 'Polygon'; coordinates: number[][][] };
  properties: RoomProperties;
}
export interface RoomsCollection {
  type: 'FeatureCollection';
  features: RoomFeature[];
}

export interface Floor {
  id: number;
  level: number;
  name: string | null;
  roomCount: number;
}
export interface Building {
  id: number;
  name: string;
  description: string | null;
  outline: { type: 'Polygon'; coordinates: number[][][] };
  center: [number, number];
  bounds: [[number, number], [number, number]];
  defaultFloorId: number | null;
  floors: Floor[];
}
export interface BuildingsMeta {
  buildings: Building[];
  campus: { bounds: [[number, number], [number, number]]; center: [number, number] };
}

export interface PoiProperties {
  id: number;
  name: string;
  type: string;
  url: string | null;
  phone: string | null;
  email: string | null;
}
export interface PoiFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: PoiProperties;
}
export interface PoiCollection {
  type: 'FeatureCollection';
  features: PoiFeature[];
}

export interface Landmark {
  id: number;
  name: string;
  type: string;
  url: string | null;
  phone: string | null;
  email: string | null;
  outline: { type: 'Polygon'; coordinates: number[][][] };
}

// Off-campus MENDELU sites (arboretum, Lednice, Žabčice, Křtiny), 0.3–50 km from
// the Brno campus. Real OSM footprints (see scripts/fetch-remote-places.mjs) so
// they draw like campus buildings/landmarks. A site is either one polygon (a
// garden, a farm areal, the Křtiny château) or a MultiPolygon of every building
// on a campus (the Lednice faculty). They reuse the poi selection kind: focus
// flies to the footprint centre and opens the detail card, with `address` shown
// as the detail-card subtitle (poi `type` slot). No floor plan here.
export interface RemotePlace {
  id: number;
  name: string;
  shortName: string;
  url: string | null;
  address: string | null;
  // Optional grounds boundary (a garden / campus perimeter) drawn faintly behind
  // the buildings — gives the arboretum its "inner map": garden outline + the
  // greenhouses/buildings inside it.
  area?: { type: 'Polygon'; coordinates: number[][][] };
  outline:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
  // Inner-map detail, revealed only when the site is drilled into (clicked). The
  // footpath network (each entry a [lon,lat] polyline) and labelled points of
  // interest (collections, greenhouses, viewpoints). Present for the arboretum.
  paths?: number[][][];
  pois?: { name: string; lon: number; lat: number }[];
}

// A place INSIDE the botanical garden that is worth walking to — one of the
// twelve carried by its own photograph, as opposed to the nineteen that stay
// plain dots in `RemotePlace.pois`. Hand-authored in
// `src/data/map/gardenPlaces.json`; no script generates or touches it.
//
// The curation line is "somewhere you would send a friend to sit", which is
// what `why` has to earn — not a description of the plants.
export interface GardenPlace {
  /** Stable slug, and the stem of the bundled thumb: `public/garden/<id>.webp`. */
  id: string;
  /** The garden's own published numbering, e.g. "2.6" for Rokle. */
  number: string;
  /** 1 Okolí správní budovy … 5 Botanický systém — the first half of `number`. */
  section: 1 | 2 | 3 | 4 | 5;
  name: { cz: string; en: string };
  /** ONE line: the reason to walk there. */
  why: { cz: string; en: string };
  lon: number;
  lat: number;
  /**
   * The FULL photo's filename on the CDN, content-hashed
   * (`rokle.8f3a1c.webp`) because jsDelivr caches `@main` mutably and a
   * replaced photo at the same path would not propagate.
   *
   * Optional on purpose: coordinates are one pass and land first, photographs
   * are picked on their own schedule. A place without one renders as a dot.
   */
  photo?: string;
  /** Author + licence; rendered under the photo only when set. */
  credit?: string;
}


// One walk across the Brno campus: the route from one campus place to the next
// one you reach, built at build time from the OSM way network
// (scripts/fetch-campus-paths.mjs). Routes connect — `to` of one is `from` of
// others — so following them end to end gets you anywhere on campus.
//
// `from`/`to` are never null: a route that does not run between two named
// places is not emitted, because a line ending in open ground is not something
// anyone would tap. It is the shortest walk along the paths OSM has MAPPED,
// which is not the same as the shortest walk on the ground wherever OSM is
// incomplete.
// A way ONTO the campus: one of the gates, or the tram stop you get off at.
// These are the only points the map marks. Buildings already draw their own
// letters, and a point in the middle of the campus (the cafeteria in building
// O) answered nothing — you do not arrive there.
export interface CampusEntrance {
  name: string;
  kind: 'gate' | 'stop' | 'other';
  lon: number;
  lat: number;
}

export interface CampusPath {
  id: number;
  from: string;
  to: string;
  lengthM: number;
  /**
   * [lon, lat] pairs, matching every other geometry in this file.
   *
   * Typed as `number[][]` rather than as a tuple because this comes straight
   * out of a JSON import, whose inferred element type is `number[]`; asserting
   * the tuple there needs a cast through `unknown`, which buys nothing that the
   * shape tests in `__tests__/pathLayers.test.ts` do not already check at
   * runtime.
   */
  coords: number[][];
}

export interface RoomIndexEntry {
  code: string;
  name: string;
  nickname?: string | null;
  buildingId: number;
  floorId: number;
  floorLevel: number | null;
  placeId: number;
}

// Unified selection for the detail panel and search results.
export type MapSelection =
  | { kind: 'room'; room: RoomProperties }
  | { kind: 'roomRef'; entry: RoomIndexEntry } // from search/deep-link before geometry loads
  | { kind: 'poi'; poi: PoiProperties; coord: [number, number] }
  | { kind: 'landmark'; landmark: Landmark } // search result only; resolves to a poi selection on focus
  | { kind: 'event'; event: import('./events').MapEvent }; // a society event pin
