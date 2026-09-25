import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBuildingRooms } from '../campusMap';
import { IndexedDBService } from '../../services/storage';
import { STORAGE_KEYS } from '../../services/storage/keys';
import type { RoomsCollection } from '../../types/campusMap';

const fc = (id: number): RoomsCollection => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[16.6, 49.2]]] },
      properties: {
        id,
        buildingId: id,
        floorId: 1,
        floorLevel: 0,
        name: 'X',
        type: 't',
        category: 'teaching',
        label: 'l',
        passportNumber: null,
        seats: null,
        hasProjector: false,
        hasWhiteboard: false,
        code: null,
      },
    },
  ],
});

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

// BA27N1074 / BA27N1075 are two "hall" strips building M's floor plan draws in
// the open air between the wings — not rooms, not a terrace, nothing a student
// can stand in. They are deleted from the bundled index, but the geometry comes
// from the CDN (and from a 30-day IndexedDB cache), so the only thing that takes
// them off the map for someone who already opened M is a filter on the way out.
const withGhosts = (): RoomsCollection => {
  const base = fc(582134);
  const ghost = (id: number, name: string) => ({
    ...base.features[0]!,
    properties: {
      ...base.features[0]!.properties,
      id,
      name,
      type: 'hall',
      category: 'other' as const,
    },
  });
  return {
    type: 'FeatureCollection',
    features: [...base.features, ghost(585208, 'BA27N1074'), ghost(585217, 'BA27N1075')],
  };
};
const names = (c: RoomsCollection | null) => c!.features.map((f) => f.properties.name);

describe('fetchBuildingRooms drops the out-of-building M halls', () => {
  it('drops them from a fresh CDN response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => withGhosts() }));
    expect(names(await fetchBuildingRooms(582134))).toEqual(['X']);
  });

  it('drops them from a fresh cache hit (nobody re-fetches for 30 days)', async () => {
    await IndexedDBService.set('map_rooms', '582134', withGhosts());
    await IndexedDBService.set('meta', STORAGE_KEYS.MAP_ROOMS_LAST_SYNC, { '582134': Date.now() });
    vi.stubGlobal('fetch', vi.fn());
    expect(names(await fetchBuildingRooms(582134))).toEqual(['X']);
  });

  it('drops them from the stale-cache fallback', async () => {
    await IndexedDBService.set('map_rooms', '582134', withGhosts());
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(names(await fetchBuildingRooms(582134))).toEqual(['X']);
  });
});

// Building X draws X01–X03 and the MENDELU Shop as rows of partitions; the
// merge has to reach a cached copy too, for the same 30-day reason as above.
const withPartitions = (): RoomsCollection => {
  const base = fc(465899);
  const piece = (id: number, name: string) => ({
    ...base.features[0]!,
    properties: { ...base.features[0]!.properties, id, name },
  });
  return {
    type: 'FeatureCollection',
    features: [piece(476013, 'BA25N1001A'), piece(476014, 'BA25N1001B')],
  };
};
const nicknames = (c: RoomsCollection | null) => c!.features.map((f) => f.properties.nickname);

describe('fetchBuildingRooms merges the building X partitions', () => {
  it('merges a fresh CDN response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => withPartitions() })
    );
    expect(nicknames(await fetchBuildingRooms(465899))).toEqual(['X01']);
  });

  it('merges a fresh cache hit', async () => {
    await IndexedDBService.set('map_rooms', '465899', withPartitions());
    await IndexedDBService.set('meta', STORAGE_KEYS.MAP_ROOMS_LAST_SYNC, { '465899': Date.now() });
    vi.stubGlobal('fetch', vi.fn());
    expect(nicknames(await fetchBuildingRooms(465899))).toEqual(['X01']);
  });

  it('merges the stale-cache fallback', async () => {
    await IndexedDBService.set('map_rooms', '465899', withPartitions());
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(nicknames(await fetchBuildingRooms(465899))).toEqual(['X01']);
  });
});
