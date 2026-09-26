import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchBuildingModel } from '../buildingModels';
import { IndexedDBService } from '../../services/storage';
import type { BuildingModel, BuildingModelMeta } from '../../types/buildingModel';

const META: BuildingModelMeta = {
  buildingId: 0,
  name: 'Q',
  anchor: [16.6142, 49.2096],
  baseElevation: 231.66,
  storeys: [{ level: 0, elevation: 0, height: 4 }],
  ground: { a: 0, b: 0, c: 0 },
  radius: 60,
  height: 28.75,
  defaultAzimuthDeg: 215,
  attribution: '3D: © Statutární město Brno, CC BY 4.0',
};
const glb = () => new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]).buffer;

function cdn(ok = true) {
  return vi.fn(async (url: string) => {
    if (!ok) return { ok: false, status: 404 } as Response;
    if (url.endsWith('.glb')) return { ok: true, arrayBuffer: async () => glb() } as Response;
    return { ok: true, json: async () => META } as Response;
  });
}

beforeEach(async () => {
  await IndexedDBService.clear('map_models');
  vi.unstubAllGlobals();
});

describe('fetchBuildingModel', () => {
  it('has nothing to fetch for a building without a model', async () => {
    const f = cdn();
    vi.stubGlobal('fetch', f);
    expect(await fetchBuildingModel(54678)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('downloads Q.glb and Q.json from the reis-data CDN and caches them', async () => {
    const f = cdn();
    vi.stubGlobal('fetch', f);
    const model = await fetchBuildingModel(0);
    const urls = f.mock.calls.map((c) => c[0]);
    expect(urls.some((u) => u.endsWith('/map/3d/Q.glb'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/map/3d/Q.json'))).toBe(true);
    expect(
      urls.every((u) => u.startsWith('https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@'))
    ).toBe(true);
    expect(model?.meta.name).toBe('Q');
    expect(model?.glb.byteLength).toBe(8);
    expect(await IndexedDBService.get('map_models', '0')).toBeTruthy();
  });

  it('serves a fresh cached copy without touching the network', async () => {
    const cached: BuildingModel = { glb: glb(), meta: META, fetchedAt: Date.now() };
    await IndexedDBService.set('map_models', '0', cached);
    const f = cdn();
    vi.stubGlobal('fetch', f);
    expect((await fetchBuildingModel(0))?.meta.name).toBe('Q');
    expect(f).not.toHaveBeenCalled();
  });

  it('falls back to a stale copy when the CDN fails, and to null with no copy at all', async () => {
    vi.stubGlobal('fetch', cdn(false));
    expect(await fetchBuildingModel(0)).toBeNull();
    const stale: BuildingModel = { glb: glb(), meta: META, fetchedAt: Date.now() - 90 * 86400_000 };
    await IndexedDBService.set('map_models', '0', stale);
    expect((await fetchBuildingModel(0))?.fetchedAt).toBe(stale.fetchedAt);
  });
});
