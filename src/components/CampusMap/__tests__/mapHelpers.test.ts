import { describe, it, expect } from 'vitest';
import {
  shortLabel,
  roomLabel,
  lonLatToLatLng,
  ringToLatLng,
  searchPlaces,
  searchRooms,
  polygonCentroid,
  categoryStyle,
  landmarkGroupLabels,
  roomCodeToCoord,
  roomCodeToName,
} from '../mapHelpers';
import type { RoomIndexEntry, BuildingsMeta, PoiFeature, Landmark } from '../../../types/campusMap';

describe('roomCodeToCoord', () => {
  const index = [
    { code: 'BA39N1009', name: 'Q01', buildingId: 0, floorId: 5, floorLevel: 0, placeId: 546 },
  ] as unknown as RoomIndexEntry[];
  const buildings = {
    buildings: [{ id: 0, name: 'Q', center: [49.2096, 16.6142] }],
    campus: {},
  } as unknown as BuildingsMeta;
  it('resolves a room code to its building centre as [lng, lat]', () => {
    expect(roomCodeToCoord('Q01', index, buildings)).toEqual([16.6142, 49.2096]);
  });
  it('matches by index code as well as display name', () => {
    expect(roomCodeToCoord('BA39N1009', index, buildings)).toEqual([16.6142, 49.2096]);
  });
  it('normalizes case and whitespace before matching', () => {
    expect(roomCodeToCoord('  q01 ', index, buildings)).toEqual([16.6142, 49.2096]);
  });
  it('returns null for an unknown code', () => {
    expect(roomCodeToCoord('ZZZ', index, buildings)).toBeNull();
  });
});

describe('roomCodeToName', () => {
  const index = [
    { code: 'BA39N1009', name: 'Q01', buildingId: 0, floorId: 5, floorLevel: 0, placeId: 546 },
  ] as unknown as RoomIndexEntry[];
  it('resolves the IS-internal code to its human-readable hall name', () => {
    expect(roomCodeToName('BA39N1009', index)).toBe('Q01');
  });
  it('normalizes case and whitespace before matching', () => {
    expect(roomCodeToName('  ba39n1009 ', index)).toBe('Q01');
  });
  it('passes a legacy name-valued code through unchanged', () => {
    expect(roomCodeToName('Q01', index)).toBe('Q01');
  });
  it('falls back to the given string for an unknown code', () => {
    expect(roomCodeToName('ZZZ', index)).toBe('ZZZ');
  });
  it('resolves a building-A code to its nickname (A01), not the raw N-code', () => {
    const idx = [
      {
        code: 'BA01N1052',
        name: 'BA01N1052',
        nickname: 'A01',
        buildingId: 1,
        floorId: 2,
        floorLevel: 0,
        placeId: 63374,
      },
    ] as unknown as RoomIndexEntry[];
    expect(roomCodeToName('BA01N1052', idx)).toBe('A01');
  });
});

describe('roomLabel', () => {
  it('keeps an already-friendly name (PEF: name differs from the passport code)', () => {
    expect(roomLabel('Q6.06', 'BA39N6006', null)).toBe('Q6.06');
  });
  it('ignores a descriptive nickname when the name is already the friendly code', () => {
    expect(roomLabel('Q3.54', 'BA39N3054', 'KPMG Hall')).toBe('Q3.54');
  });
  it('uses the nickname when the name is the raw passport code (building A)', () => {
    expect(roomLabel('BA01N1052', 'BA01N1052', 'A01')).toBe('A01');
  });
  it('falls back to the stripped prefix when there is no nickname', () => {
    expect(roomLabel('BA01N1052', 'BA01N1052', null)).toBe('N1052');
  });
  it('tolerates an empty name by stripping the raw code', () => {
    expect(roomLabel('', 'BA01N1052', undefined)).toBe('N1052');
  });
  it('prefers the nickname when rawCode is null (building B: no passportNumber)', () => {
    // name is a raw-code-shaped string but there is no passport code to compare
    // against, so the nickname must still win.
    expect(roomLabel('BA02N9999', null, 'B564')).toBe('B564');
  });
});

describe('categoryStyle', () => {
  it('maps known categories to a fill + stroke pair', () => {
    expect(categoryStyle('teaching')).toEqual({ fill: '#c8e6a0', stroke: '#7cb342' });
    expect(categoryStyle('circulation')).toEqual({ fill: '#ece1cb', stroke: '#cbb994' });
  });
});

