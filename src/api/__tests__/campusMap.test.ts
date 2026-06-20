import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBuildingRooms } from '../campusMap';
import { IndexedDBService } from '../../services/storage';
import { STORAGE_KEYS } from '../../services/storage/keys';
import type { RoomsCollection } from '../../types/campusMap';

const fc = (id: number): RoomsCollection => ({ type: 'FeatureCollection',
  features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[16.6, 49.2]]] },
    properties: { id, buildingId: id, floorId: 1, floorLevel: 0, name: 'X', type: 't',
      category: 'teaching', label: 'l', passportNumber: null, seats: null,
      hasProjector: false, hasWhiteboard: false, code: null } }] });

beforeEach(async () => {
  await IndexedDBService.clear('map_rooms');
  await IndexedDBService.set('meta', STORAGE_KEYS.MAP_ROOMS_LAST_SYNC, {});
  vi.restoreAllMocks();
});

describe('fetchBuildingRooms', () => {
  it('fetches from CDN on cache miss and caches the result (building 0 = Q)', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => fc(0) });
    vi.stubGlobal('fetch', f);
    const out = await fetchBuildingRooms(0);
    expect(f).toHaveBeenCalledOnce();
    expect(f.mock.calls[0][0]).toContain('/map/rooms-0.geojson');
    expect(out?.features[0].properties.buildingId).toBe(0);
    expect(await IndexedDBService.get('map_rooms', '0')).toBeTruthy();
  });

  it('returns cache without fetching when fresh', async () => {
    await IndexedDBService.set('map_rooms', '54678', fc(54678));
    await IndexedDBService.set('meta', STORAGE_KEYS.MAP_ROOMS_LAST_SYNC, { '54678': Date.now() });
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const out = await fetchBuildingRooms(54678);
    expect(f).not.toHaveBeenCalled();
    expect(out?.features[0].properties.buildingId).toBe(54678);
  });

  it('falls back to stale cache when the network fails', async () => {
    await IndexedDBService.set('map_rooms', '510096', fc(510096));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const out = await fetchBuildingRooms(510096);
    expect(out?.features[0].properties.buildingId).toBe(510096);
  });
});
