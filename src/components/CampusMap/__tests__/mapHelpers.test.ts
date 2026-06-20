import { describe, it, expect } from 'vitest';
import { categoryColorVar, shortLabel, lonLatToLatLng, ringToLatLng, searchPlaces } from '../mapHelpers';
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

describe('categoryColorVar', () => {
  it('maps each category to a DaisyUI color var', () => {
    expect(categoryColorVar('teaching')).toBe('--color-warning');
    expect(categoryColorVar('structure')).toBe('--color-base-200');
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
  it('matches a POI name', () => {
    const r = searchPlaces('frrm', index, pois);
    expect(r.some((m) => m.kind === 'poi' && m.poi.name === 'FRRMS')).toBe(true);
  });
  it('returns [] for empty query', () => {
    expect(searchPlaces('  ', index, pois)).toEqual([]);
  });
});
