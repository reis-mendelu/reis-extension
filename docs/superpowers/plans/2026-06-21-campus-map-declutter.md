# Campus Map De-clutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip visual noise from the campus map — outline-only rooms/buildings, a clean Positron basemap, cafeteria-only dots, OSM-sourced landmark outlines, outline-as-navigation (no `BuildingBar`), and clustered off-screen edge arrows.

**Architecture:** All map drawing lives in one Leaflet effect inside `MapCanvas.tsx`; we change styles and add a sibling-outline + landmark-outline pass, swap the tile source, and gate POI drawing through an allowlist. New landmark data is sourced once from OpenStreetMap via a committed dev script and shipped as static JSON. A new `EdgeIndicators` overlay reads the live Leaflet map (exposed through a tiny module singleton) and renders clustered arrows for off-screen landmarks, with all fiddly geometry isolated in a pure, unit-tested `edgeIndicator.ts`.

**Tech Stack:** WXT + React 19, Leaflet, TypeScript (strict), Tailwind 4 + DaisyUI 5, Vitest (happy-dom). Map data is static JSON under `src/data/map/`.

## Global Constraints

- **Max 200 lines per file** — split if larger (`MapCanvas.tsx` is the file most at risk; keep helpers factored).
- **NO custom CSS** — DaisyUI semantic classes only (`btn`, `btn-xs`, `btn-circle`, `bg-base-100`, etc.).
- **Direct imports only** — no re-export barrels.
- **NO `localStorage`/`sessionStorage`** — not relevant here, but do not introduce it.
- **Test first** — for pure helpers (`searchPlaces`, `edgeAnchor`, `clusterLandmarks`) write the failing Vitest first. Leaflet/DOM render code is not unit-tested; its "test" is `npm run build` exit 0 + `npm run typecheck` + `npm run lint` clean, per the spec's Testing section.
- **Run `npm run build` after changes** and confirm exit 0 before claiming a render task done (user preference).
- **Coordinate convention:** GeoJSON/data arrays are `[lon, lat]`; Leaflet wants `[lat, lng]`. `ringToLatLng` / `lonLatToLatLng` do the flip. `selectMapPoi(poi, coord)` takes `coord` as `[lon, lat]`.
- **Dropped POIs stay in `pois.json`** so they remain searchable; only the *drawn* set shrinks.
- **Parser rule does not apply** — these are map JSON/TSX files, not IS Mendelu HTML parsers.

---

### Task 1: Basemap → CartoDB Positron

Swap the OSM raster tile layer for CartoDB Positron `light_all`, which kills baked-in tree dots and most street/POI labels and serves one native zoom level higher.

**Files:**
- Modify: `src/components/CampusMap/MapCanvas.tsx:33-38` (the `L.tileLayer(...)` call in the init effect)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new (internal style change).

- [ ] **Step 1: Replace the tile layer**

In `MapCanvas.tsx`, replace the existing OSM `L.tileLayer(...)` block (lines 33-38, the comment + the `L.tileLayer('https://{s}.tile.openstreetmap.org/...')` call) with:

```ts
    // CartoDB Positron: clean grey basemap with no tree dots and minimal
    // labels. Free, keyless, retina-aware. maxNativeZoom 20 (one better than
    // OSM's 19) reduces upscaling blur at floor-zoom levels.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 22,
      maxNativeZoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);
```

- [ ] **Step 2: Build to verify it compiles**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/CampusMap/MapCanvas.tsx
git commit -m "feat(map): swap OSM tiles for CartoDB Positron basemap"
```

---

### Task 2: Rooms → outline only + delete dead color code

Non-selected, non-structure rooms become transparent-fill outlines; only the selected room keeps its filled highlight. This makes `categoryColorVar()` / `COLOR_VARS` unused — delete them and their test.

**Files:**
- Modify: `src/components/CampusMap/mapHelpers.ts:1-14` (remove `COLOR_VARS` + `categoryColorVar`, fix the type import)
- Modify: `src/components/CampusMap/MapCanvas.tsx` (drop `categoryColorVar` from the import on line 7; change the per-room style in the floor draw loop, lines 85-90)
- Test: `src/components/CampusMap/__tests__/mapHelpers.test.ts` (remove the `categoryColorVar` import + `describe('categoryColorVar', …)` block)

**Interfaces:**
- Consumes: `ringToLatLng`, `shortLabel` from `mapHelpers` (unchanged).
- Produces: `mapHelpers.ts` no longer exports `categoryColorVar` or `COLOR_VARS`. `RoomCategory` type stays exported/used elsewhere.

- [ ] **Step 1: Update the failing test first (remove the dead-code test)**

In `mapHelpers.test.ts`, change the import on line 2 from:

```ts
import { categoryColorVar, shortLabel, lonLatToLatLng, ringToLatLng, searchPlaces } from '../mapHelpers';
```
to:
```ts
import { shortLabel, lonLatToLatLng, ringToLatLng, searchPlaces } from '../mapHelpers';
```

Then delete the entire block (lines 25-30):

```ts
describe('categoryColorVar', () => {
  it('maps each category to a DaisyUI color var', () => {
    expect(categoryColorVar('teaching')).toBe('--color-warning');
    expect(categoryColorVar('structure')).toBe('--color-base-200');
  });
});
```

- [ ] **Step 2: Run the test file to confirm it still loads (should now fail to import once helper is gone — but first it passes since helper still exists)**

Run: `npx vitest run src/components/CampusMap/__tests__/mapHelpers.test.ts`
Expected: PASS (the `categoryColorVar` block is gone; remaining tests pass). This confirms the test file is valid before we delete the helper.

- [ ] **Step 3: Delete the dead color code from `mapHelpers.ts`**

Change the first import line (line 1) from:

```ts
import type { RoomCategory, RoomIndexEntry, PoiFeature, MapSelection } from '../../types/campusMap';
```
to:
```ts
import type { RoomIndexEntry, PoiFeature, MapSelection } from '../../types/campusMap';
```

Delete lines 3-14 entirely (the `COLOR_VARS` const and the `categoryColorVar` function):

```ts
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
```

- [ ] **Step 4: Drop the import in `MapCanvas.tsx`**

Change line 7 from:

```ts
import { ringToLatLng, shortLabel, categoryColorVar } from './mapHelpers';
```
to:
```ts
import { ringToLatLng, shortLabel } from './mapHelpers';
```

- [ ] **Step 5: Make non-selected rooms outline-only**

In the floor draw loop, replace the `L.polygon(...)` style object (lines 85-90) with outline-only styling for non-selected, non-structure rooms. The selected room and `structure` shells keep their fill:

```ts
      const poly = L.polygon(ringToLatLng(f.geometry.coordinates[0]), {
        color: isSel ? themeColor('--color-primary') : themeColor('--color-base-content'),
        weight: isSel ? 3 : struct ? 0.6 : 1,
        fillColor: isSel ? themeColor('--color-primary') : themeColor('--color-base-200'),
        fillOpacity: isSel ? 0.6 : struct ? 0.35 : 0,
        interactive: !struct,
        bubblingMouseEvents: false,
      });
