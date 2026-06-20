# Campus Map — Design Spec

**Date:** 2026-06-20
**Status:** Approved (brainstorm) → ready for implementation plan
**Source bundle:** `~/Downloads/mendelu_map` (prototype + datasets + `REIS-MAP-HANDOFF.md`)

## 1. Summary

Add a **Campus Map** view to reIS: a new main view (and menu entry) showing the **whole campus** —
every academic building (A, B, C, E, M, Q, X) plus exterior places (FRRMS, the dorms, the sports
centre, tram stops, gates, parking) — and rendering MENDELU's **indoor floor plans** for the 7
academic buildings from reIS's own polygon data, not the embedded `mm.mendelu.cz` widget. Users
switch building and floor, tap a room (or a POI pin) for its detail, **search for a specific room**
(or place), and can deep-link to a specific room from a schedule event or the subject drawer.

This replaces the only existing map touchpoint today — `MapHoverCard.tsx`, which iframe-embeds
`mm.mendelu.cz/mapwidget/embed` on room names in the subject drawer — with a native render and
a deep-link into the new view.

### Why native (not the embed)

- reIS is privacy-positioned ("no external calls / client-side only"); the embed and the
  handoff's CartoCDN basemap both make third-party calls. Native render + no tiles = zero
  third-party requests.
- The handoff bundle (`~/Downloads/mendelu_map`) is a **Vue/Leaflet prototype** to cannibalize,
  not port verbatim — reIS is React 19 + WXT + DaisyUI. We reuse its proven logic (category
  colors, building auto-switch on pan, short-label regex, floor-stack UX), reimplemented in React.

## 2. Scope

### In v1
- **Whole-campus overview**: every academic building (A/B/C/E/M/Q/X) as a **footprint** PLUS the
  **exterior places** — FRRMS, the dorms, the sports centre, and the rest of the 68 POIs
  (tram stops, gates, parking, cafeterias) as **pins** (from bundled `pois.geojson`). This is the
  default "see the entire map" landing state. Tap a building footprint to enter its floor plans;
  tap a POI pin for its name/type/link.
- Core browse: building bar (A/B/C/E/M/Q/X), floor stack (elevator switcher), tap room → detail panel.
- **Room search**: type a code (e.g. `Q01`, `N3047`) → fly to building/floor and highlight. Search
  also matches POI names (e.g. "FRRMS", a dorm name) → fly to that pin.
- **Deep-link**: a "Show on map" affordance on schedule events and the subject drawer opens the
  Campus Map focused on a room.
- **Hover-card rewire**: `MapHoverCard.tsx` drops the `mm.mendelu.cz` iframe and instead shows a
  **lightweight static SVG thumbnail** of the room on its floor + a **"Show on Campus Map"** button.

**POIs have no interiors** (none exist publicly for dorms/FRRMS/sports) — their detail panel shows
name/type/link/phone/email and states plainly that no floor plan exists. Only the 7 academic
buildings have interiors.

### Deferred (explicit follow-ups — NOT in v1)
- IS "Pasportizace" join on `passportNumber` (handoff §5) — backfills name/capacity/equipment/occupants.
- Wayfinding / routing (handoff §6.2) — needs the dropped door/wall geometry + a graph.
- PostGIS / Supabase move — the static hybrid needs none of it.

## 3. Rendering engine

- **Plain `leaflet`** (new dependency), driven **imperatively** in one component via refs — NOT
  `react-leaflet`. Faster for ~2,895 polygons, matches the prototype, avoids react-leaflet/React-19
  coupling.
- **`CRS.Simple`, no tile layer.** Only reIS polygons are drawn. Zero third-party network calls;
  no CSP friction inside the `chrome-extension://` iframe.
- Importing `leaflet/dist/leaflet.css` is a **dependency stylesheet**, not app "custom CSS" — it
  does not violate the "NO custom CSS" iron rule. Room *styling* (fills) is set via Leaflet path
  options, not CSS classes.
- **Polygon fills derive from DaisyUI theme tokens** (read computed CSS custom properties), not the
  prototype's hardcoded hex, so light/dark themes render correctly. Category → token map covers
  `teaching | office | service | circulation | structure | other`; `structure` drawn first as a
  non-interactive backdrop, interactive rooms on top.
- Short labels: display `name.match(/[NPS]\d+$/)?.[0] ?? name` (so `BA04N3047` → `N3047`); full
  code lives in the detail panel.
