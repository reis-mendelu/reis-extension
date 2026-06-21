# Campus Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native Campus Map view to reIS — whole-campus overview (7 building footprints + FRRMS/dorms/sports/other POIs as pins) plus indoor floor plans for the 7 academic buildings, with room search, schedule/subject deep-link, and a hover-card rewired off the `mm.mendelu.cz` embed.

**Architecture:** Hybrid data — tiny meta (`buildings.json`, `pois.geojson`, `rooms-index.json`) bundled in the extension; ~1.6 MB room geometry split per-building and served from the `reis-data` jsDelivr CDN, cached in IndexedDB. Rendering uses plain `leaflet` driven imperatively in one component, with **Leaflet's default geographic CRS (EPSG3857) and NO tile layer** (coords are real lat/lon; dropping only the third-party basemap keeps reIS's zero-external-calls stance). State lives in a Zustand `mapSlice`; the active view is the existing `currentView` React state in `useAppLogic`, switched from the sidebar and from a store-driven focus intent.

**Tech Stack:** WXT, React 19, TypeScript (strict), Zustand, IndexedDB (`idb` + `fake-indexeddb` in tests), Tailwind 4 + DaisyUI 5, Vitest + happy-dom, Leaflet (new dep).

Spec: `docs/superpowers/specs/2026-06-20-campus-map-design.md`.

## Global Constraints

- **NO `localStorage`/`sessionStorage`** — persist via `IndexedDBService` only.
- **NO custom CSS** — DaisyUI semantic classes only. Importing `leaflet/dist/leaflet.css` (a dependency stylesheet) is allowed; do not hand-write app CSS. Polygon fills come from DaisyUI theme tokens read at runtime via `getComputedStyle`.
- **NO `useEffect` for data fetching** — fetch in the slice/api, not components. (A `useEffect` that only reacts to a navigation intent is fine; it fetches nothing.)
- **NO proxy/re-export barrels** — import directly from implementation files.
- **Max 200 lines per file** — split if larger.
- **Test first** — write the failing test before implementation for all pure logic and slice/api tasks.
- **`buildingId === 0` is a REAL building (Q).** Never use truthiness (`if (buildingId)`) to mean "no building selected" — use `buildingId === null`. This is the single highest-risk gotcha in this feature.
- **Telemetry:** route non-fatal errors through `logError(context, err)` with contexts `MapSlice.method` / `Api.fetchBuildingRooms`; never pass payload data as `extra`.
- **CDN base** (mirrors `successRate.ts`): `https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main`.
- **Source snapshot** lives in `~/Downloads/mendelu_map` (`mendelu-buildings.json`, `mendelu-rooms.geojson.txt`, `mendelu-pois.geojson.txt`). 7 buildings, ids: A=54678, B=510096, C=489829, E=1279313, M=582134, Q=0, X=465899. 2895 room features, 68 POIs.

---

### Task 1: Map data pipeline — split geometry to reis-data CDN, bundle meta in the extension

**Files:**
- Clone: `../reis-data` (from `https://github.com/reis-mendelu/reis-data.git`)
- Create: `../reis-data/source/{mendelu-buildings.json,mendelu-rooms.geojson,mendelu-pois.geojson}` (pinned snapshot, copied from `~/Downloads/mendelu_map`)
- Create: `../reis-data/scripts/buildMapData.mjs` (splitter/extractor)
- Create (output, committed to reis-data, served by CDN): `../reis-data/map/rooms-<buildingId>.geojson` (7 files)
- Create (output, committed to extension, bundled): `src/data/map/buildings.json`, `src/data/map/pois.json`, `src/data/map/rooms-index.json`
- Test: `src/data/map/__tests__/mapData.test.ts`

**Interfaces:**
- Produces: bundled JSON files imported elsewhere as:
  - `buildings.json` → `BuildingsMeta` (Task 2 type)
  - `pois.json` → `PoiCollection` (Task 2 type) — academic-building duplicates removed
  - `rooms-index.json` → `RoomIndexEntry[]` (Task 2 type): `{ code: string; name: string; buildingId: number; floorId: number; floorLevel: number | null; placeId: number }`
  - CDN file shape `rooms-<buildingId>.geojson` → `RoomsCollection`

- [ ] **Step 1: Clone reis-data as a sibling and add the snapshot**

```bash
git -C .. clone https://github.com/reis-mendelu/reis-data.git
mkdir -p ../reis-data/source ../reis-data/scripts ../reis-data/map
cp ~/Downloads/mendelu_map/mendelu-buildings.json   ../reis-data/source/mendelu-buildings.json
cp ~/Downloads/mendelu_map/mendelu-rooms.geojson.txt ../reis-data/source/mendelu-rooms.geojson
cp ~/Downloads/mendelu_map/mendelu-pois.geojson.txt  ../reis-data/source/mendelu-pois.geojson
cp ~/Downloads/mendelu_map/fetch-mendelu-map.py      ../reis-data/scripts/fetch-mendelu-map.py
mkdir -p src/data/map
```

- [ ] **Step 2: Write the splitter script**

Create `../reis-data/scripts/buildMapData.mjs`:

```js
// Splits the pinned MENDELU map snapshot into:
//   - per-building room geometry  -> reis-data/map/rooms-<id>.geojson   (served via CDN)
//   - bundled meta (buildings/pois/rooms-index) -> ../reis-extension/src/data/map/
// Run: node scripts/buildMapData.mjs   (from the reis-data repo root)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ext = resolve(root, '..', 'reis-extension', 'src', 'data', 'map');
const read = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));

const buildings = read('source/mendelu-buildings.json');
const rooms = read('source/mendelu-rooms.geojson');
const pois = read('source/mendelu-pois.geojson');

const buildingIds = new Set(buildings.buildings.map((b) => b.id));
const buildingNames = new Set(buildings.buildings.map((b) => b.name)); // "A".."X"

// 1) Per-building room geometry -> CDN dir
mkdirSync(resolve(root, 'map'), { recursive: true });
for (const id of buildingIds) {
  const fc = { type: 'FeatureCollection',
    features: rooms.features.filter((f) => f.properties.buildingId === id) };
  writeFileSync(resolve(root, `map/rooms-${id}.geojson`), JSON.stringify(fc));
}

// 2) Lightweight room search index (no geometry) -> bundled
mkdirSync(ext, { recursive: true });
const index = rooms.features
  .filter((f) => f.properties.category !== 'structure' && (f.properties.name || '').trim() !== '')
  .map((f) => {
    const p = f.properties;
    return { code: p.passportNumber ?? p.name, name: p.name,
      buildingId: p.buildingId, floorId: p.floorId, floorLevel: p.floorLevel, placeId: p.id };
  });
writeFileSync(resolve(ext, 'rooms-index.json'), JSON.stringify(index));

// 3) Bundled buildings meta (verbatim) + POIs with academic-building duplicates removed
writeFileSync(resolve(ext, 'buildings.json'), JSON.stringify(buildings));
const cleanPois = { type: 'FeatureCollection',
  features: pois.features.filter((f) => {
    const t = f.properties.type, n = f.properties.name;
    // drop the academic-building pins (drawn as footprints already)
    return !(t === 'indoor_building' || (t === 'building' && buildingNames.has(n)));
  }) };
writeFileSync(resolve(ext, 'pois.json'), JSON.stringify(cleanPois));

console.log(`buildings=${buildings.buildings.length} pois=${cleanPois.features.length} index=${index.length}`);
```

