import { afterEach, describe, expect, it, vi } from 'vitest';
import { directionsFor } from '../roomDirectionsFor';
import type { RoomFeature, RoomsCollection } from '../../../types/campusMap';

const LNG0 = 16.6142;
const LAT0 = 49.2096;
const M = 111320;
const at = (x: number, y: number): [number, number] => [
  LNG0 + x / (M * Math.cos((LAT0 * Math.PI) / 180)),
  LAT0 + y / M,
];
let id = 1;
const f = (x: number, y: number, level: number, type: string, name = ''): RoomFeature => ({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[at(x, y), at(x + 4, y), at(x + 4, y + 4), at(x, y + 4), at(x, y)]],
  },
  properties: {
    id: id++,
    buildingId: 0,
    floorId: level,
    floorLevel: level,
    name,
    nickname: null,
    type,
    category: 'teaching',
    label: type,
    passportNumber: null,
    seats: null,
    hasProjector: false,
    hasWhiteboard: false,
    code: null,
  },
});

const q39 = f(-40, 10, 3, 'classroom', 'Q39');
const features = [
  ...[0, 1, 2, 3].map((l) => f(-44, 10, l, 'stairs')),
  f(-50, -30, 0, 'office'),
  f(50, 30, 0, 'office'),
  q39,
];
const rooms: Record<number, RoomsCollection> = {
  0: { type: 'FeatureCollection', features } as RoomsCollection,
};
const sel = { kind: 'room' as const, room: q39.properties };

afterEach(() => vi.unstubAllEnvs());

describe('directionsFor', () => {
  it('is off with the 3D flag, so no shell changes', () => {
    expect(directionsFor(sel, rooms)).toBeNull();
  });

  it('gives Q39 its steps with the flag on', () => {
    vi.stubEnv('VITE_MAP3D', '1');
    const d = directionsFor(sel, rooms);
    expect(d?.label).toBe('Q39');
    expect(d?.level).toBe(3);
    expect(d?.steps.map((s) => s.kind)).toEqual(['enter', 'core', 'arrive']);
  });

  it('covers only the buildings on the entrance list', () => {
    vi.stubEnv('VITE_MAP3D', '1');
    const other = { kind: 'room' as const, room: { ...q39.properties, buildingId: 3 } };
    expect(directionsFor(other, { 3: rooms[0]! })).toBeNull();
  });

  it('waits for the building’s plan', () => {
    vi.stubEnv('VITE_MAP3D', '1');
    expect(directionsFor(sel, {})).toBeNull();
  });
});