```

(The `bubblingMouseEvents: false` is required by Task 4's basemap-click-to-exit — a room click must not also bubble to the map. Adding it now is harmless.)

- [ ] **Step 6: Run the test file again**

Run: `npx vitest run src/components/CampusMap/__tests__/mapHelpers.test.ts`
Expected: PASS.

- [ ] **Step 7: Build + typecheck + lint**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: all exit 0 (no "categoryColorVar is not exported" / unused-import errors).

- [ ] **Step 8: Commit**

```bash
git add src/components/CampusMap/mapHelpers.ts src/components/CampusMap/MapCanvas.tsx src/components/CampusMap/__tests__/mapHelpers.test.ts
git commit -m "feat(map): render rooms as outlines; drop dead category-color code"
```

---

### Task 3: POI markers → cafeterias only

Filter the overview POI loop through an allowlist so only the 5 cafeteria dots draw. Dropped POIs stay in `pois.json` (still searchable).

**Files:**
- Modify: `src/components/CampusMap/MapCanvas.tsx` (the overview POI loop, lines 57-63; add the allowlist near the top-of-module consts)

**Interfaces:**
- Consumes: `POIS` (existing module const). 
- Produces: nothing new.

- [ ] **Step 1: Add the allowlist const**

Just below `const POIS = ...` (line 11) in `MapCanvas.tsx`, add:

```ts
// Only cafeterias are drawn as dots. Everything else (bus stops, gates,
// gatehouse, ticket machine, parking, generic letter buildings) stays in
// pois.json for search but is removed from the map to cut clutter.
const DRAWN_POI_TYPES = new Set(['cafeteria']);
```

- [ ] **Step 2: Filter the POI draw loop**

Change the overview POI loop header (line 57) from:

```ts
      for (const f of POIS) {
```
to:
```ts
      for (const f of POIS.filter((p) => DRAWN_POI_TYPES.has(p.properties.type))) {
```

Also add `bubblingMouseEvents: false` to the `circleMarker` options so a future basemap-click handler is not triggered by a cafeteria click. Change the `L.circleMarker(...)` options (lines 59-60) to:

```ts
        L.circleMarker([lat, lon], { radius: 6, color: themeColor('--color-secondary'),
          fillColor: themeColor('--color-secondary'), fillOpacity: 0.9, bubblingMouseEvents: false })
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/CampusMap/MapCanvas.tsx
git commit -m "feat(map): draw only cafeteria POI dots (allowlist)"
```

---

### Task 4: Building outlines + sibling navigation + basemap-click-to-exit

Drillable building overview becomes a clean stroke (no tint). In floor-view, every *other* campus building draws as a faint clickable outline — clicking one refocuses. Clicking the bare basemap exits to overview; `bubblingMouseEvents: false` on polygons keeps outline clicks from also exiting.

**Files:**
- Modify: `src/components/CampusMap/MapCanvas.tsx` (overview building loop lines 51-55; add a sibling-outline pass + a map `click` exit handler managed by a ref in the floor-view branch)

**Interfaces:**
- Consumes: `select.setMapBuilding(id)`, `select.exitToCampus()` (existing store actions), `META.buildings`.
- Produces: a `exitHandlerRef` pattern other tasks don't depend on.

- [ ] **Step 1: Add a ref to hold the exit handler**

In `MapCanvas()`, just below `const layerRef = useRef<L.LayerGroup>(L.layerGroup());` (line 21), add:

```ts
  const exitHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);
```

- [ ] **Step 2: Restyle overview building outlines**

In the draw effect, replace the overview building loop (lines 51-55) with a clean stroke (no fill):

```ts
      for (const b of META.buildings) {
        L.polygon(ringToLatLng(b.outline.coordinates[0]), {
          color: themeColor('--color-base-content'), weight: 1.5, fillOpacity: 0,
          bubblingMouseEvents: false,
        }).on('click', () => select.setMapBuilding(b.id)).bindTooltip(b.name).addTo(layer);
      }
```

- [ ] **Step 3: Clear any stale exit handler at the top of the effect**

At the very start of the draw effect, right after `const select = useAppStore.getState();` (line 48), add:

```ts
    if (exitHandlerRef.current) { map.off('click', exitHandlerRef.current); exitHandlerRef.current = null; }
```

This guarantees the overview never carries a leftover exit handler (a stray basemap click in overview must do nothing).

- [ ] **Step 4: In floor-view, draw sibling outlines + register the exit handler**

In the floor-view part of the effect (after `const fc = roomsByBuilding[activeBuildingId];` and the `if (!fc)` early-return block, i.e. just before `const sel = select.mapSelection;` on line 76), insert:

```ts
    // Sibling building outlines stay drawn in floor-view and ARE the
    // navigation: click one to refocus. No BuildingBar needed.
    for (const sib of META.buildings) {
      if (sib.id === activeBuildingId) continue;
      L.polygon(ringToLatLng(sib.outline.coordinates[0]), {
        color: themeColor('--color-base-content'), weight: 1, opacity: 0.4, fillOpacity: 0,
        bubblingMouseEvents: false,
      }).on('click', () => select.setMapBuilding(sib.id)).bindTooltip(sib.name).addTo(layer);
    }
    // Clicking the bare basemap (not an outline/room) returns to overview.
    const onMapClick = () => select.exitToCampus();
    map.on('click', onMapClick);
    exitHandlerRef.current = onMapClick;
```

- [ ] **Step 5: Build + typecheck**

Run: `npm run build && npm run typecheck`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/CampusMap/MapCanvas.tsx
git commit -m "feat(map): outline buildings, sibling-outline navigation, click-to-exit"
```

---

### Task 5: Remove `BuildingBar`

The sibling outlines (Task 4) replace the filter row, and empty-basemap-click replaces the home button. Delete `BuildingBar.tsx` and drop it from `CampusMapView`.

**Files:**
- Delete: `src/components/CampusMap/BuildingBar.tsx`
- Modify: `src/components/CampusMap/CampusMapView.tsx` (remove import + usage)

**Interfaces:**
- Consumes: nothing new.
- Produces: `CampusMapView` no longer renders `BuildingBar`; the top-left toolbar holds only `RoomSearch`.

- [ ] **Step 1: Delete the component file**

```bash
git rm src/components/CampusMap/BuildingBar.tsx
```

- [ ] **Step 2: Remove it from `CampusMapView.tsx`**

Delete the import line (line 2):

```ts
import { BuildingBar } from './BuildingBar';
```

And change the top-left toolbar block (lines 13-15) from:

```tsx
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2">
        <BuildingBar />
        <RoomSearch />
      </div>
```
to:
```tsx
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2">
        <RoomSearch />
      </div>
```

- [ ] **Step 3: Build + typecheck + lint**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: all exit 0 (no dangling `BuildingBar` import; `exitToCampus` is still used by `MapCanvas`, so the store action is not orphaned).

- [ ] **Step 4: Commit**

```bash
git add -A src/components/CampusMap/
git commit -m "feat(map): remove BuildingBar (sibling outlines + click-to-exit replace it)"
```

---

### Task 6: Landmark type + OSM-sourced data

Add the `Landmark` type, a committed one-off Overpass fetch script, the generated `landmarks.json`, and remove the 8 moved entries from `pois.json`.

**Files:**
- Modify: `src/types/campusMap.ts` (add `Landmark` interface + `landmark` variant to `MapSelection`)
- Create: `scripts/fetch-landmarks.mjs` (dev-only; committed for reproducibility, not bundled)
- Create: `src/data/map/landmarks.json` (script output)
- Modify: `src/data/map/pois.json` (remove ids 1569, 1582, 1585, 1587, 1588, 1611, 1616, 1623)

**Interfaces:**
- Produces: `Landmark` interface (consumed by Tasks 7, 8, 10) with shape:
  ```ts
  interface Landmark {
    id: number; name: string; type: string;
    url: string | null; phone: string | null; email: string | null;
    outline: { type: 'Polygon'; coordinates: number[][][] };
  }
  ```
  and `MapSelection` gains `| { kind: 'landmark'; landmark: Landmark }`.
  `landmarks.json` shape: `{ "landmarks": Landmark[] }`.

- [ ] **Step 1: Add the `Landmark` type + `MapSelection` variant**

In `src/types/campusMap.ts`, after the `PoiCollection` interface (line 38), add:

```ts
export interface Landmark {
  id: number; name: string; type: string;
  url: string | null; phone: string | null; email: string | null;
  outline: { type: 'Polygon'; coordinates: number[][][] };
}
```

Then change the `MapSelection` union (lines 46-49) to add a landmark variant:

```ts
// Unified selection for the detail panel and search results.
export type MapSelection =
  | { kind: 'room'; room: RoomProperties }
  | { kind: 'roomRef'; entry: RoomIndexEntry }   // from search/deep-link before geometry loads
  | { kind: 'poi'; poi: PoiProperties; coord: [number, number] }
  | { kind: 'landmark'; landmark: Landmark };    // search result only; resolves to a poi selection on focus
```

- [ ] **Step 2: Write the Overpass fetch script**

Create `scripts/fetch-landmarks.mjs`:

```js
// Dev-only, run once: sources building footprints for the 8 campus landmarks
// from OpenStreetMap (Overpass), and writes src/data/map/landmarks.json.
// NOT part of the shipped bundle — the JSON output is committed instead.
//
// Usage: node scripts/fetch-landmarks.mjs
//
// For each landmark point we ask Overpass for building ways within 40 m and
// pick the footprint whose centroid is nearest the point. Misses are logged
// loudly so they can be hand-checked rather than silently shipping a wrong
// polygon (mirrors the project's "needs real evidence" rule for parsers).

import { writeFileSync } from 'node:fs';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

// id, name, type, url, phone, email, [lon, lat] — copied from pois.json.
const LANDMARKS = [
  { id: 1569, name: 'Koleje JAK Blok A', type: 'dormitory', url: 'http://skm.mendelu.cz/ubytovani/ubytovaci-zarizeni/27982-koleje-jak', phone: '+420 545 128 340', email: 'skm.koleje.jak@mendelu.cz', lon: 16.630584, lat: 49.216233 },
  { id: 1585, name: 'Koleje JAK Blok B', type: 'dormitory', url: 'http://skm.mendelu.cz/ubytovani/ubytovaci-zarizeni/27982-koleje-jak', phone: '+420 545 128 340', email: 'skm.koleje.jak@mendelu.cz', lon: 16.630844, lat: 49.215418 },
  { id: 1611, name: 'Koleje JAK Blok C', type: 'dormitory', url: 'http://skm.mendelu.cz/ubytovani/ubytovaci-zarizeni/27982-koleje-jak', phone: '+420 545 128 340', email: 'skm.koleje.jak@mendelu.cz', lon: 16.631388, lat: 49.216166 },
  { id: 1582, name: 'Koleje JAK Blok D', type: 'dormitory', url: 'http://skm.mendelu.cz/ubytovani/ubytovaci-zarizeni/27982-koleje-jak', phone: '+420 545 128 340', email: 'skm.koleje.jak@mendelu.cz', lon: 16.630004, lat: 49.215601 },
  { id: 1588, name: 'Tauferovy koleje', type: 'dormitory', url: 'http://skm.mendelu.cz/ubytovani/ubytovaci-zarizeni/27988-tauferovy-koleje', phone: '+420 541 422 051', email: 'jitka.chebenova@mendelu.cz', lon: 16.588826, lat: 49.214599 },
  { id: 1616, name: 'Kolej Akademie', type: 'dormitory', url: 'http://skm.mendelu.cz/ubytovani/ubytovaci-zarizeni/27987-kolej-akademie', phone: '+420 545 136 117', email: 'skm.koleje.akademie@mendelu.cz', lon: 16.614198, lat: 49.218173 },
  { id: 1587, name: 'Fakulta regionálního rozvoje a mezinárodních studií (FRRMS)', type: 'building', url: 'http://frrms.mendelu.cz', phone: '+420 545 136 306', email: 'info.frrms@mendelu.cz', lon: 16.614118, lat: 49.218161 },
  { id: 1623, name: 'Centrum sportovních aktivit MENDELU', type: 'building', url: 'http://csa.mendelu.cz', phone: '+420 541 212 698', email: 'jakub.havel@mendelu.cz', lon: 16.588579, lat: 49.21517 },
];

const ringCentroid = (ring) => {
  let lon = 0, lat = 0;
  for (const [x, y] of ring) { lon += x; lat += y; }
  return [lon / ring.length, lat / ring.length];
};
const dist2 = (aLon, aLat, bLon, bLat) => (aLon - bLon) ** 2 + (aLat - bLat) ** 2;

async function fetchFootprint(lm) {
  const q = `[out:json][timeout:25];way[building](around:40,${lm.lat},${lm.lon});out geom;`;
  const res = await fetch(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(q) });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status} for ${lm.id}`);
  const json = await res.json();
  const ways = (json.elements || []).filter((e) => e.type === 'way' && Array.isArray(e.geometry));
  if (ways.length === 0) { console.warn(`MISS: no building way near ${lm.id} ${lm.name} — hand-check`); return null; }
  let best = null, bestD = Infinity;
  for (const w of ways) {
    const ring = w.geometry.map((g) => [g.lon, g.lat]);
    const [clon, clat] = ringCentroid(ring);
    const d = dist2(clon, clat, lm.lon, lm.lat);
    if (d < bestD) { bestD = d; best = ring; }
  }
  // Ensure the ring is closed.
  if (best && (best[0][0] !== best[best.length - 1][0] || best[0][1] !== best[best.length - 1][1])) best.push(best[0]);
  return best;
}