- [ ] **Step 3: Run the splitter and verify counts**

Run: `node ../reis-data/scripts/buildMapData.mjs`
Expected: prints `buildings=7 pois=<~48> index=<~2100>`; creates 7 `../reis-data/map/rooms-*.geojson` and 3 files in `src/data/map/`.

- [ ] **Step 4: Write the failing data-integrity test**

Create `src/data/map/__tests__/mapData.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import buildings from '../buildings.json';
import pois from '../pois.json';
import index from '../rooms-index.json';

describe('bundled map data', () => {
  it('has 7 academic buildings each with a defaultFloorId', () => {
    expect(buildings.buildings).toHaveLength(7);
    for (const b of buildings.buildings) expect(b.defaultFloorId).not.toBeNull();
  });

  it('every room-index entry references a real building + floor', () => {
    const floorByBuilding = new Map(
      buildings.buildings.map((b) => [b.id, new Set(b.floors.map((f) => f.id))]),
    );
    for (const e of index as { buildingId: number; floorId: number; code: string }[]) {
      expect(floorByBuilding.has(e.buildingId)).toBe(true);
      expect(floorByBuilding.get(e.buildingId)!.has(e.floorId)).toBe(true);
      expect(e.code.length).toBeGreaterThan(0);
    }
  });

  it('POIs exclude the 7 academic-building pins (no double-draw)', () => {
    const names = new Set(buildings.buildings.map((b) => b.name));
    for (const f of pois.features) {
      expect(f.properties.type).not.toBe('indoor_building');
      if (f.properties.type === 'building') expect(names.has(f.properties.name)).toBe(false);
    }
  });

  it('includes Q (buildingId 0) — truthiness gotcha guard', () => {
    expect(buildings.buildings.some((b) => b.id === 0 && b.name === 'Q')).toBe(true);
  });
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/data/map/__tests__/mapData.test.ts`
Expected: PASS (4 tests). If `defaultFloorId` is null for any building, that is real source data — adjust the assertion to `toBeDefined()` and note it; do not edit the source.

- [ ] **Step 6: Commit reis-data and push, then commit the extension's bundled files**

```bash
git -C ../reis-data add source scripts map
git -C ../reis-data commit -m "feat(map): pinned MENDELU map snapshot + per-building room splits"
git -C ../reis-data push origin main
git add src/data/map/buildings.json src/data/map/pois.json src/data/map/rooms-index.json src/data/map/__tests__/mapData.test.ts
git commit -m "feat(map): bundle campus map meta (buildings, pois, room index)"
```

---

### Task 2: Types + pure map helpers

**Files:**
- Create: `src/types/campusMap.ts`
- Create: `src/components/CampusMap/mapHelpers.ts`
- Test: `src/components/CampusMap/__tests__/mapHelpers.test.ts`

**Interfaces:**
- Produces (types): `RoomCategory`, `RoomProperties`, `RoomFeature`, `RoomsCollection`, `Floor`, `Building`, `BuildingsMeta`, `PoiProperties`, `PoiFeature`, `PoiCollection`, `RoomIndexEntry`, `MapSelection`.
- Produces (helpers):
  - `categoryColorVar(c: RoomCategory): string` — DaisyUI CSS-var name, e.g. `--color-warning`.
  - `shortLabel(name: string): string`
  - `lonLatToLatLng(c: [number, number]): [number, number]`
  - `ringToLatLng(ring: number[][]): [number, number][]`
  - `searchPlaces(query: string, index: RoomIndexEntry[], pois: PoiFeature[], limit?: number): MapSelection[]`

- [ ] **Step 1: Write the types file** (no test — consumed by helper signatures below)

Create `src/types/campusMap.ts` (port of `~/Downloads/mendelu_map/mendelu-map.types.ts`):

```ts
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

export interface RoomIndexEntry {
  code: string; name: string; buildingId: number;
  floorId: number; floorLevel: number | null; placeId: number;
}

// Unified selection for the detail panel and search results.
export type MapSelection =
  | { kind: 'room'; room: RoomProperties }
  | { kind: 'roomRef'; entry: RoomIndexEntry }   // from search/deep-link before geometry loads
  | { kind: 'poi'; poi: PoiProperties; coord: [number, number] };
```

- [ ] **Step 2: Write the failing helper test**

Create `src/components/CampusMap/__tests__/mapHelpers.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/mapHelpers.test.ts`
Expected: FAIL — cannot find module `../mapHelpers`.

- [ ] **Step 4: Write the helpers**

Create `src/components/CampusMap/mapHelpers.ts`:

```ts
import type { RoomCategory, RoomIndexEntry, PoiFeature, MapSelection } from '../../types/campusMap';

const COLOR_VARS: Record<RoomCategory, string> = {
  teaching: '--color-warning',
  office: '--color-info',
  service: '--color-base-300',
  circulation: '--color-success',
  structure: '--color-base-200',
  other: '--color-secondary',
};

export function categoryColorVar(c: RoomCategory): string {
  return COLOR_VARS[c] ?? COLOR_VARS.other;
}

export function shortLabel(name: string): string {
  return name.match(/[NPS]\d+$/)?.[0] ?? name;
}

export function lonLatToLatLng(c: [number, number]): [number, number] {
  return [c[1], c[0]];
}

export function ringToLatLng(ring: number[][]): [number, number][] {
  return ring.map((c) => [c[1], c[0]] as [number, number]);
}

export function searchPlaces(
  query: string, index: RoomIndexEntry[], pois: PoiFeature[], limit = 12,
): MapSelection[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rooms: MapSelection[] = index
    .filter((e) => e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
    .map((entry) => ({ kind: 'roomRef', entry }));
  const places: MapSelection[] = pois
    .filter((f) => f.properties.name.toLowerCase().includes(q))
    .map((f) => ({ kind: 'poi', poi: f.properties, coord: f.geometry.coordinates }));
  return [...rooms, ...places].slice(0, limit);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/CampusMap/__tests__/mapHelpers.test.ts`
