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