const out = [];
for (const lm of LANDMARKS) {
  let ring = null;
  try { ring = await fetchFootprint(lm); } catch (e) { console.warn(`ERROR ${lm.id}: ${e.message}`); }
  if (!ring) { console.warn(`SKIPPED ${lm.id} ${lm.name} — no footprint, fill in by hand`); continue; }
  out.push({ id: lm.id, name: lm.name, type: lm.type, url: lm.url, phone: lm.phone, email: lm.email, outline: { type: 'Polygon', coordinates: [ring] } });
  await new Promise((r) => setTimeout(r, 1200)); // be polite to Overpass
}

writeFileSync(new URL('../src/data/map/landmarks.json', import.meta.url), JSON.stringify({ landmarks: out }, null, 2) + '\n');
console.log(`Wrote ${out.length}/${LANDMARKS.length} landmark footprints. Verify any MISS/SKIPPED above.`);
```

- [ ] **Step 3: Run the script to generate `landmarks.json`**

Run: `node scripts/fetch-landmarks.mjs`
Expected: console prints `Wrote N/8 landmark footprints.` and creates `src/data/map/landmarks.json`. Read the log: any `MISS`/`SKIPPED`/`ERROR` line means that landmark needs a hand-supplied ring before shipping. If FRRMS (1587) and Kolej Akademie (1616) resolve to the same footprint, that is expected (the note in the spec) — keep both metadata entries.

If Overpass is unreachable in this environment, this step is the one human/network dependency — flag it; do not fabricate polygons.

- [ ] **Step 4: Sanity-check the generated JSON**

Run: `node -e "const d=require('./src/data/map/landmarks.json'); console.log('landmarks:', d.landmarks.length); for (const l of d.landmarks) console.log(l.id, l.name, 'verts', l.outline.coordinates[0].length); if (d.landmarks.some(l=>l.outline.coordinates[0].length<4)) throw new Error('a ring has <4 vertices');"`
Expected: prints one line per landmark, each with ≥4 vertices, no throw.

- [ ] **Step 5: Remove the 8 moved entries from `pois.json`**

Run: `node -e "const fs=require('fs');const p='./src/data/map/pois.json';const d=JSON.parse(fs.readFileSync(p));const drop=new Set([1569,1582,1585,1587,1588,1611,1616,1623]);const before=d.features.length;d.features=d.features.filter(f=>!drop.has(f.properties.id));fs.writeFileSync(p, JSON.stringify(d,null,2)+'\n');console.log('pois:', before, '->', d.features.length);"`
Expected: prints `pois: 62 -> 54`.

- [ ] **Step 6: Typecheck (data + type only; no render wiring yet)**

Run: `npm run typecheck`
Expected: exit 0 (the new `Landmark` type and `landmarks.json` are valid; nothing imports them yet).

- [ ] **Step 7: Commit**

```bash
git add src/types/campusMap.ts scripts/fetch-landmarks.mjs src/data/map/landmarks.json src/data/map/pois.json
git commit -m "feat(map): add Landmark type + OSM-sourced landmark footprints; move 8 POIs out"
```

---

### Task 7: Landmark search + `focusLandmarkById`

Extend `searchPlaces` to include landmarks, add a `polygonCentroid` helper, wire `landmarks.json` + a `focusLandmarkById` action into the store, and surface landmark results in `RoomSearch`.

**Files:**
- Modify: `src/components/CampusMap/mapHelpers.ts` (add `polygonCentroid`; add a `landmarks` source to `searchPlaces`)
- Modify: `src/store/types.ts:402-420` (add `focusLandmarkById` to `MapSlice`)
- Modify: `src/store/slices/createMapSlice.ts` (load `landmarks.json`; pass to `searchPlaces`; add `focusLandmarkById`)
- Modify: `src/components/CampusMap/RoomSearch.tsx` (label + click for the `landmark` kind)
- Test: `src/components/CampusMap/__tests__/mapHelpers.test.ts` (update `searchPlaces` calls to the new signature; add a landmark-found case + a `polygonCentroid` case)

**Interfaces:**
- Consumes: `Landmark`, `MapSelection` (Task 6).
- Produces:
  - `searchPlaces(query: string, index: RoomIndexEntry[], pois: PoiFeature[], landmarks: Landmark[], limit?: number): MapSelection[]`
  - `polygonCentroid(ring: number[][]): [number, number]` (returns `[lon, lat]`)
  - store action `focusLandmarkById(id: number): void` (sets a `poi`-kind selection at the landmark centroid, `activeBuildingId: null`, bumps `mapFocusRequest`).

- [ ] **Step 1: Write the failing tests first**

In `mapHelpers.test.ts`, add `Landmark` to the type import (line 3):

```ts
import type { RoomIndexEntry, PoiFeature, Landmark } from '../../../types/campusMap';
```

And add `polygonCentroid` to the helper import (line 2):

```ts
import { shortLabel, lonLatToLatLng, ringToLatLng, searchPlaces, polygonCentroid } from '../mapHelpers';
```

Inside the `describe('searchPlaces', …)` block, add a landmarks fixture right after the `pois` const (after line 38):

```ts
  const landmarks = [
    { id: 1588, name: 'Tauferovy koleje', type: 'dormitory', url: null, phone: null, email: null,
      outline: { type: 'Polygon', coordinates: [[[16.588, 49.214], [16.589, 49.214], [16.589, 49.215], [16.588, 49.214]]] } },
  ] as Landmark[];