- GeoJSON coords are `[lon,lat]`; Leaflet wants `[lat,lng]` — a single conversion helper flips them.

## 4. Data delivery (hybrid)

| Artifact | ~Size | Delivery |
|---|---|---|
| `buildings.json` (footprints, floors, campus bounds) | 33 KB | **bundled** in `src/data/map/` — campus overview instant/offline |
| `pois.geojson` (68 exterior pins: FRRMS, dorms, sports centre, tram, gates, parking, cafeterias) | ~17 KB | **bundled** — drawn on the campus overview |
| `rooms-index.json` (code → `{buildingId, floorId, placeId, name}`, **no geometry**) | ~150 KB | **bundled** — powers room search + deep-link without loading 1.6 MB |
| `rooms-<buildingId>.geojson` (per-building geometry, 7 files) | ~1.6 MB total | **reis-data CDN** (jsDelivr), fetched on building open, cached in IndexedDB |

- CDN base mirrors `successRate.ts`: `https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main`,
  path `/map/rooms-<buildingId>.geojson`.
- **reis-data work:** clone `https://github.com/reis-mendelu/reis-data.git` into `../reis-data`,
  add a `map/` directory containing the per-building `rooms-<id>.geojson` files (the only artifacts
  served from the CDN; the snapshot + extractor live alongside them), commit and push so jsDelivr
  serves them. `buildings.json`, `pois.geojson`, and `rooms-index.json` are **bundled in the
  extension**, not served from the CDN.
- **Extractor:** extend the bundle's `fetch-mendelu-map.py` (kept alongside the snapshot in
  reis-data) to also emit (a) the per-building `rooms-<id>.geojson` splits and (b) the lightweight
  `rooms-index.json`. Treat a source schema change as a "re-run the extractor" event; never call
  `mm.mendelu.cz` at runtime.

## 5. State, storage, components (all ≤ 200 lines/file)

### State — `src/store/slices/createMapSlice.ts` (composed into `useAppStore`)
- `activeBuildingId` (null = campus overview), `activeFloorId`, `selection` (`MapSelection | null`)
- per-building loaded geometry (in-memory cache of fetched FeatureCollections)
- `searchQuery`, `searchResults`
- actions: `setBuilding(id)`, `exitToCampus()`, `setFloor(id)`, `selectRoom(room)`,
  `selectPoi(poi)`, `focusRoom(code)` / `focusPoi(id)` (deep-link entries: resolve via
  `rooms-index.json` / `pois.geojson`, set `currentView='map'` + building/floor/selection),
  `loadBuilding(id)` (calls the api, caches)
- All state lives in the slice (iron rule: no generic/component state).

### API — `src/api/campusMap.ts`
- `fetchBuildingRooms(buildingId): Promise<RoomsCollection>` — CDN fetch + IndexedDB cache with a
  TTL, mirroring `successRate.ts` (`getStored…`/`save…`/`isCacheValid`/`markAsSynced`). Stateless,
  network only; the slice owns orchestration.

### Storage
- New IndexedDB store `map_rooms` (key = buildingId) added to `StoreSchemas`/`ReisDB` in
  `IndexedDBService.ts`, plus a `meta` TTL key (e.g. `MAP_ROOMS_LAST_SYNC`) like
  `GLOBAL_STATS_LAST_SYNC`.

### Types — `src/types/` (port from `mendelu-map.types.ts`)
- `RoomCategory`, `RoomProperties`, `RoomFeature`, `RoomsCollection`, `Floor`, `Building`,
  `BuildingsMeta`, `PoiProperties`, `PoiFeature`, `PoiCollection`. Add `RoomIndexEntry` for
  `rooms-index.json`; add a unified `MapSelection` (room | poi) for the detail panel.

### Components — `src/components/CampusMap/`
- `CampusMapView.tsx` — panel shell/orchestrator (rendered by `AppMain` when `currentView==='map'`).
- `MapCanvas.tsx` — imperative Leaflet instance: init `CRS.Simple`; at campus zoom draw the 7
  building **footprints** + **POI pins** (FRRMS/dorms/sports/etc.); on building enter draw that
  floor's room polygons. Handles click → `selectRoom`/`selectPoi`, `flyToBounds` on
  building/floor/focus changes, optional viewport auto-switch to nearest building at high zoom.
