import { describe, it, expect } from 'vitest';
import index from '../rooms-index.json';
import {
  LIBRARY_BUILDING_ID,
  LIBRARY_FLOOR_ID,
  LIBRARY_ROOMS,
  IC_LEFT_ID,
  IC_RIGHT_ID,
  splitIcRoom,
} from '../libraryRooms';
import type { RoomFeature, RoomIndexEntry, RoomsCollection } from '../../../types/campusMap';
import { pointInRing } from './pointInRing';

// The real outline of BA01P1012 (feature 57640) from reis-data rooms-54678.geojson.
const IC_OUTLINE: number[][] = [
  [16.615911, 49.210244],
  [16.615902, 49.210241],
  [16.615878, 49.210232],
  [16.615861, 49.210226],
  [16.615854, 49.210234],
  [16.615848, 49.210241],
  [16.615817, 49.210277],
  [16.615866, 49.210296],
  [16.615868, 49.210294],
  [16.615876, 49.210285],
  [16.615881, 49.210279],
  [16.615888, 49.21027],
  [16.615911, 49.210244],
];

const feature = (id: number, name: string, ring = IC_OUTLINE): RoomFeature => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [ring] },
  properties: {
    id,
    buildingId: LIBRARY_BUILDING_ID,
    floorId: LIBRARY_FLOOR_ID,
    floorLevel: -1,
    name,
    nickname: 'A011',
    type: 'office',
    category: 'office',
    label: 'Office',
    passportNumber: name,
    seats: null,
    hasProjector: false,
    hasWhiteboard: false,
    code: 944,
  },
});
const floor = (): RoomsCollection => ({
  type: 'FeatureCollection',
  features: [feature(57621, 'BA01P1052'), feature(IC_LEFT_ID, 'BA01P1012')],
});

const area = (ring: number[][]): number => {
  // Local metres at Brno's latitude: good to well under 1% across a 7 m room.
  const kx = 111320 * Math.cos((49.21 * Math.PI) / 180);
  const ky = 110540;
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    s += ring[i]![0]! * kx * ring[i + 1]![1]! * ky - ring[i + 1]![0]! * kx * ring[i]![1]! * ky;
  }
  return Math.abs(s) / 2;
};

describe('splitIcRoom', () => {
  it('turns the one outline into two study rooms, levá first', () => {
    const out = splitIcRoom(floor());
    expect(out.features).toHaveLength(3);
    expect(out.features.slice(1).map((f) => f.properties.nickname)).toEqual([
      'Studovna IC levá',
      'Studovna IC pravá',
    ]);
  });

  it('keeps the neighbours as they were', () => {
    const before = floor();
    const out = splitIcRoom(before);
    expect(out.features[0]).toBe(before.features[0]);
  });

  it('gives each half the library type and its own identity', () => {
    const [left, right] = splitIcRoom(floor()).features.slice(1);
    expect(left!.properties).toMatchObject({
      id: IC_LEFT_ID,
      name: 'BA01P1012',
      nickname: 'Studovna IC levá',
      type: 'library',
      category: 'teaching',
      label: 'Library',
      seats: 6,
    });
    expect(right!.properties).toMatchObject({
      id: IC_RIGHT_ID,
      nickname: 'Studovna IC pravá',
      type: 'library',
      seats: 6,
    });
    expect(right!.properties.id).not.toBe(left!.properties.id);
  });

  it('cuts the room in two halves of the same size', () => {
    const [left, right] = splitIcRoom(floor()).features.slice(1);
    const a = area(left!.geometry.coordinates[0]!);
    const b = area(right!.geometry.coordinates[0]!);
    expect(Math.abs(a - b) / (a + b)).toBeLessThan(0.05);
    expect(a + b).toBeCloseTo(area(IC_OUTLINE), 0);
  });

  it('puts levá on the upper (north) side', () => {
    const [left, right] = splitIcRoom(floor()).features.slice(1);
    const lat = (f: RoomFeature) =>
      f.geometry.coordinates[0]!.reduce((s, p) => s + p[1]!, 0) / f.geometry.coordinates[0]!.length;
    expect(lat(left!)).toBeGreaterThan(lat(right!));
  });

  it('covers the whole original room', () => {
    const [left, right] = splitIcRoom(floor()).features.slice(1);
    const probes: [number, number][] = [
      [16.615826, 49.210271],
      [16.615845, 49.210248],
      [16.615864, 49.210263],
      [16.615873, 49.210241],
      [16.615873, 49.210286],
      [16.615892, 49.210241],
    ];
    for (const p of probes) {
      const hit =
        pointInRing(p, left!.geometry.coordinates[0]!) ||
        pointInRing(p, right!.geometry.coordinates[0]!);
      expect(pointInRing(p, IC_OUTLINE), `${p} is in the original`).toBe(true);
      expect(hit, String(p)).toBe(true);
    }
  });

  it('draws closed rings', () => {
    for (const f of splitIcRoom(floor()).features.slice(1)) {
      const r = f.geometry.coordinates[0]!;
      expect(r[0]).toEqual(r[r.length - 1]);
    }
  });

  it('is a no-op once split, and on other floors', () => {
    const once = splitIcRoom(floor());
    expect(splitIcRoom(once)).toBe(once);
    const other: RoomsCollection = {
      type: 'FeatureCollection',
      features: [feature(1, 'BA01N1052')],
    };
    expect(splitIcRoom(other)).toBe(other);
  });
});

describe('LIBRARY_ROOMS', () => {
  it('lists the six rooms students can book, not the seminar room', () => {
    expect(LIBRARY_ROOMS.map((r) => r.featureId).sort()).toEqual(
      [57621, 57625, 57627, 57632, IC_LEFT_ID, IC_RIGHT_ID].sort()
    );
    expect(LIBRARY_ROOMS.find((r) => r.featureId === 57631)).toBeUndefined();
  });

  it('gives every room its own Bookings service and staff member', () => {
    expect(new Set(LIBRARY_ROOMS.map((r) => r.serviceId)).size).toBe(6);
    expect(new Set(LIBRARY_ROOMS.map((r) => r.staffMemberId)).size).toBe(6);
  });

  it('files the individual rooms apart from the team rooms', () => {
    const kinds = Object.fromEntries(LIBRARY_ROOMS.map((r) => [r.featureId, r.kind]));
    expect(kinds[57621]).toBe('individual');
    expect(kinds[57625]).toBe('individual');
    expect(kinds[57632]).toBe('team');
    expect(kinds[IC_LEFT_ID]).toBe('team');
  });

  it('is findable through the room index, so search and deep links reach both IC rooms', () => {
    const INDEX = index as RoomIndexEntry[];
    for (const id of [IC_LEFT_ID, IC_RIGHT_ID]) {
      expect(
        INDEX.some((e) => e.placeId === id),
        String(id)
      ).toBe(true);
    }
  });
});