```

Update **every** existing `searchPlaces(...)` call in this file to pass `landmarks` as the 4th argument (e.g. `searchPlaces('q01', index, pois)` → `searchPlaces('q01', index, pois, landmarks)`; same for `'Q01'`, `'Q0'`, `'frrm'`, and the `'  '` empty case `searchPlaces('  ', index, pois, landmarks)`).

Then add two new tests inside the `describe('searchPlaces', …)` block:

```ts
  it('finds a landmark by name', () => {
    const r = searchPlaces('tauferovy', index, pois, landmarks);
    expect(r.some((m) => m.kind === 'landmark' && m.landmark.name === 'Tauferovy koleje')).toBe(true);
  });
```

And a new top-level describe after the `searchPlaces` block:

```ts
describe('polygonCentroid', () => {
  it('averages the ring vertices to a [lon, lat] point', () => {
    expect(polygonCentroid([[0, 0], [2, 0], [2, 2], [0, 2]])).toEqual([1, 1]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/CampusMap/__tests__/mapHelpers.test.ts`
Expected: FAIL — `polygonCentroid` is not exported and `searchPlaces` does not accept a 4th arg / does not return landmark results.

- [ ] **Step 3: Implement `polygonCentroid` + the landmarks source in `searchPlaces`**

In `mapHelpers.ts`, add `Landmark` to the type import (line 1):

```ts
import type { RoomIndexEntry, PoiFeature, MapSelection, Landmark } from '../../types/campusMap';
```

Add the centroid helper near `ringToLatLng` (after the existing `ringToLatLng` function):

```ts
// Average of a ring's vertices, returned as [lon, lat] (data convention).
// Good enough for fly-to / cluster anchoring; not a true area centroid.
export function polygonCentroid(ring: number[][]): [number, number] {
  let lon = 0, lat = 0;
  for (const [x, y] of ring) { lon += x; lat += y; }
  return [lon / ring.length, lat / ring.length];
}
```

Change the `searchPlaces` signature and body to add landmarks:

```ts
export function searchPlaces(
  query: string, index: RoomIndexEntry[], pois: PoiFeature[], landmarks: Landmark[], limit = 12,
): MapSelection[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rooms = index
    .filter((e) => e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
    .map((entry) => ({ sel: { kind: 'roomRef', entry } as MapSelection, rank: matchRank(q, entry.name, entry.code) }));
  const places = pois
    .filter((f) => f.properties.name.toLowerCase().includes(q))
    .map((f) => ({ sel: { kind: 'poi', poi: f.properties, coord: f.geometry.coordinates } as MapSelection, rank: matchRank(q, f.properties.name, '') }));
  const lands = landmarks
    .filter((l) => l.name.toLowerCase().includes(q))
    .map((l) => ({ sel: { kind: 'landmark', landmark: l } as MapSelection, rank: matchRank(q, l.name, '') }));
  // Array.prototype.sort is stable, so equal-rank items keep their source order.
  return [...rooms, ...places, ...lands].sort((a, b) => a.rank - b.rank).map((x) => x.sel).slice(0, limit);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/CampusMap/__tests__/mapHelpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `focusLandmarkById` to the `MapSlice` type**

In `src/store/types.ts`, inside the `MapSlice` interface, add after line 418 (`focusPoiById: (id: number) => void;`):

```ts
  focusLandmarkById: (id: number) => void;
```

- [ ] **Step 6: Wire landmarks into the store slice**

In `src/store/slices/createMapSlice.ts`, add imports near the top:

```ts
import landmarksJson from '../../data/map/landmarks.json';
import { searchPlaces, polygonCentroid } from '../../components/CampusMap/mapHelpers';
import type { BuildingsMeta, RoomIndexEntry, PoiFeature, MapSelection, Landmark } from '../../types/campusMap';
```

(Replace the existing `import { searchPlaces } ...` line and the existing type import line accordingly — `polygonCentroid` and `Landmark` are added.)

Add the module const after `const POIS = ...` (line 12):

```ts
const LANDMARKS = (landmarksJson as { landmarks: Landmark[] }).landmarks;
```

Update `setMapSearchQuery` (line 40) to pass landmarks:

```ts
  setMapSearchQuery: (q) => set({ mapSearchQuery: q, mapSearchResults: searchPlaces(q, INDEX, POIS, LANDMARKS) }),
```

Add the `focusLandmarkById` action right after `focusPoiById` (after line 63). It resolves the landmark to a `poi`-kind selection (so the existing detail panel renders it) at the footprint centroid, and bumps `mapFocusRequest` so the canvas flies there:

```ts
  focusLandmarkById: (id) => {
    const l = LANDMARKS.find((x) => x.id === id);
    if (!l) { logError('MapSlice.focusLandmarkById', new Error(`unknown landmark ${id}`)); return; }
    const coord = polygonCentroid(l.outline.coordinates[0]);
    set({
      activeBuildingId: null, activeFloorId: null,
      mapSelection: { kind: 'poi', poi: { id: l.id, name: l.name, type: l.type, url: l.url, phone: l.phone, email: l.email }, coord },
      mapFocusRequest: get().mapFocusRequest + 1,
    });
  },
```

- [ ] **Step 7: Surface landmark results in `RoomSearch`**

In `src/components/CampusMap/RoomSearch.tsx`, add the focus action (after line 10):

```ts
  const focusLandmarkById = useAppStore((s) => s.focusLandmarkById);
```

Change the `label` computation (line 19) to include landmarks:

```ts
            const label = m.kind === 'poi' ? m.poi.name : m.kind === 'roomRef' ? m.entry.name : m.kind === 'landmark' ? m.landmark.name : '';
```

Change the click handler (lines 23-24) to route landmark clicks:

```ts
                  onClick={() => { if (m.kind === 'poi') focusPoiById(m.poi.id);
                    else if (m.kind === 'roomRef') focusRoomByCode(m.entry.code);
                    else if (m.kind === 'landmark') focusLandmarkById(m.landmark.id); setQuery(''); }}>
```

- [ ] **Step 8: Full test + build + typecheck + lint**

Run: `npm run test:run && npm run build && npm run typecheck && npm run lint`
Expected: all exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/components/CampusMap/mapHelpers.ts src/store/types.ts src/store/slices/createMapSlice.ts src/components/CampusMap/RoomSearch.tsx src/components/CampusMap/__tests__/mapHelpers.test.ts
git commit -m "feat(map): searchable landmarks + focusLandmarkById"
```

---

### Task 8: Render landmark outlines + fly-to-coord

Draw the 8 landmark outlines (dashed secondary) in both overview and floor-view; on click open the detail panel. Change the overview camera to fly to a selected place's coordinate instead of always refitting campus bounds.

**Files:**
- Modify: `src/components/CampusMap/MapCanvas.tsx` (import landmarks; add a `drawLandmarks` helper; call it in both branches; change the overview end-of-effect camera)

**Interfaces:**
- Consumes: `LANDMARKS`, `select.selectMapPoi(poi, coord)`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Import landmark data + type**

In `MapCanvas.tsx`, add to the imports:

```ts
import landmarksJson from '../../data/map/landmarks.json';
```

Add `Landmark` to the existing type import (line 8):

```ts
import type { BuildingsMeta, PoiFeature, RoomFeature, Landmark } from '../../types/campusMap';
```

Add the module const after `const POIS = ...`:

```ts
const LANDMARKS = (landmarksJson as { landmarks: Landmark[] }).landmarks;
```

- [ ] **Step 2: Add a `drawLandmarks` helper**

Above the `MapCanvas` component (e.g. after `themeColor`), add a module-level helper so it is shared by both the overview and floor-view branches and keeps the effect short (200-line limit):

```ts
// Landmarks (dorms / FRRMS / sports centre) draw as dashed secondary outlines
// in both overview and floor-view. They are not drillable — a click opens the
// shared POI detail panel (landmark metadata is poi-shaped).
function drawLandmarks(layer: L.LayerGroup, select: ReturnType<typeof useAppStore.getState>) {
  for (const l of LANDMARKS) {
    const poly = L.polygon(ringToLatLng(l.outline.coordinates[0]), {
      color: themeColor('--color-secondary'), weight: 1.5, dashArray: '4', fillOpacity: 0,
      bubblingMouseEvents: false,
    });
    poly.on('click', () => {
      const c = poly.getBounds().getCenter();
      select.selectMapPoi(
        { id: l.id, name: l.name, type: l.type, url: l.url, phone: l.phone, email: l.email },
        [c.lng, c.lat],
      );
    }).bindTooltip(l.name).addTo(layer);
  }
}
```

- [ ] **Step 3: Call `drawLandmarks` in both branches**

In the **overview** branch, after the POI loop and before the camera call (i.e. before `map.flyToBounds(META.campus.bounds ...)` on line 64), add:

```ts
      drawLandmarks(layer, select);
```

In the **floor-view** branch, right after the sibling-outline loop added in Task 4 (and before the `map.on('click', onMapClick)` line is fine too — order does not matter), add:

```ts
    drawLandmarks(layer, select);
```

- [ ] **Step 4: Change the overview camera to fly-to-coord on selection**

Replace the overview camera line (line 64, `map.flyToBounds(META.campus.bounds ...)`) with:

```ts
      // §6: rest at campus bounds, but fly to a chosen place's coord on
      // search/click (a poi/landmark selection) instead of refitting campus.
      if (select.mapSelection?.kind === 'poi') {
        const [lon, lat] = select.mapSelection.coord;
        map.flyTo([lat, lon], 18);
      } else {
        map.flyToBounds(META.campus.bounds as L.LatLngBoundsExpression, { maxZoom: 18, padding: [40, 40] });
      }
      return;
```

(Keep the existing `return;` behavior — the snippet above includes the `return;` that previously followed the camera call; ensure there is exactly one `return` ending the overview branch.)

- [ ] **Step 5: Build + typecheck + lint + line-count check**

Run: `npm run build && npm run typecheck && npm run lint && wc -l src/components/CampusMap/MapCanvas.tsx`
Expected: all exit 0; `MapCanvas.tsx` ≤ 200 lines. If it exceeds 200, extract the overview-draw and floor-draw bodies into module-level helpers (`drawOverview` / `drawFloor`) alongside `drawLandmarks` and call them from the effect.

- [ ] **Step 6: Commit**

```bash
git add src/components/CampusMap/MapCanvas.tsx
git commit -m "feat(map): render landmark outlines + fly-to-coord on place selection"
```

---

### Task 9: Pure edge-indicator geometry (`edgeIndicator.ts`)

Isolate the ray-to-rect clamp and the landmark clustering as pure, unit-tested functions, with no DOM dependency.

**Files:**
- Create: `src/components/CampusMap/edgeIndicator.ts`
- Test: `src/components/CampusMap/__tests__/edgeIndicator.test.ts`

**Interfaces:**
- Produces (consumed by Task 10):
  - `interface Point { x: number; y: number }`
  - `interface Rect { width: number; height: number }`
  - `interface EdgeAnchor { x: number; y: number; angle: number }` (`angle` in radians, `atan2(dy, dx)` from viewport center toward target)
  - `edgeAnchor(center: Point, target: Point, rect: Rect, pad: number): EdgeAnchor | null` — `null` when target is inside the padded rect (on-screen).
  - `interface LandmarkPoint { id: number; name: string; lat: number; lon: number }`
  - `interface Cluster { ids: number[]; lat: number; lon: number; label: string }`
  - `clusterLandmarks(points: LandmarkPoint[], thresholdMeters: number): Cluster[]`

- [ ] **Step 1: Write the failing tests first**

Create `src/components/CampusMap/__tests__/edgeIndicator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { edgeAnchor, clusterLandmarks, type LandmarkPoint } from '../edgeIndicator';

const rect = { width: 400, height: 300 };
const center = { x: 200, y: 150 };

describe('edgeAnchor', () => {
  it('returns null when the target is on-screen', () => {
    expect(edgeAnchor(center, { x: 210, y: 160 }, rect, 20)).toBeNull();
  });

  it('clamps an off-screen target to the padded edge (east)', () => {
    const a = edgeAnchor(center, { x: 9999, y: 150 }, rect, 20);
    expect(a).not.toBeNull();
    expect(a!.x).toBeCloseTo(380, 5);          // width - pad
    expect(a!.y).toBeCloseTo(150, 5);          // same row as center
    expect(a!.angle).toBeCloseTo(0, 5);        // due east
  });

  it('clamps a target to the north edge', () => {
    const a = edgeAnchor(center, { x: 200, y: -9999 }, rect, 20);
    expect(a).not.toBeNull();
    expect(a!.y).toBeCloseTo(20, 5);           // pad from top
    expect(a!.x).toBeCloseTo(200, 5);
    expect(a!.angle).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('keeps a corner target inside the padded box', () => {
    const a = edgeAnchor(center, { x: 9999, y: -9999 }, rect, 20);
    expect(a).not.toBeNull();
    expect(a!.x).toBeLessThanOrEqual(380);
    expect(a!.x).toBeGreaterThanOrEqual(20);
    expect(a!.y).toBeLessThanOrEqual(280);
    expect(a!.y).toBeGreaterThanOrEqual(20);
  });
});

describe('clusterLandmarks', () => {
  // 4 JAK blocks within ~150 m of each other; Tauferovy ~3 km west, alone.
  const points: LandmarkPoint[] = [
    { id: 1569, name: 'Koleje JAK Blok A', lat: 49.216233, lon: 16.630584 },
    { id: 1585, name: 'Koleje JAK Blok B', lat: 49.215418, lon: 16.630844 },
    { id: 1611, name: 'Koleje JAK Blok C', lat: 49.216166, lon: 16.631388 },
    { id: 1582, name: 'Koleje JAK Blok D', lat: 49.215601, lon: 16.630004 },
    { id: 1588, name: 'Tauferovy koleje', lat: 49.214599, lon: 16.588826 },
  ];

  it('collapses the 4 JAK blocks into one cluster', () => {
    const clusters = clusterLandmarks(points, 150);
    const jak = clusters.find((c) => c.ids.includes(1569))!;
    expect(jak.ids.sort()).toEqual([1569, 1582, 1585, 1611]);
  });

  it('keeps the far Tauferovy block in its own cluster', () => {
    const clusters = clusterLandmarks(points, 150);
    const tauf = clusters.find((c) => c.ids.includes(1588))!;
    expect(tauf.ids).toEqual([1588]);
    expect(tauf.label).toBe('Tauferovy koleje');
  });

  it('labels the JAK cluster with the shared prefix', () => {
    const clusters = clusterLandmarks(points, 150);
    const jak = clusters.find((c) => c.ids.includes(1569))!;
    expect(jak.label).toContain('Koleje JAK');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/CampusMap/__tests__/edgeIndicator.test.ts`
Expected: FAIL — `Cannot find module '../edgeIndicator'`.

- [ ] **Step 3: Implement `edgeIndicator.ts`**

Create `src/components/CampusMap/edgeIndicator.ts`:

```ts
// Pure geometry for off-screen edge indicators — no DOM, fully unit-tested.

export interface Point { x: number; y: number; }
export interface Rect { width: number; height: number; }
export interface EdgeAnchor { x: number; y: number; angle: number; }

// Given the viewport center, a target's screen point, the container size, and
// an edge padding, return the clamped point on the padded rect edge along the
// ray center->target plus the angle (radians, atan2(dy,dx)) toward the target.
// Returns null when the target lies inside the padded box (i.e. on-screen).
export function edgeAnchor(center: Point, target: Point, rect: Rect, pad: number): EdgeAnchor | null {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const halfW = Math.min(center.x, rect.width - center.x) - pad;
  const halfH = Math.min(center.y, rect.height - center.y) - pad;
  if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) return null;
  const angle = Math.atan2(dy, dx);
  const tx = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: center.x + dx * t, y: center.y + dy * t, angle };
}

export interface LandmarkPoint { id: number; name: string; lat: number; lon: number; }
export interface Cluster { ids: number[]; lat: number; lon: number; label: string; }

function distMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function clusterLabel(names: string[]): string {
  if (names.length === 1) return names[0];
  let prefix = names[0];
  for (const n of names.slice(1)) {
    while (prefix && !n.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  prefix = prefix.replace(/\s+\S*$/, '').trim(); // drop a partial trailing word
  return prefix.length >= 3 ? prefix : `${names.length} places`;
}

// Greedy single-pass clustering: a point joins the first existing cluster whose
// running centroid is within thresholdMeters, else starts a new one. Centroid
// is the mean of member coords. Good enough for ~8 landmarks.
export function clusterLandmarks(points: LandmarkPoint[], thresholdMeters: number): Cluster[] {
  const groups: { pts: LandmarkPoint[]; lat: number; lon: number }[] = [];
  for (const p of points) {
    const g = groups.find((grp) => distMeters(grp.lat, grp.lon, p.lat, p.lon) <= thresholdMeters);
    if (g) {
      g.pts.push(p);
      g.lat = g.pts.reduce((s, q) => s + q.lat, 0) / g.pts.length;
      g.lon = g.pts.reduce((s, q) => s + q.lon, 0) / g.pts.length;
    } else {
      groups.push({ pts: [p], lat: p.lat, lon: p.lon });
    }
  }
  return groups.map((g) => ({
    ids: g.pts.map((q) => q.id),
    lat: g.lat,
    lon: g.lon,
    label: clusterLabel(g.pts.map((q) => q.name)),
  }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/CampusMap/__tests__/edgeIndicator.test.ts`
Expected: PASS (all `edgeAnchor` + `clusterLandmarks` cases green).

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/CampusMap/edgeIndicator.ts src/components/CampusMap/__tests__/edgeIndicator.test.ts
git commit -m "feat(map): pure edge-anchor + landmark clustering helpers"
```

---

### Task 10: `EdgeIndicators` overlay + map-instance exposure

Expose the live Leaflet map via a tiny module singleton, and render clustered arrows for off-screen landmark clusters that fly to them on click.

**Files:**
- Create: `src/components/CampusMap/mapInstance.ts` (module singleton + subscribe)
- Modify: `src/components/CampusMap/MapCanvas.tsx` (publish the map instance on init, clear on teardown)
- Create: `src/components/CampusMap/EdgeIndicators.tsx`
- Modify: `src/components/CampusMap/CampusMapView.tsx` (render `<EdgeIndicators />`)

**Interfaces:**
- Consumes: `edgeAnchor`, `clusterLandmarks`, `polygonCentroid`, `focusLandmarkById`, `Landmark`.
- Produces:
  - `setMapInstance(m: L.Map | null): void`, `getMapInstance(): L.Map | null`, `subscribeMapInstance(cb: (m: L.Map | null) => void): () => void` from `mapInstance.ts`.

- [ ] **Step 1: Create the map-instance singleton**

Create `src/components/CampusMap/mapInstance.ts`:

```ts
import type L from 'leaflet';

// EdgeIndicators needs the live Leaflet map but must not trigger React
// re-renders on every pan/zoom. A module singleton + subscription keeps the
// map out of Zustand and out of the React tree (see plan §"Map-instance
// exposure"). It carries real logic, so it is not a re-export barrel.
let instance: L.Map | null = null;
const listeners = new Set<(m: L.Map | null) => void>();

export function setMapInstance(m: L.Map | null): void {
  instance = m;
  for (const cb of listeners) cb(m);
}

export function getMapInstance(): L.Map | null {
  return instance;
}

export function subscribeMapInstance(cb: (m: L.Map | null) => void): () => void {
  listeners.add(cb);
  cb(instance);
  return () => { listeners.delete(cb); };
}
```

- [ ] **Step 2: Publish the map instance from `MapCanvas`**

In `MapCanvas.tsx`, add the import:

```ts
import { setMapInstance } from './mapInstance';
```

In the init effect, after `mapRef.current = map;` (line 40), add:

```ts
    setMapInstance(map);
```

And in the cleanup return (line 41), change it to also clear the singleton:

```ts
    return () => { setMapInstance(null); map.remove(); mapRef.current = null; };
```

- [ ] **Step 3: Create the `EdgeIndicators` overlay**

Create `src/components/CampusMap/EdgeIndicators.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type L from 'leaflet';
import landmarksJson from '../../data/map/landmarks.json';
import type { Landmark } from '../../types/campusMap';
import { useAppStore } from '../../store/useAppStore';
import { polygonCentroid } from './mapHelpers';
import { clusterLandmarks, edgeAnchor } from './edgeIndicator';
import { subscribeMapInstance } from './mapInstance';

const LANDMARKS = (landmarksJson as { landmarks: Landmark[] }).landmarks;
const CLUSTERS = clusterLandmarks(
  LANDMARKS.map((l) => {
    const [lon, lat] = polygonCentroid(l.outline.coordinates[0]);
    return { id: l.id, name: l.name, lat, lon };
  }),
  150,
);

interface Arrow { key: string; x: number; y: number; deg: number; label: string; firstId: number; }
const PAD = 28;

export function EdgeIndicators() {
  const focusLandmarkById = useAppStore((s) => s.focusLandmarkById);
  const [arrows, setArrows] = useState<Arrow[]>([]);

  useEffect(() => {
    let map: L.Map | null = null;
    const recompute = () => {
      if (!map) { setArrows([]); return; }
      const size = map.getSize();
      const rect = { width: size.x, height: size.y };
      const center = { x: size.x / 2, y: size.y / 2 };
      const next: Arrow[] = [];
      for (const c of CLUSTERS) {
        const pt = map.latLngToContainerPoint([c.lat, c.lon]);
        const a = edgeAnchor(center, { x: pt.x, y: pt.y }, rect, PAD);
        if (!a) continue;
        // ▲ glyph points up (= -y). atan2 gives the screen-space heading; +90°
        // rotates the up-glyph onto it.
        next.push({ key: c.ids.join('-'), x: a.x, y: a.y, deg: (a.angle * 180) / Math.PI + 90, label: c.label, firstId: c.ids[0] });
      }
      setArrows(next);
    };
    const bind = (m: L.Map) => { m.on('moveend zoomend', recompute); recompute(); };
    const unbind = (m: L.Map) => { m.off('moveend zoomend', recompute); };
    const unsub = subscribeMapInstance((m) => {
      if (map) unbind(map);
      map = m;
      if (map) bind(map);
      else setArrows([]);
    });
    return () => { if (map) unbind(map); unsub(); };
  }, []);

  if (arrows.length === 0) return null;
  return (
    <div className="absolute inset-0 z-[900] pointer-events-none">
      {arrows.map((a) => (
        <button
          key={a.key}
          className="btn btn-xs btn-circle btn-secondary absolute pointer-events-auto shadow"
          style={{ left: a.x, top: a.y, transform: 'translate(-50%, -50%)' }}
          title={a.label}
          onClick={() => focusLandmarkById(a.firstId)}
        >
          <span style={{ transform: `rotate(${a.deg}deg)` }}>▲</span>
        </button>
      ))}
    </div>
  );
}
```

> Note on the Iron Rule "NO custom CSS": the inline `style` here is dynamic positioning/rotation (computed pixel coords + rotation angle), not static styling — Tailwind/DaisyUI cannot express per-frame computed values. All *appearance* (button, size, color, shadow) uses DaisyUI classes. This is the same imperative-overlay pattern the spec sanctions.

- [ ] **Step 4: Render the overlay in `CampusMapView`**

In `CampusMapView.tsx`, add the import:

```ts
import { EdgeIndicators } from './EdgeIndicators';
```

And render it just after `<MapCanvas />` (line 12):

```tsx
      <MapCanvas />
      <EdgeIndicators />
```

- [ ] **Step 5: Build + typecheck + lint + full tests**

Run: `npm run build && npm run typecheck && npm run lint && npm run test:run`
Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/CampusMap/mapInstance.ts src/components/CampusMap/MapCanvas.tsx src/components/CampusMap/EdgeIndicators.tsx src/components/CampusMap/CampusMapView.tsx
git commit -m "feat(map): clustered off-screen edge arrows for landmarks"
```

---

### Task 11: Final integration verification

Confirm the whole feature builds clean and manually verify the render-only behaviors the unit tests cannot cover (per the spec's Testing section).

**Files:** none (verification only).

- [ ] **Step 1: Full suite**

Run: `npm run test:run && npm run build && npm run typecheck && npm run lint`
Expected: all exit 0.

- [ ] **Step 2: Manual map check (load the extension via `npm run dev` and open the campus map)**

Confirm each of the following, which together cover §1–§7:
  - Basemap is clean grey Positron — no tree dots, minimal labels.
  - Inside a building, rooms are outlines; only the searched/selected room is filled primary; structure shells still faintly filled.
  - Only the 5 cafeteria dots appear on the overview (no bus stops/gates/parking/letter dots).
  - Dorms / FRRMS / sports centre show as dashed secondary outlines; clicking one opens the detail panel; each is findable in search (type "tauferovy", "frrms").
  - In floor-view, sibling buildings stay drawn as faint outlines; clicking one refocuses to it.
  - Clicking empty basemap returns to overview; clicking an outline/room does **not** exit.
  - There is no `BuildingBar`; `FloorStack` still works.
  - Off-screen landmarks show ~2–3 clustered edge arrows; clicking one flies the camera there.
  - `maxNativeZoom: 20` floor zoom looks acceptable (not overly blurry).

- [ ] **Step 3: Final commit (if any verification tweaks were needed; otherwise skip)**

```bash
git add -A
git commit -m "chore(map): campus de-clutter verification tweaks"
```

---

## Self-Review

**Spec coverage:**
- §1 Positron basemap → Task 1 ✓
- §2 rooms outline-only + delete `categoryColorVar`/`COLOR_VARS` + test removal → Task 2 ✓
- §3 building outlines, sibling navigation, basemap-click-to-exit, `bubblingMouseEvents: false`, remove `BuildingBar` → Tasks 4 + 5 ✓
- §4 POI allowlist (cafeterias only) → Task 3 ✓
- §5 landmarks: `Landmark` type, fetch script, `landmarks.json`, remove from `pois.json`, render dashed outlines, search + `focusLandmarkById` → Tasks 6 + 7 + 8 ✓
- §6 overview camera (campus at rest, fly-to-coord on selection) → Task 8 Step 4 ✓
- §7 `EdgeIndicators` + pure `edgeIndicator.ts` + clustering + map-instance exposure → Tasks 9 + 10 ✓
- Testing section (mapHelpers landmark coverage, edgeIndicator tests, build/typecheck/lint, manual checklist) → Tasks 7, 9, 11 ✓

**Type consistency check:** `searchPlaces(query, index, pois, landmarks, limit?)` defined in Task 7 and called with 4 args in Task 7 (store + tests). `polygonCentroid(ring): [lon, lat]` defined Task 7, used in Tasks 7 + 10. `focusLandmarkById(id)` typed in Task 7 (`store/types.ts`), implemented Task 7 (slice), called Tasks 7 (RoomSearch) + 10 (EdgeIndicators). `Landmark` shape consistent across Tasks 6/7/8/10. `edgeAnchor`/`clusterLandmarks`/`Cluster`/`LandmarkPoint` defined Task 9, consumed Task 10. `setMapInstance`/`getMapInstance`/`subscribeMapInstance` defined Task 10 Step 1, used Steps 2–3. `MapSelection` `landmark` variant added Task 6, produced Task 7, consumed in `RoomSearch` Task 7. `drawLandmarks(layer, select)` defined + called Task 8.

**Placeholder scan:** no TBD/TODO/"handle edge cases"/"similar to" — every code step shows full code. The single environment-dependent step is Task 6 Step 3 (Overpass network call), explicitly flagged as the one human/network dependency rather than hidden.

**Deviation from spec's file table:** added `src/components/CampusMap/mapInstance.ts` (one tiny file) to satisfy the spec's "Map-instance exposure" risk note cleanly without prop-drilling or Zustand re-renders. Noted in Task 10.