describe('shortLabel', () => {
  it('strips building prefix from passport codes', () => {
    expect(shortLabel('BA04N3047')).toBe('N3047');
    expect(shortLabel('BA39S5003')).toBe('S5003');
  });
  it('leaves plain names untouched', () => {
    expect(shortLabel('Q01')).toBe('Q01');
    expect(shortLabel('')).toBe('');
  });
});

describe('coordinate flip', () => {
  it('swaps [lon,lat] -> [lat,lng]', () => {
    expect(lonLatToLatLng([16.61, 49.21])).toEqual([49.21, 16.61]);
  });
  it('flips every vertex of a ring', () => {
    expect(
      ringToLatLng([
        [16.6, 49.2],
        [16.7, 49.3],
      ])
    ).toEqual([
      [49.2, 16.6],
      [49.3, 16.7],
    ]);
  });
});

describe('searchPlaces', () => {
  const index: RoomIndexEntry[] = [
    { code: 'Q01', name: 'Q01', buildingId: 0, floorId: 9, floorLevel: 0, placeId: 1 },
    {
      code: 'BA04N3047',
      name: 'BA04N3047',
      buildingId: 54678,
      floorId: 7,
      floorLevel: 3,
      placeId: 2,
    },
  ];
  const pois = [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.6, 49.2] },
      properties: { id: 9, name: 'FRRMS', type: 'building', url: null, phone: null, email: null },
    },
  ] as PoiFeature[];
  const landmarks = [
    {
      id: 1588,
      name: 'Tauferovy koleje',
      type: 'dormitory',
      url: null,
      phone: null,
      email: null,
      outline: {
        type: 'Polygon',
        coordinates: [
          [
            [16.588, 49.214],
            [16.589, 49.214],
            [16.589, 49.215],
            [16.588, 49.214],
          ],
        ],
      },
    },
  ] as Landmark[];

  it('matches a room code case-insensitively', () => {
    const r = searchPlaces('q01', index, pois, landmarks);
    expect(r[0]).toMatchObject({ kind: 'roomRef', entry: { code: 'Q01' } });
  });
  it('ranks an exact name match above substring children, regardless of index order', () => {
    // Children listed first; the exact "Q01" hall is buried later in the array.
    const withChildren: RoomIndexEntry[] = [
      { code: 'BA39P1009', name: 'Q01.09', buildingId: 0, floorId: 5, floorLevel: 0, placeId: 10 },
      { code: 'BA39P1014', name: 'Q01.14', buildingId: 0, floorId: 5, floorLevel: 0, placeId: 11 },
      { code: 'BA39N1009', name: 'Q01', buildingId: 0, floorId: 9, floorLevel: 0, placeId: 1 },
    ];
    const r = searchPlaces('Q01', withChildren, pois, landmarks);
    // The exact "Q01" must be the first result the student sees.
    expect(r[0]).toMatchObject({ kind: 'roomRef', entry: { name: 'Q01' } });
  });
  it('ranks bare Q## lecture halls above dotted Q##.NN rooms', () => {
    // "Q##" (no dot) are student lecture halls; "Q##.NN" are individual offices.
    const mixed: RoomIndexEntry[] = [
      { code: 'BA39P0109', name: 'Q01.09', buildingId: 0, floorId: 5, floorLevel: 0, placeId: 20 },
      { code: 'BA39N0006', name: 'Q06', buildingId: 0, floorId: 9, floorLevel: 0, placeId: 21 },
      { code: 'BA39P0143', name: 'Q01.43', buildingId: 0, floorId: 5, floorLevel: 0, placeId: 22 },
      { code: 'BA39N0001', name: 'Q01', buildingId: 0, floorId: 9, floorLevel: 0, placeId: 23 },
    ];
    const names = searchPlaces('Q0', mixed, pois, landmarks)
      .filter((m): m is Extract<typeof m, { kind: 'roomRef' }> => m.kind === 'roomRef')
      .map((m) => m.entry.name);
    // Both bare halls come before either dotted room.
    expect(names.indexOf('Q01')).toBeLessThan(names.indexOf('Q01.09'));
    expect(names.indexOf('Q06')).toBeLessThan(names.indexOf('Q01.43'));
  });
  it('matches a POI name', () => {
    const r = searchPlaces('frrm', index, pois, landmarks);
    expect(r.some((m) => m.kind === 'poi' && m.poi.name === 'FRRMS')).toBe(true);
  });
  it('returns [] for empty query', () => {
    expect(searchPlaces('  ', index, pois, landmarks)).toEqual([]);
  });
  it('finds a landmark by name', () => {
    const r = searchPlaces('tauferovy', index, pois, landmarks);
    expect(r.some((m) => m.kind === 'landmark' && m.landmark.name === 'Tauferovy koleje')).toBe(
      true
    );
  });
});