- `BuildingBar.tsx` — building selector.
- `FloorStack.tsx` — elevator-style floor switcher for the active building.
- `DetailPanel.tsx` — renders the active `MapSelection`: for a **room**, full name/code, type label,
  seats/equipment (sparse), passport number; for a **POI**, name/type/link/phone/email and a plain
  "no floor plan exists" note. States missing metadata plainly rather than blanks.
- `RoomSearch.tsx` — search box over `rooms-index.json` **and POI names** → `focusRoom` / `focusPoi`.
- `mapHelpers.ts` — category→DaisyUI-token map, short-label regex, `[lon,lat]→[lat,lng]` flip.

### Wiring
- `src/types/app.ts`: add `'map'` to `AppView`.
- `AppMain.tsx`: `{currentView === 'map' && <CampusMapView />}`.
- `Menu/MainItems` + `menuConfig.tsx`: add a "Mapa / Map" menu item (lucide `Map`/`MapPin` icon).
- Deep-link affordance ("Show on map") on schedule events and the subject drawer → `focusRoom`.
- `MapHoverCard.tsx`: remove the iframe; render a static SVG thumbnail (cheap, no Leaflet instance
  per hover — draws the room polygon + floor backdrop from the bundled/loaded data into an
  `<svg viewBox>`) + a "Show on Campus Map" button calling `focusRoom`.
- i18n strings in `src/i18n/locales/{cs,en}.json`.

## 6. Data flow

```
Campus overview  → bundled buildings.json (footprints) + pois.geojson (FRRMS/dorms/sports/…)
                                                                  [instant, offline]
Tap POI pin      → MapCanvas → slice.selectPoi → DetailPanel (name/type/link, "no floor plan")
Open building    → createMapSlice.loadBuilding(id)
                   → api/campusMap.fetchBuildingRooms(id)
                     → IDB cache hit? return : CDN fetch → validate → IDB.set → return
                   → slice stores FeatureCollection → MapCanvas draws active floor
Switch floor     → slice.setFloor → MapCanvas redraws (same in-memory FC)
Tap room         → MapCanvas → slice.selectRoom → DetailPanel
Search / deeplink → rooms-index.json + pois → focusRoom(code)/focusPoi(id)
                    → setBuilding+loadBuilding+setFloor+selection (rooms) | flyTo pin (POI)
Hover room name  → MapHoverCard → SVG thumbnail + "Show on Campus Map" → focusRoom
```

## 7. Error handling

- All non-fatal failures go through `logError(context, err)` with `Map.*` / `Api.fetchBuildingRooms`
  contexts (per the telemetry convention; never pass payload data as `extra`).
- CDN fetch failure with no cache → detail/empty state explaining the building couldn't load + a
  retry; campus overview (bundled) still works offline.
- Unknown/missing room on deep-link or search → graceful "room not found on map" message.
- Missing room metadata (sparse source) → DetailPanel states it plainly rather than blanks.

## 8. Testing (test-first)

Unit (Vitest/happy-dom) on pure logic — written before implementation:
- `mapHelpers`: category→token map, short-label regex (`BA04N3047` → `N3047`, plain names
  untouched), `[lon,lat]→[lat,lng]` flip.
- `rooms-index` + POI search/filter (room code + room name + POI name match).
- `api/campusMap.fetchBuildingRooms`: cache-hit short-circuit, fetch-on-miss, IDB write, TTL
  expiry, fetch-failure-with-cache fallback (fetch + IDB mocked).
- `createMapSlice`: `focusRoom` resolves index → sets view/building/floor/selection; `setFloor`
  redraw target; load dedupe.

Leaflet DOM rendering isn't unit-tested in happy-dom. Optional Playwright E2E: open Map view →
switch floor → tap room → detail shows; search → focus.

## 9. Build / verification

Per project convention, run `npm run build` (expect exit 0), `npm run typecheck`, `npm run lint`,
`npm run test:run` after changes. Verify zero third-party network requests from the map (no tiles,
no `mm.mendelu.cz`) and that the bundle size delta is ~bundled-meta only (heavy geometry stays on CDN).

## 10. Open risks

- **Undocumented source API** — pin snapshots in reis-data; schema drift = re-extract. Pursue
  getting it blessed as a sanctioned MENDELU data source (reIS is on an official track).
- **MENDELU-specific** — interiors exist for these 7 buildings only and don't generalize to other
  universities; this is a stickiness/differentiator wedge, not part of the multi-university spine.
- **Attribute sparseness** (seats/equipment/occupant) — accepted in v1; the deferred IS join fixes it.