Expected: PASS (all). Then `npx tsc --noEmit -p tsconfig.json` (or `npm run typecheck`) — expect 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/campusMap.ts src/components/CampusMap/mapHelpers.ts src/components/CampusMap/__tests__/mapHelpers.test.ts
git commit -m "feat(map): campus map types + pure helpers (colors, labels, coord flip, search)"
```

---

### Task 3: IndexedDB store plumbing + `fetchBuildingRooms` API

**Files:**
- Modify: `src/services/storage/IndexedDBService.ts` (add `map_rooms` to `ReisDB`, to `requiredStores`, bump `DB_VERSION` 20 → 21)
- Modify: `src/types/storage.ts` (add `map_rooms` schema to `StoreSchemas`)
- Modify: `src/services/storage/keys.ts` (add `MAP_ROOMS_LAST_SYNC`)
- Create: `src/api/campusMap.ts`
- Test: `src/api/__tests__/campusMap.test.ts`

**Interfaces:**
- Consumes: `RoomsCollection` (Task 2), `IndexedDBService`, `STORAGE_KEYS`.
- Produces: `fetchBuildingRooms(buildingId: number): Promise<RoomsCollection | null>` — returns cache when fresh, fetches CDN on miss/stale, writes cache, falls back to cache on network failure.

- [ ] **Step 1: Add the IDB store + schema + key + version bump**

In `src/services/storage/IndexedDBService.ts`, add to the `ReisDB` interface (after `zaznamnik`):

```ts
    map_rooms: {
        key: string;        // String(buildingId), e.g. "0" for Q
        value: import('../../types/campusMap').RoomsCollection;
    };
```

Add `'map_rooms'` to the `requiredStores` array, and change `const DB_VERSION = 20;` to `const DB_VERSION = 21;`.

In `src/types/storage.ts`, add to the `StoreSchemas` object:

```ts
    map_rooms: z.custom<import('../types/campusMap').RoomsCollection>(),
```

In `src/services/storage/keys.ts`, add inside `STORAGE_KEYS`:

```ts
    // Campus map per-building room geometry TTL (keyed by buildingId)
    MAP_ROOMS_LAST_SYNC: 'reis_map_rooms_sync',
```

- [ ] **Step 2: Write the failing API test**

Create `src/api/__tests__/campusMap.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBuildingRooms } from '../campusMap';
import { IndexedDBService } from '../../services/storage';
import { STORAGE_KEYS } from '../../services/storage/keys';