describe('searchRooms', () => {
  // Children listed first — mirrors the real rooms-index.json, where the
  // dotted Q01.NN offices precede the bare "Q01" lecture hall.
  const index: RoomIndexEntry[] = [
    { code: 'BA39P1009', name: 'Q01.09', buildingId: 0, floorId: 5, floorLevel: 0, placeId: 10 },
    { code: 'BA39P1014', name: 'Q01.14', buildingId: 0, floorId: 5, floorLevel: 0, placeId: 11 },
    { code: 'BA39P1024', name: 'Q01.24', buildingId: 0, floorId: 5, floorLevel: 0, placeId: 12 },
    { code: 'BA39N1009', name: 'Q01', buildingId: 0, floorId: 9, floorLevel: 0, placeId: 1 },
  ];

  it('ranks the exact bare-hall match first, same as the map search', () => {
    expect(searchRooms('q01', index).map((r) => r.name)[0]).toBe('Q01');
  });
  it('respects the result limit after ranking', () => {
    expect(searchRooms('q01', index, 2)).toHaveLength(2);
  });
  it('returns [] for an empty query', () => {
    expect(searchRooms('   ', index)).toEqual([]);
  });
  it('finds a building-A room by its nickname even though the name is the raw code', () => {
    const idx: RoomIndexEntry[] = [
      {
        code: 'BA01N1052',
        name: 'BA01N1052',
        nickname: 'A01',
        buildingId: 1,
        floorId: 2,
        floorLevel: 0,
        placeId: 63374,
      },
    ];
    expect(searchRooms('a01', idx).map((r) => r.code)).toContain('BA01N1052');
    // the raw N-code still matches too
    expect(searchRooms('n1052', idx).map((r) => r.code)).toContain('BA01N1052');
  });
});

describe('polygonCentroid', () => {
  it('averages the ring vertices to a [lon, lat] point', () => {
    expect(
      polygonCentroid([
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ])
    ).toEqual([1, 1]);
  });
});

describe('landmarkGroupLabels', () => {
  // A square ring (closed) around a given [lon, lat] centre, ~tiny footprint.
  const sq = (lon: number, lat: number): number[][] => [
    [lon - 0.0001, lat - 0.0001],
    [lon + 0.0001, lat - 0.0001],
    [lon + 0.0001, lat + 0.0001],
    [lon - 0.0001, lat + 0.0001],
    [lon - 0.0001, lat - 0.0001],
  ];
  const mk = (id: number, name: string, lon: number, lat: number): Landmark => ({
    id,
    name,
    type: 'building',
    url: null,
    phone: null,
    email: null,
    outline: { type: 'Polygon', coordinates: [sq(lon, lat)] },
  });

  it('combines co-located landmarks (same building) into one "A / B" label', () => {
    // FRRMS and Kolej Akademie share an identical outline (0 m apart).
    const labels = landmarkGroupLabels([
      mk(1, 'FRRMS', 16.61, 49.21),
      mk(2, 'Kolej Akademie', 16.61, 49.21),
    ]);
    expect(labels.get(1)).toBe('FRRMS / Kolej Akademie');
    expect(labels.get(2)).toBe('FRRMS / Kolej Akademie');
  });

  it('keeps distinct nearby buildings (JAK blocks, 65 m+ apart) separate', () => {
    // ~0.001 deg lon ≈ 73 m at this latitude — beyond the 40 m threshold.
    const labels = landmarkGroupLabels([
      mk(10, 'Koleje JAK Blok A', 16.61, 49.21),
      mk(11, 'Koleje JAK Blok B', 16.611, 49.21),
    ]);
    expect(labels.get(10)).toBe('Koleje JAK Blok A');
    expect(labels.get(11)).toBe('Koleje JAK Blok B');
  });
});
