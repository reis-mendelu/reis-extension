export type RoomCategory =
  | 'teaching' | 'office' | 'service' | 'circulation' | 'structure' | 'other';

export interface RoomProperties {
  id: number; buildingId: number; floorId: number; floorLevel: number | null;
  name: string; type: string; category: RoomCategory; label: string;
  passportNumber: string | null; seats: number | null;
  hasProjector: boolean; hasWhiteboard: boolean; code: number | null;
}
export interface RoomFeature {
  type: 'Feature';
  geometry: { type: 'Polygon'; coordinates: number[][][] };
  properties: RoomProperties;
}
export interface RoomsCollection { type: 'FeatureCollection'; features: RoomFeature[]; }

export interface Floor { id: number; level: number; name: string | null; roomCount: number; }
export interface Building {
  id: number; name: string; description: string | null;
  outline: { type: 'Polygon'; coordinates: number[][][] };
  center: [number, number]; bounds: [[number, number], [number, number]];
  defaultFloorId: number | null; floors: Floor[];
}
export interface BuildingsMeta {
  buildings: Building[];
  campus: { bounds: [[number, number], [number, number]]; center: [number, number]; };
}

export interface PoiProperties {
  id: number; name: string; type: string;
  url: string | null; phone: string | null; email: string | null;
}
export interface PoiFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: PoiProperties;
}
export interface PoiCollection { type: 'FeatureCollection'; features: PoiFeature[]; }

export interface Landmark {
  id: number; name: string; type: string;
  url: string | null; phone: string | null; email: string | null;
  outline: { type: 'Polygon'; coordinates: number[][][] };
}

export interface RoomIndexEntry {
  code: string; name: string; buildingId: number;
  floorId: number; floorLevel: number | null; placeId: number;
}

// Unified selection for the detail panel and search results.
export type MapSelection =
  | { kind: 'room'; room: RoomProperties }
  | { kind: 'roomRef'; entry: RoomIndexEntry }   // from search/deep-link before geometry loads
  | { kind: 'poi'; poi: PoiProperties; coord: [number, number] }
  | { kind: 'landmark'; landmark: Landmark };    // search result only; resolves to a poi selection on focus