const fc = (id: number) => ({ type: 'FeatureCollection',
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/api/__tests__/campusMap.test.ts`
Expected: FAIL — cannot find module `../campusMap`.

- [ ] **Step 4: Write the API**

Create `src/api/campusMap.ts`:

```ts
import { IndexedDBService } from '../services/storage';
import { STORAGE_KEYS } from '../services/storage/keys';
import { loggers } from '../utils/logger';
import { logError } from '../utils/reportError';
import type { RoomsCollection } from '../types/campusMap';

const CDN_BASE_URL = 'https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main';
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

async function lastSync(buildingId: number): Promise<number | undefined> {
  const map = (await IndexedDBService.get('meta', STORAGE_KEYS.MAP_ROOMS_LAST_SYNC)) as Record<string, number> | undefined;
  return map?.[String(buildingId)];
}
async function markSynced(buildingId: number): Promise<void> {
  const map = ((await IndexedDBService.get('meta', STORAGE_KEYS.MAP_ROOMS_LAST_SYNC)) as Record<string, number>) || {};
  map[String(buildingId)] = Date.now();
  await IndexedDBService.set('meta', STORAGE_KEYS.MAP_ROOMS_LAST_SYNC, map);
}

export async function fetchBuildingRooms(buildingId: number): Promise<RoomsCollection | null> {
  const key = String(buildingId);
  const cached = (await IndexedDBService.get('map_rooms', key)) as RoomsCollection | undefined;
  const ts = await lastSync(buildingId);
  if (cached && ts && Date.now() - ts < CACHE_EXPIRY) return cached;

  try {
    const res = await fetch(`${CDN_BASE_URL}/map/rooms-${key}.geojson`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as RoomsCollection;
    await IndexedDBService.set('map_rooms', key, data);
    await markSynced(buildingId);
    return data;
  } catch (err) {
    logError('Api.fetchBuildingRooms', err);
    if (cached) return cached; // stale-but-usable
    loggers.api.error('[CampusMap] no cache fallback for building', key);
    return null;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/api/__tests__/campusMap.test.ts`
Expected: PASS (3 tests). Then `npm run typecheck` — expect 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/services/storage/IndexedDBService.ts src/types/storage.ts src/services/storage/keys.ts src/api/campusMap.ts src/api/__tests__/campusMap.test.ts
git commit -m "feat(map): map_rooms IDB store + fetchBuildingRooms CDN cache"
```

---

### Task 4: `mapSlice` — state, building/floor/selection, focus intent

**Files:**
- Modify: `src/store/types.ts` (add `MapSlice` interface; add `MapSlice` to `AppState`)
- Create: `src/store/slices/createMapSlice.ts`
- Modify: `src/store/useAppStore.ts` (compose `createMapSlice`)
- Test: `src/store/slices/__tests__/createMapSlice.test.ts`

**Interfaces:**
- Consumes: `fetchBuildingRooms` (Task 3), bundled `buildings.json`/`rooms-index.json` (Task 1), types + `searchPlaces` (Task 2).
- Produces (slice shape):
  - state: `activeBuildingId: number | null`, `activeFloorId: number | null`, `mapSelection: MapSelection | null`, `roomsByBuilding: Record<number, RoomsCollection>`, `mapLoadingBuilding: number | null`, `mapSearchQuery: string`, `mapSearchResults: MapSelection[]`, `mapFocusRequest: number` (monotonic counter — bumped to ask the app to switch to the map view).
  - actions: `setMapBuilding(id: number)`, `exitToCampus()`, `setMapFloor(floorId: number)`, `selectMapRoom(room)`, `selectMapPoi(poi, coord)`, `setMapSearchQuery(q)`, `focusRoomByCode(code: string)`, `focusPoiById(id: number)`, `loadMapBuilding(id: number)`.

- [ ] **Step 1: Add the slice type to `src/store/types.ts`**

Add import at top: `import type { RoomsCollection, MapSelection, PoiProperties, RoomProperties } from '../types/campusMap';`
Then add the interface below, and append `& MapSlice` to the `export type AppState = …` intersection at the bottom of the file (it ends with `… & import('./slices/createPersonProfileSlice').PersonProfileSlice;` — change to `… & PersonProfileSlice & MapSlice;`, or simply append ` & MapSlice` before the semicolon):

```ts
export interface MapSlice {
  activeBuildingId: number | null;
  activeFloorId: number | null;
  mapSelection: MapSelection | null;
  roomsByBuilding: Record<number, RoomsCollection>;
  mapLoadingBuilding: number | null;
  mapSearchQuery: string;
  mapSearchResults: MapSelection[];
  mapFocusRequest: number;
  setMapBuilding: (id: number) => void;
  exitToCampus: () => void;
  setMapFloor: (floorId: number) => void;
  selectMapRoom: (room: RoomProperties) => void;
  selectMapPoi: (poi: PoiProperties, coord: [number, number]) => void;
  setMapSearchQuery: (q: string) => void;
  focusRoomByCode: (code: string) => void;
  focusPoiById: (id: number) => void;
  loadMapBuilding: (id: number) => Promise<void>;
}
```

- [ ] **Step 2: Write the failing slice test**

Create `src/store/slices/__tests__/createMapSlice.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../api/campusMap', () => ({ fetchBuildingRooms: vi.fn() }));
import { fetchBuildingRooms } from '../../../api/campusMap';
import { useAppStore } from '../../useAppStore';

const fc = (id: number, floorId: number) => ({ type: 'FeatureCollection',
  features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[16.6, 49.2]]] },
    properties: { id: 1, buildingId: id, floorId, floorLevel: 0, name: 'Q01', type: 't',
      category: 'teaching', label: 'l', passportNumber: null, seats: null,
      hasProjector: false, hasWhiteboard: false, code: null } }] });

beforeEach(() => {
  useAppStore.setState({ activeBuildingId: null, activeFloorId: null, mapSelection: null,
    roomsByBuilding: {}, mapLoadingBuilding: null, mapSearchQuery: '', mapSearchResults: [], mapFocusRequest: 0 });
  vi.mocked(fetchBuildingRooms).mockReset();
});

describe('mapSlice', () => {
  it('setMapBuilding(0) selects Q and its default floor (truthiness gotcha)', () => {
    useAppStore.getState().setMapBuilding(0);
    expect(useAppStore.getState().activeBuildingId).toBe(0);
    expect(useAppStore.getState().activeFloorId).not.toBeNull(); // Q.defaultFloorId
  });

  it('exitToCampus clears building + selection', () => {
    useAppStore.getState().setMapBuilding(54678);
    useAppStore.getState().exitToCampus();
    expect(useAppStore.getState().activeBuildingId).toBeNull();
    expect(useAppStore.getState().mapSelection).toBeNull();
  });

  it('loadMapBuilding caches geometry from the api', async () => {
    vi.mocked(fetchBuildingRooms).mockResolvedValue(fc(54678, 7));
    await useAppStore.getState().loadMapBuilding(54678);
    expect(useAppStore.getState().roomsByBuilding[54678]?.features).toHaveLength(1);
  });

  it('focusRoomByCode resolves the index, sets building/floor/selection, and bumps the focus request', () => {
    const before = useAppStore.getState().mapFocusRequest;
    useAppStore.getState().focusRoomByCode('Q01'); // exists in bundled index (building 0)
    const s = useAppStore.getState();
    expect(s.activeBuildingId).toBe(0);
    expect(s.mapSelection?.kind).toBe('roomRef');
    expect(s.mapFocusRequest).toBe(before + 1);
  });

  it('setMapSearchQuery populates results', () => {
    useAppStore.getState().setMapSearchQuery('Q01');
    expect(useAppStore.getState().mapSearchResults.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/store/slices/__tests__/createMapSlice.test.ts`
Expected: FAIL — `setMapBuilding is not a function` (slice not composed yet).

- [ ] **Step 4: Write the slice**

Create `src/store/slices/createMapSlice.ts`:

```ts
import type { AppSlice, MapSlice } from '../types';
import type { BuildingsMeta, RoomIndexEntry, PoiFeature, MapSelection } from '../../types/campusMap';
import buildingsJson from '../../data/map/buildings.json';
import roomsIndexJson from '../../data/map/rooms-index.json';
import poisJson from '../../data/map/pois.json';
import { searchPlaces } from '../../components/CampusMap/mapHelpers';
import { fetchBuildingRooms } from '../../api/campusMap';
import { logError } from '../../utils/reportError';

const META = buildingsJson as BuildingsMeta;
const INDEX = roomsIndexJson as RoomIndexEntry[];
const POIS = (poisJson as { features: PoiFeature[] }).features;

const buildingById = (id: number) => META.buildings.find((b) => b.id === id) ?? null;

export const createMapSlice: AppSlice<MapSlice> = (set, get) => ({
  activeBuildingId: null,
  activeFloorId: null,
  mapSelection: null,
  roomsByBuilding: {},
  mapLoadingBuilding: null,
  mapSearchQuery: '',
  mapSearchResults: [],
  mapFocusRequest: 0,

  setMapBuilding: (id) => {
    const b = buildingById(id);
    if (!b) return;
    set({ activeBuildingId: id, activeFloorId: b.defaultFloorId ?? b.floors[0]?.id ?? null, mapSelection: null });
    void get().loadMapBuilding(id);
  },

  exitToCampus: () => set({ activeBuildingId: null, activeFloorId: null, mapSelection: null }),

  setMapFloor: (floorId) => set({ activeFloorId: floorId, mapSelection: null }),

  selectMapRoom: (room) => set({ mapSelection: { kind: 'room', room } }),
  selectMapPoi: (poi, coord) => set({ mapSelection: { kind: 'poi', poi, coord } }),

  setMapSearchQuery: (q) => set({ mapSearchQuery: q, mapSearchResults: searchPlaces(q, INDEX, POIS) }),

  focusRoomByCode: (code) => {
    const entry = INDEX.find((e) => e.code === code || e.name === code);
    if (!entry) { logError('MapSlice.focusRoomByCode', new Error(`unknown room ${code}`)); return; }
    const b = buildingById(entry.buildingId);
    set({
      activeBuildingId: entry.buildingId,
      activeFloorId: entry.floorId,
      mapSelection: { kind: 'roomRef', entry } as MapSelection,
      mapFocusRequest: get().mapFocusRequest + 1,
    });
    if (b) void get().loadMapBuilding(entry.buildingId);
  },

  focusPoiById: (id) => {
    const f = POIS.find((p) => p.properties.id === id);
    if (!f) { logError('MapSlice.focusPoiById', new Error(`unknown poi ${id}`)); return; }
    set({
      activeBuildingId: null, activeFloorId: null,
      mapSelection: { kind: 'poi', poi: f.properties, coord: f.geometry.coordinates },
      mapFocusRequest: get().mapFocusRequest + 1,
    });
  },

  loadMapBuilding: async (id) => {
    if (get().roomsByBuilding[id]) return; // already in memory
    set({ mapLoadingBuilding: id });
    try {
      const data = await fetchBuildingRooms(id);
      if (data) set({ roomsByBuilding: { ...get().roomsByBuilding, [id]: data } });
    } catch (err) {
      logError('MapSlice.loadMapBuilding', err);
    } finally {
      set({ mapLoadingBuilding: get().mapLoadingBuilding === id ? null : get().mapLoadingBuilding });
    }
  },
});
```

- [ ] **Step 5: Compose the slice in `src/store/useAppStore.ts`**

Add the import near the other slice imports:

```ts
import { createMapSlice } from './slices/createMapSlice';
```

Add to the `create<AppState>()` object (anywhere among the spreads):

```ts
  ...createMapSlice(...a),
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/store/slices/__tests__/createMapSlice.test.ts`
Expected: PASS (5 tests). Then `npm run typecheck` — expect 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/store/types.ts src/store/slices/createMapSlice.ts src/store/useAppStore.ts src/store/slices/__tests__/createMapSlice.test.ts
git commit -m "feat(map): mapSlice — building/floor/selection state + focus intent"
```

---

### Task 5: Leaflet dependency + imperative `MapCanvas`

> DOM rendering of Leaflet is not unit-tested in happy-dom (no real layout). This task is verified by typecheck + production build + manual smoke once the view is wired (Task 7). Keep `MapCanvas.tsx` ≤ 200 lines.

**Files:**
- Modify: `package.json` (add `leaflet` + `@types/leaflet`)
- Create: `src/components/CampusMap/MapCanvas.tsx`

**Interfaces:**
- Consumes: `useAppStore` map state/actions (Task 4), `ringToLatLng`/`shortLabel`/`categoryColorVar` (Task 2), `buildings.json`/`pois.json`.
- Produces: `<MapCanvas />` — self-contained Leaflet map; reads `activeBuildingId`/`activeFloorId`/`roomsByBuilding`/`mapFocusRequest`, calls `setMapBuilding`/`selectMapRoom`/`selectMapPoi`.

- [ ] **Step 1: Install Leaflet**

Run: `npm i leaflet@^1.9.4 && npm i -D @types/leaflet@^1.9.12`
Expected: both added to `package.json`; `npm run typecheck` still 0 errors.

- [ ] **Step 2: Write `MapCanvas.tsx`**

Create `src/components/CampusMap/MapCanvas.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppStore } from '../../store/useAppStore';
import buildingsJson from '../../data/map/buildings.json';
import poisJson from '../../data/map/pois.json';
import { ringToLatLng, shortLabel, categoryColorVar } from './mapHelpers';
import type { BuildingsMeta, PoiFeature, RoomFeature } from '../../types/campusMap';

const META = buildingsJson as BuildingsMeta;
const POIS = (poisJson as { features: PoiFeature[] }).features;

function themeColor(varName: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || '#cccccc';
}

export function MapCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup>(L.layerGroup());

  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const activeFloorId = useAppStore((s) => s.activeFloorId);
  const roomsByBuilding = useAppStore((s) => s.roomsByBuilding);
  const focusReq = useAppStore((s) => s.mapFocusRequest);

  // init once
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: false, minZoom: 14, maxZoom: 22 })
      .fitBounds(META.campus.bounds as L.LatLngBoundsExpression);
    layerRef.current.addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // draw campus overview or the active floor
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const layer = layerRef.current; layer.clearLayers();
    const select = useAppStore.getState();

    if (activeBuildingId === null) {
      for (const b of META.buildings) {
        L.polygon(ringToLatLng(b.outline.coordinates[0]), {
          color: themeColor('--color-base-content'), weight: 1,
          fillColor: themeColor('--color-primary'), fillOpacity: 0.18,
        }).on('click', () => select.setMapBuilding(b.id)).bindTooltip(b.name).addTo(layer);
      }
      for (const f of POIS) {
        const [lon, lat] = f.geometry.coordinates;
        L.circleMarker([lat, lon], { radius: 6, color: themeColor('--color-secondary'),
          fillColor: themeColor('--color-secondary'), fillOpacity: 0.9 })
          .on('click', () => select.selectMapPoi(f.properties, f.geometry.coordinates))
          .bindTooltip(f.properties.name).addTo(layer);
      }
      map.flyToBounds(META.campus.bounds as L.LatLngBoundsExpression, { maxZoom: 18, padding: [40, 40] });
      return;
    }

    const fc = roomsByBuilding[activeBuildingId];
    const b = META.buildings.find((x) => x.id === activeBuildingId);
    if (b) map.flyToBounds(b.bounds as L.LatLngBoundsExpression, { maxZoom: 21, padding: [50, 50] });
    if (!fc) return; // geometry still loading
    const feats = fc.features.filter((f) => f.properties.floorId === activeFloorId)
      .sort((a) => (a.properties.category === 'structure' ? -1 : 1));
    for (const f of feats as RoomFeature[]) {
      const p = f.properties, struct = p.category === 'structure';
      const poly = L.polygon(ringToLatLng(f.geometry.coordinates[0]), {
        color: themeColor('--color-base-content'), weight: struct ? 0.6 : 1,
        fillColor: themeColor(categoryColorVar(p.category)),
        fillOpacity: struct ? 0.35 : 0.8, interactive: !struct,
      });
      if (!struct) {
        poly.on('click', () => select.selectMapRoom(p));
        if (p.name) poly.bindTooltip(shortLabel(p.name), { permanent: false, direction: 'center' });
      }
      poly.addTo(layer);
    }
  }, [activeBuildingId, activeFloorId, roomsByBuilding, focusReq]);

  return <div ref={ref} className="absolute inset-0" />;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: 0 errors. (Visual verification happens in Task 7.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/CampusMap/MapCanvas.tsx
git commit -m "feat(map): leaflet dep + imperative MapCanvas (no tiles)"
```

---

### Task 6: Sub-components — BuildingBar, FloorStack, DetailPanel, RoomSearch

**Files:**
- Create: `src/components/CampusMap/BuildingBar.tsx`
- Create: `src/components/CampusMap/FloorStack.tsx`
- Create: `src/components/CampusMap/DetailPanel.tsx`
- Create: `src/components/CampusMap/RoomSearch.tsx`
- Test: `src/components/CampusMap/__tests__/RoomSearch.test.tsx`, `src/components/CampusMap/__tests__/DetailPanel.test.tsx`

**Interfaces:**
- Consumes: map slice state/actions (Task 4), `buildings.json`, `useTranslation`.
- Produces: four presentational components reading/writing the store.

- [ ] **Step 1: Write the failing component tests**

Create `src/components/CampusMap/__tests__/RoomSearch.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoomSearch } from '../RoomSearch';
import { useAppStore } from '../../../store/useAppStore';

