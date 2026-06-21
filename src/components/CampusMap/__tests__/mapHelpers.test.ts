import { describe, it, expect } from 'vitest';
import { shortLabel, lonLatToLatLng, ringToLatLng, searchPlaces } from '../mapHelpers';
import type { RoomIndexEntry, PoiFeature } from '../../../types/campusMap';

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
    expect(ringToLatLng([[16.6, 49.2], [16.7, 49.3]])).toEqual([[49.2, 16.6], [49.3, 16.7]]);
  });
});

describe('searchPlaces', () => {
  const index: RoomIndexEntry[] = [
    { code: 'Q01', name: 'Q01', buildingId: 0, floorId: 9, floorLevel: 0, placeId: 1 },
    { code: 'BA04N3047', name: 'BA04N3047', buildingId: 54678, floorId: 7, floorLevel: 3, placeId: 2 },
  ];
  const pois = [{ type: 'Feature', geometry: { type: 'Point', coordinates: [16.6, 49.2] },
    properties: { id: 9, name: 'FRRMS', type: 'building', url: null, phone: null, email: null } }] as PoiFeature[];

  it('matches a room code case-insensitively', () => {
    const r = searchPlaces('q01', index, pois);
    expect(r[0]).toMatchObject({ kind: 'roomRef', entry: { code: 'Q01' } });
  });
  it('ranks an exact name match above substring children, regardless of index order', () => {
    // Children listed first; the exact "Q01" hall is buried later in the array.
    const withChildren: RoomIndexEntry[] = [
      { code: 'BA39P1009', name: 'Q01.09', buildingId: 0, floorId: 5, floorLevel: 0, placeId: 10 },
      { code: 'BA39P1014', name: 'Q01.14', buildingId: 0, floorId: 5, floorLevel: 0, placeId: 11 },
      { code: 'BA39N1009', name: 'Q01', buildingId: 0, floorId: 9, floorLevel: 0, placeId: 1 },
    ];
    const r = searchPlaces('Q01', withChildren, pois);
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
    const names = searchPlaces('Q0', mixed, pois)
      .filter((m): m is Extract<typeof m, { kind: 'roomRef' }> => m.kind === 'roomRef')
      .map((m) => m.entry.name);
    // Both bare halls come before either dotted room.
    expect(names.indexOf('Q01')).toBeLessThan(names.indexOf('Q01.09'));
    expect(names.indexOf('Q06')).toBeLessThan(names.indexOf('Q01.43'));
  });
  it('matches a POI name', () => {
    const r = searchPlaces('frrm', index, pois);
    expect(r.some((m) => m.kind === 'poi' && m.poi.name === 'FRRMS')).toBe(true);
  });
  it('returns [] for empty query', () => {
    expect(searchPlaces('  ', index, pois)).toEqual([]);
  });
});