beforeEach(() => useAppStore.setState({ mapSearchQuery: '', mapSearchResults: [], activeBuildingId: null }));

describe('RoomSearch', () => {
  it('shows results as the user types and focuses on click', async () => {
    render(<RoomSearch />);
    await userEvent.type(screen.getByRole('textbox'), 'Q01');
    const hit = await screen.findByText(/Q01/);
    await userEvent.click(hit);
    expect(useAppStore.getState().activeBuildingId).toBe(0); // Q
  });
});
```

Create `src/components/CampusMap/__tests__/DetailPanel.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DetailPanel } from '../DetailPanel';
import { useAppStore } from '../../../store/useAppStore';

beforeEach(() => useAppStore.setState({ mapSelection: null }));

describe('DetailPanel', () => {
  it('renders a POI with a "no floor plan" note', () => {
    useAppStore.setState({ mapSelection: { kind: 'poi',
      poi: { id: 1, name: 'FRRMS', type: 'building', url: 'http://x', phone: null, email: null },
      coord: [16.6, 49.2] } });
    render(<DetailPanel />);
    expect(screen.getByText('FRRMS')).toBeInTheDocument();
    expect(screen.getByText(/no floor plan|Žádný plán/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/CampusMap/__tests__/RoomSearch.test.tsx src/components/CampusMap/__tests__/DetailPanel.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `BuildingBar.tsx`**

```tsx
import { useAppStore } from '../../store/useAppStore';
import buildingsJson from '../../data/map/buildings.json';
import type { BuildingsMeta } from '../../types/campusMap';

const META = buildingsJson as BuildingsMeta;

export function BuildingBar() {
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const setMapBuilding = useAppStore((s) => s.setMapBuilding);
  const exitToCampus = useAppStore((s) => s.exitToCampus);
  return (
    <div className="flex items-center gap-1 p-1 bg-base-200 rounded-lg">
      <button className={`btn btn-sm ${activeBuildingId === null ? 'btn-primary' : 'btn-ghost'}`}
        onClick={exitToCampus}>⌂</button>
      {META.buildings.map((b) => (
        <button key={b.id}
          className={`btn btn-sm ${activeBuildingId === b.id ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setMapBuilding(b.id)}>{b.name}</button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write `FloorStack.tsx`**

```tsx
import { useAppStore } from '../../store/useAppStore';
import buildingsJson from '../../data/map/buildings.json';
import type { BuildingsMeta } from '../../types/campusMap';

const META = buildingsJson as BuildingsMeta;

export function FloorStack() {
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const activeFloorId = useAppStore((s) => s.activeFloorId);
  const setMapFloor = useAppStore((s) => s.setMapFloor);
  if (activeBuildingId === null) return null;
  const b = META.buildings.find((x) => x.id === activeBuildingId);
  if (!b) return null;
  return (
    <div className="flex flex-col gap-1 p-1 bg-base-200 rounded-lg">
      {b.floors.map((f) => (
        <button key={f.id}
          className={`btn btn-xs ${activeFloorId === f.id ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setMapFloor(f.id)}>{f.name ?? f.level}</button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Write `DetailPanel.tsx`**

```tsx
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

export function DetailPanel() {
  const { t } = useTranslation();
  const sel = useAppStore((s) => s.mapSelection);
  if (!sel) return null;

  if (sel.kind === 'poi') {
    const p = sel.poi;
    return (
      <div className="p-4 bg-base-100 border border-base-300 rounded-lg space-y-1">
        <h3 className="font-bold text-base-content">{p.name}</h3>
        <p className="text-sm text-base-content/60">{p.type}</p>
        {p.url && <a className="link link-primary text-sm" href={p.url} target="_blank" rel="noopener noreferrer">{p.url}</a>}
        {p.phone && <p className="text-sm">{p.phone}</p>}
        {p.email && <p className="text-sm">{p.email}</p>}
        <p className="text-xs text-base-content/50 pt-2">{t('map.noFloorPlan')}</p>
      </div>
    );
  }

  const r = sel.kind === 'room' ? sel.room : null;
  const name = r ? (r.passportNumber ?? r.name) : sel.entry.code;
  return (
    <div className="p-4 bg-base-100 border border-base-300 rounded-lg space-y-1">
      <h3 className="font-bold text-base-content">{name}</h3>
      {r && <p className="text-sm text-base-content/60">{r.label}</p>}
      {r?.seats != null && <p className="text-sm">{t('map.seats')}: {r.seats}</p>}
      {r?.hasProjector && <span className="badge badge-sm badge-info mr-1">{t('map.projector')}</span>}
      {r?.hasWhiteboard && <span className="badge badge-sm badge-info">{t('map.whiteboard')}</span>}
      {r?.passportNumber && <p className="text-xs text-base-content/50 pt-1">{r.passportNumber}</p>}
    </div>
  );
}
```

- [ ] **Step 6: Write `RoomSearch.tsx`**

```tsx
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

export function RoomSearch() {
  const { t } = useTranslation();
  const query = useAppStore((s) => s.mapSearchQuery);
  const results = useAppStore((s) => s.mapSearchResults);
  const setQuery = useAppStore((s) => s.setMapSearchQuery);
  const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);
  const focusPoiById = useAppStore((s) => s.focusPoiById);

  return (
    <div className="relative w-64">
      <input className="input input-sm input-bordered w-full" value={query} placeholder={t('map.searchPlaceholder')}
        onChange={(e) => setQuery(e.target.value)} />
      {results.length > 0 && (
        <ul className="absolute z-[1000] mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-md max-h-64 overflow-auto">
          {results.map((m, i) => (
            <li key={i}>
              <button className="w-full text-left px-3 py-1.5 hover:bg-base-200 text-sm"
                onClick={() => { if (m.kind === 'poi') focusPoiById(m.poi.id);
                  else if (m.kind === 'roomRef') focusRoomByCode(m.entry.code); setQuery(''); }}>
                {m.kind === 'poi' ? m.poi.name : m.entry.code}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Add i18n keys** (also used by Task 7/9)

In `src/i18n/locales/cs.json` add a top-level `"map"` object: `{ "title": "Mapa", "searchPlaceholder": "Hledat místnost nebo místo…", "noFloorPlan": "Žádný plán podlaží není k dispozici.", "seats": "Míst", "projector": "Projektor", "whiteboard": "Tabule", "showOnMap": "Zobrazit na mapě" }`.
In `src/i18n/locales/en.json` add: `{ "title": "Map", "searchPlaceholder": "Search a room or place…", "noFloorPlan": "No floor plan available.", "seats": "Seats", "projector": "Projector", "whiteboard": "Whiteboard", "showOnMap": "Show on map" }`.
Add `"map": "Mapa"` / `"map": "Map"` under the existing `sidebar` object in each locale (for the menu label).

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/components/CampusMap/__tests__/RoomSearch.test.tsx src/components/CampusMap/__tests__/DetailPanel.test.tsx`
Expected: PASS. Then `npm run typecheck`.

- [ ] **Step 9: Commit**

```bash
git add src/components/CampusMap/BuildingBar.tsx src/components/CampusMap/FloorStack.tsx src/components/CampusMap/DetailPanel.tsx src/components/CampusMap/RoomSearch.tsx src/components/CampusMap/__tests__/RoomSearch.test.tsx src/components/CampusMap/__tests__/DetailPanel.test.tsx src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(map): BuildingBar, FloorStack, DetailPanel, RoomSearch + i18n"
```

---

### Task 7: `CampusMapView` shell + wire the new view (AppView, AppMain, Sidebar, MainItems)

**Files:**
- Create: `src/components/CampusMap/CampusMapView.tsx`
- Modify: `src/types/app.ts` (add `'map'` to `AppView`)
- Modify: `src/components/AppMain.tsx` (render `CampusMapView`)
- Modify: `src/components/Sidebar.tsx` (map `item.id === 'map'` → `onViewChange('map')`)
- Modify: `src/components/Menu/MainItems.tsx` (add a `map` menu item)

**Interfaces:**
- Consumes: `MapCanvas`, `BuildingBar`, `FloorStack`, `DetailPanel`, `RoomSearch`.
- Produces: `<CampusMapView />`; `AppView` now includes `'map'`.

- [ ] **Step 1: Add `'map'` to `AppView`**

In `src/types/app.ts` change the union to include `'map'`:

```ts
export type AppView = 'calendar' | 'exams' | 'settings' | 'timeline-demo' | 'subjects' | 'studyPlan' | 'erasmus' | 'iskam-dashboard' | 'map';
```

- [ ] **Step 2: Write `CampusMapView.tsx`**

```tsx
import { MapCanvas } from './MapCanvas';
import { BuildingBar } from './BuildingBar';
import { FloorStack } from './FloorStack';
import { DetailPanel } from './DetailPanel';
import { RoomSearch } from './RoomSearch';
import { useAppStore } from '../../store/useAppStore';

export function CampusMapView() {
  const selection = useAppStore((s) => s.mapSelection);
  return (
    <div className="relative w-full h-full">
      <MapCanvas />
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2">
        <BuildingBar />
        <RoomSearch />
      </div>
      <div className="absolute top-3 right-3 z-[1000]"><FloorStack /></div>
      {selection && (
        <div className="absolute bottom-3 left-3 z-[1000] w-72"><DetailPanel /></div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Render it in `AppMain.tsx`**

Add the import: `import { CampusMapView } from './CampusMap/CampusMapView';`
Add inside the content `<div>` (next to the other `currentView === …` lines):

```tsx
                    {currentView === 'map' && <CampusMapView />}
```

- [ ] **Step 4: Add the menu item in `MainItems.tsx`**

Add `Map` to the lucide import (`import { …, Map } from 'lucide-react';`) and add this item to the returned array (after `subjects`):

```tsx
    { id: 'map', label: t('sidebar.map'), icon: <Map className="w-5 h-5" /> },
```

- [ ] **Step 5: Wire the click in `Sidebar.tsx`**

In the `onClick` id→view chain, add:

```tsx
                  else if (item.id === 'map') onViewChange('map');
```

- [ ] **Step 6: Build and smoke-test manually**

Run: `npm run build`
Expected: exit 0. Then `npm run dev`, open the extension on `is.mendelu.cz`, click the **Map** sidebar item. Verify: campus overview shows 7 footprints + POI pins; clicking a footprint loads its floor (network tab shows ONE `cdn.jsdelivr.net/.../map/rooms-<id>.geojson` request, NO `cartocdn`/tile/`mm.mendelu.cz` requests); floor stack switches floors; tapping a room shows the detail panel; search finds `Q01` and flies to Q.

- [ ] **Step 7: Commit**

```bash
git add src/types/app.ts src/components/CampusMap/CampusMapView.tsx src/components/AppMain.tsx src/components/Menu/MainItems.tsx src/components/Sidebar.tsx
git commit -m "feat(map): CampusMapView shell + wire Map view into nav"
```

---

### Task 8: Deep-link bridge + "Show on map" affordances

**Files:**
- Modify: `src/hooks/useAppLogic.ts` (bridge `mapFocusRequest` → `setCurrentView('map')`)
- Modify: schedule event card — `src/components/CalendarEventCard.tsx` (add "Show on map" when a room is present)
- Modify: subject drawer room meta — `src/components/SubjectFileDrawer/Header/CourseMeta.tsx` (add "Show on map")
- Test: covered by the existing `createMapSlice` focus test (Task 4) + manual smoke.

**Interfaces:**
- Consumes: `focusRoomByCode` (Task 4), `mapFocusRequest` (Task 4).
- Produces: any component can call `useAppStore.getState().focusRoomByCode(code)` to jump to the map.

- [ ] **Step 1: Add the navigation bridge in `useAppLogic.ts`**

After the `currentView` state is declared, add (this `useEffect` reacts to an intent counter — it fetches nothing, so it does not violate the data-fetch rule):

```ts
    const mapFocusRequest = useAppStore((s) => s.mapFocusRequest);
    const didMountFocus = useRef(false);
    useEffect(() => {
        if (!didMountFocus.current) { didMountFocus.current = true; return; }
        setCurrentView('map');
    }, [mapFocusRequest]);
```

Ensure `useRef` and `useAppStore` are imported in the file (they are already used elsewhere; add if missing).

- [ ] **Step 2: Add "Show on map" to the schedule event card**

In `src/components/CalendarEventCard.tsx`, where the room/`mistnost` is rendered, add a button shown only when a room string exists:

```tsx
{room && (
  <button className="btn btn-ghost btn-xs gap-1"
    onClick={() => useAppStore.getState().focusRoomByCode(room.replace(/\s*\([^)]*\)\s*$/, '').trim())}>
    {t('map.showOnMap')}
  </button>
)}
```

(Import `useAppStore` and `useTranslation` if not already present. `room` is the existing room field on the lesson — match the variable already used in this file; if it is named differently, e.g. `lesson.room`, use that.)

- [ ] **Step 3: Add "Show on map" to the subject drawer room meta**

In `src/components/SubjectFileDrawer/Header/CourseMeta.tsx` (the file that currently uses `MapHoverCard`), add next to the room name a small button calling `useAppStore.getState().focusRoomByCode(<roomName>)` using the same `roomName` value passed to `MapHoverCard`.

- [ ] **Step 4: Build + manual smoke**

Run: `npm run build`
Expected: exit 0. Then in `npm run dev`: from a calendar event with a room, click **Show on map** → app switches to the Map view focused on that room's building/floor with the room selected. Same from the subject drawer.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAppLogic.ts src/components/CalendarEventCard.tsx src/components/SubjectFileDrawer/Header/CourseMeta.tsx
git commit -m "feat(map): deep-link bridge + 'Show on map' from schedule and subject drawer"
```

---

### Task 9: Rewire `MapHoverCard` — SVG thumbnail + "Show on Campus Map"

> Replaces the `mm.mendelu.cz` iframe embed (the last third-party map call). The hover card draws a cheap static SVG of the room on its floor — no Leaflet instance per hover.

**Files:**
- Create: `src/components/CampusMap/RoomThumbnail.tsx`
- Create: `src/components/CampusMap/thumbnail.ts` (pure projection math)
- Modify: `src/components/MapHoverCard.tsx` (drop iframe; use `RoomThumbnail` + focus button)
- Test: `src/components/CampusMap/__tests__/thumbnail.test.ts`

**Interfaces:**
- Consumes: `roomsByBuilding`/`loadMapBuilding`/`focusRoomByCode` (Task 4), `rooms-index.json`, `ringToLatLng` (Task 2).
- Produces: `projectRing(ring, box): string` (SVG points) and `<RoomThumbnail roomName={…} />`.

- [ ] **Step 1: Write the failing projection test**

Create `src/components/CampusMap/__tests__/thumbnail.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { projectRing } from '../thumbnail';

describe('projectRing', () => {
  it('maps a lat/lng ring into the SVG box, flipping Y', () => {
    const ring: [number, number][] = [[49.20, 16.60], [49.20, 16.62], [49.22, 16.62], [49.22, 16.60]];
    const pts = projectRing(ring, { w: 100, h: 100, pad: 0 },
      { minLat: 49.20, maxLat: 49.22, minLng: 16.60, maxLng: 16.62 });
    // first vertex is bottom-left -> x=0, y=h (Y flipped)
    expect(pts.split(' ')[0]).toBe('0,100');
    // a top-right vertex -> x=100, y=0
    expect(pts).toContain('100,0');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/thumbnail.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the projection math**

Create `src/components/CampusMap/thumbnail.ts`:

```ts
export interface Box { w: number; h: number; pad: number; }
export interface Extent { minLat: number; maxLat: number; minLng: number; maxLng: number; }

export function projectRing(ring: [number, number][], box: Box, ext: Extent): string {
  const sx = (box.w - 2 * box.pad) / (ext.maxLng - ext.minLng || 1);
  const sy = (box.h - 2 * box.pad) / (ext.maxLat - ext.minLat || 1);
  return ring.map(([lat, lng]) => {
    const x = box.pad + (lng - ext.minLng) * sx;
    const y = box.h - box.pad - (lat - ext.minLat) * sy; // flip Y for screen coords
    return `${Math.round(x)},${Math.round(y)}`;
  }).join(' ');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/CampusMap/__tests__/thumbnail.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `RoomThumbnail.tsx`**

```tsx
import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import roomsIndexJson from '../../data/map/rooms-index.json';
import { ringToLatLng } from './mapHelpers';
import { projectRing, type Extent } from './thumbnail';
import type { RoomIndexEntry, RoomFeature } from '../../types/campusMap';

const INDEX = roomsIndexJson as RoomIndexEntry[];
const BOX = { w: 380, h: 240, pad: 8 };

export function RoomThumbnail({ roomName }: { roomName: string }) {
  const entry = useMemo(() => INDEX.find((e) => e.code === roomName || e.name === roomName), [roomName]);
  const rooms = useAppStore((s) => (entry ? s.roomsByBuilding[entry.buildingId] : undefined));
  const loadMapBuilding = useAppStore((s) => s.loadMapBuilding);

  useEffect(() => { if (entry && !rooms) void loadMapBuilding(entry.buildingId); }, [entry, rooms, loadMapBuilding]);

  if (!entry) return <div className="flex-1 flex items-center justify-center text-base-content/40 text-sm">—</div>;
  if (!rooms) return <div className="flex-1 flex items-center justify-center"><span className="loading loading-spinner loading-md" /></div>;

  const floor = rooms.features.filter((f) => f.properties.floorId === entry.floorId) as RoomFeature[];
  const rings = floor.map((f) => ringToLatLng(f.geometry.coordinates[0]));
  const all = rings.flat();
  const ext: Extent = {
    minLat: Math.min(...all.map((p) => p[0])), maxLat: Math.max(...all.map((p) => p[0])),
    minLng: Math.min(...all.map((p) => p[1])), maxLng: Math.max(...all.map((p) => p[1])),
  };
  return (
    <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} className="w-full h-full">
      {floor.map((f, i) => {
        const isTarget = f.properties.id === entry.placeId;
        return <polygon key={i} points={projectRing(ringToLatLng(f.geometry.coordinates[0]), BOX, ext)}
          className={isTarget ? 'fill-primary stroke-primary-content' : 'fill-base-300 stroke-base-content/20'}
          strokeWidth={isTarget ? 1.5 : 0.5} />;
      })}
    </svg>
  );
}
```

- [ ] **Step 6: Rewire `MapHoverCard.tsx`**

Remove the `mapUrl`/`<iframe>` block. Replace the iframe region with `<RoomThumbnail roomName={normalizedRoom} />`, and replace the "Open Full Map" external link with a button that calls `useAppStore.getState().focusRoomByCode(normalizedRoom)` and shows `t('map.showOnMap')`. Add imports `import { RoomThumbnail } from './CampusMap/RoomThumbnail';`, `import { useAppStore } from '../store/useAppStore';`, `import { useTranslation } from '../hooks/useTranslation';`. Keep the existing portal/positioning logic unchanged.

- [ ] **Step 7: Verify build + existing tests**

Run: `npm run build && npm run test:run`
Expected: build exit 0; all tests pass. Manually: hover a room name in the subject drawer → SVG thumbnail with the target room highlighted; click "Show on Campus Map" → switches to the Map view focused on the room. Confirm no `mm.mendelu.cz` request fires on hover.

- [ ] **Step 8: Commit**

```bash
git add src/components/CampusMap/RoomThumbnail.tsx src/components/CampusMap/thumbnail.ts src/components/CampusMap/__tests__/thumbnail.test.ts src/components/MapHoverCard.tsx
git commit -m "feat(map): rewire MapHoverCard to native SVG thumbnail + Show on Campus Map"
```

---

## Final verification

Run all gates and confirm green before declaring done:

```bash
npm run test:run     # all unit tests pass
npm run typecheck    # 0 errors
npm run lint         # 0 errors (suppress lint inline only if it would force a parser/data edit)
npm run build        # exit 0
```

Manual acceptance (the user's goal): open **Map** → whole campus visible (7 buildings + FRRMS + dorms + sports centre + other pins); **search a specific room** (e.g. `Q01`) flies to it; click a building → floor plans load from the CDN; tap a room → detail; **no third-party map requests** (no tiles, no `mm.mendelu.cz`) in the network tab.

## Spec coverage check

- Whole-campus overview (buildings + FRRMS/dorms/sports POIs) → Tasks 1, 5, 7 ✓
- Indoor floor plans, 7 buildings → Tasks 1, 5, 7 ✓
- Plain Leaflet, no tiles, theme colors → Tasks 2, 5 ✓
- Room search (codes + POI names) → Tasks 2, 6 ✓
- Deep-link from schedule/subject → Task 8 ✓
- Hover-card rewire (SVG thumbnail + button) → Task 9 ✓
- Hybrid delivery (bundled meta + per-building CDN + IDB cache) → Tasks 1, 3 ✓
- buildingId 0 (Q) gotcha → Tasks 1, 3, 4 explicit guards ✓
- Deferred (Pasportizace join, routing, PostGIS) → not implemented, by design ✓
