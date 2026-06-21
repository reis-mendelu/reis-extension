# Campus Map De-clutter — Design

**Date:** 2026-06-21
**Branch:** `feat/campus-map`
**Status:** Approved (pending spec review)

## Problem

Two pieces of visual noise on the campus map (`src/components/CampusMap/`):

1. **Rooms are too colorful.** Inside a building, every room is filled by category
   (`teaching`→warning, `office`→info, `circulation`→success, …) at `fillOpacity: 0.8`.
   The result is a loud blue/orange/green/black patchwork.
2. **Too many dots.** The campus overview draws all 62 POIs as markers — 24 bus stops
   (`zastávka`), 6 gates, a gatehouse (`Vrátnice`), a ticket machine, parking, and 14
   single-letter "building" dots — almost none of which a student cares about. The OSM
   raster basemap compounds this with baked-in tree dots and street/POI labels.

## Goals

- Rooms render as **outlines only** (transparent fill); only the selected/searched room is filled.
- Campus building overview renders as **outlines**, not a tinted fill (user prefers outlines).
- Reduce drawn POI markers to **cafeterias only**.
- Replace the OSM raster basemap with **CartoDB Positron** (kills tree dots + most labels).
- Keep **dorms, FRRMS, and the sports centre reachable** — and as building **outlines**, not dots.
  These have no polygon geometry today, so we **source footprints from OpenStreetMap**.

Non-goals: indoor floor/room data changes; the search ranking logic; any IS Mendelu scraping.

## Decisions (from brainstorming)

| Question | Decision |
|----------|----------|
| Room style | Outline only, no fill; selected room filled primary |
| POI dots kept (drawn) | Cafeterias only |
| Dorms / FRRMS / sports centre | Outline landmarks sourced from OSM, clickable, searchable |
| Generic building dots (A/J/R/…), bus stops, gates, gatehouse, ticket machine, parking | Dropped from the map (still searchable) |
| Basemap | CartoDB Positron `light_all` |

---

## Design

### 1. Basemap → CartoDB Positron (`MapCanvas.tsx`, init effect)

Replace the OSM tile layer:

```ts
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  subdomains: 'abcd',
  maxZoom: 22,
  maxNativeZoom: 20, // Positron serves to z20 — one better than OSM's z19
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
}).addTo(map);
```

Positron is free, requires no key, and is a drop-in raster source. The `{r}` retina token
and `maxNativeZoom: 20` reduce upscaling blur at floor-zoom levels.

### 2. Rooms → outline only (`MapCanvas.tsx`, floor draw loop)

In the per-room loop, non-selected non-structure rooms become outline-only:

- `fillOpacity: 0` (Leaflet still registers clicks on a zero-opacity fill, exactly like the
  existing structure handling), `color: --color-base-content`, `weight: 1`.
- Tooltip + click behavior unchanged.

The **selected** room keeps its current treatment: `fillColor: --color-primary`,
`fillOpacity: 0.6`, `weight: 3`, camera flies to it.

`structure` features (walls/cores) stay as-is (faint `base-200` at 0.35) — they are the
building shell, not "rooms"; removing their fill would make floors look hollow.

**Dead code removed:** `categoryColorVar()` and the `COLOR_VARS` map in `mapHelpers.ts`
become unused. Delete both, drop the import in `MapCanvas.tsx`, and remove the
`categoryColorVar` test block in `mapHelpers.test.ts`. (`RoomCategory` type stays — still
used elsewhere.)

### 3. Campus building overview → outline (`MapCanvas.tsx`, overview loop)

The 7 drillable campus buildings (A,B,C,E,M,Q,X from `buildings.json`) currently draw with
`fillColor: --color-primary, fillOpacity: 0.18`. Change to a clean stroke:

- `color: --color-base-content`, `weight: 1.5`, `fillOpacity: 0` (still clickable → `setMapBuilding`).
- Tooltip unchanged.

### 4. POI markers → cafeterias only (`MapCanvas.tsx`, overview POI loop)

Add an allowlist and filter before drawing:

```ts
const DRAWN_POI_TYPES = new Set(['cafeteria']);
```

`POIS.filter(f => DRAWN_POI_TYPES.has(f.properties.type))` → 5 cafeteria dots instead of 62
markers. **Dropped POIs remain in `pois.json`**, so they stay searchable via `searchPlaces`
(search reads the full array) — dropping a dot does not make a place unfindable.

### 5. Landmarks → OSM outlines (new data + render)

The dorms / FRRMS / sports centre are point-only today. Move them out of `pois.json` into a
new `src/data/map/landmarks.json` carrying **both** footprint geometry and the place metadata.

**The 8 landmarks** (current point coords, footprints to be fetched):

| id | type | name |
|----|------|------|
| 1569 | dormitory | Koleje JAK Blok A |
| 1585 | dormitory | Koleje JAK Blok B |
| 1611 | dormitory | Koleje JAK Blok C |
| 1582 | dormitory | Koleje JAK Blok D |
| 1588 | dormitory | Tauferovy koleje |
| 1616 | dormitory | Kolej Akademie |
| 1587 | building | Fakulta regionálního rozvoje a mezinárodních studií (FRRMS) |
| 1623 | building | Centrum sportovních aktivit MENDELU |

> Note: FRRMS (1587) and Kolej Akademie (1616) sit at nearly the same coordinate — they may
> resolve to the same OSM footprint. If so, keep both metadata entries but dedupe the drawn
> outline (or accept two coincident outlines). Decide during sourcing.

**Sourcing script** (`scripts/fetch-landmarks.mjs`, dev-only, committed for reproducibility):
for each landmark point, query Overpass `way[building](around:40, lat, lon)`, pick the
enclosing/nearest footprint, and emit a Polygon ring. One batched, polite Overpass call.
The script's **output JSON is committed**; the script itself is not part of the shipped bundle.

**Data shape** (`landmarks.json`):

```jsonc
{
  "landmarks": [
    {
      "id": 1588,
      "name": "Tauferovy koleje",
      "type": "dormitory",
      "url": "http://skm.mendelu.cz/...",
      "phone": "+420 541 422 051",
      "email": "...",
      "outline": { "type": "Polygon", "coordinates": [[[lon, lat], ...]] }
    }
  ]
}
```

Add a `Landmark` type to `src/types/campusMap.ts`.

**Render** (`MapCanvas.tsx`, overview): draw each landmark outline with a stroke that is
visually distinct from drillable buildings — dashed secondary:
`color: --color-secondary, weight: 1.5, dashArray: '4', fillOpacity: 0`. On click →
`selectMapPoi(landmark, centroid)` (reuses the existing POI detail panel; landmarks are
**not** drillable into floors). Tooltip = landmark name.

**Search + focus:** `searchPlaces` gains a landmarks source (rooms ∪ pois ∪ landmarks), and
`focusPoiById` / a sibling `focusLandmarkById` resolves landmark ids too. Selecting a place
should **fly the camera to its coordinate** — see §6.

### 6. Overview camera (open decision → recommendation)

The landmarks span ~1.8 km (Tauferovy + sports centre are far west on Jana Babáka; the JAK
dorms far east). **Fitting all 8 in the default overview would shrink the campus to a speck**
— defeating a campus map.

**Recommendation:** keep the default overview **focused on the campus** (current
`campus.bounds`), render all landmark outlines (visible once the user pans/zooms out), and
make **search/click fly the camera to the chosen place's coordinate**. This delivers
"reachable" + "outlines" without sacrificing campus focus. Concretely, the overview draw
effect, when a poi/landmark selection has a `coord`, flies to that coord (e.g.
`map.flyTo([lat, lon], 18)`) instead of always refitting `campus.bounds`.

> This refines the "overview zooms out to fit them" framing from the brainstorm — the
> zoom-to-place happens on demand (search/click) rather than permanently. **Please confirm at
> review.** If you truly want all 8 in view at rest, the alternative is to fit the union of
> campus + landmark bounds at init (campus becomes small).

---

## Files touched

| File | Change |
|------|--------|
| `src/components/CampusMap/MapCanvas.tsx` | Positron tiles; rooms outline-only; building outlines; POI allowlist; landmark outlines; fly-to-coord |
| `src/components/CampusMap/mapHelpers.ts` | Remove `categoryColorVar`/`COLOR_VARS`; add landmarks to `searchPlaces` |
| `src/store/slices/createMapSlice.ts` | Load `landmarks.json`; landmark search + focus |
| `src/types/campusMap.ts` | Add `Landmark` type |
| `src/data/map/landmarks.json` | **New** — 8 footprint outlines + metadata |
| `src/data/map/pois.json` | Remove the 8 landmark entries (moved to landmarks.json) |
| `scripts/fetch-landmarks.mjs` | **New** — one-off Overpass fetch (dev-only) |
| `src/components/CampusMap/__tests__/mapHelpers.test.ts` | Drop `categoryColorVar` test; add landmark search coverage |

## Testing

- **Unit (`mapHelpers.test.ts`):** keep `searchPlaces`/`matchRank`/`shortLabel`/`ringToLatLng`
  coverage; add a case proving a landmark (e.g. "tauferovy") is found and ranked. Remove the
  `categoryColorVar` block.
- **Render:** `MapCanvas` is Leaflet/DOM-heavy and not unit-tested. Verify via `npm run build`
  (exit 0) + manual map check: rooms are outlines, only the searched room fills, basemap is
  the clean grey Positron with no tree dots, only cafeteria dots remain, and dorms/FRRMS/sports
  show as dashed outlines that open a detail panel and are findable in search.
- `npm run typecheck` + `npm run lint` clean.

## Risks / notes

- **Overpass dependency** is build-time only (script run once, JSON committed) — no runtime
  network dependency added.
- **Footprint accuracy:** OSM may lack a footprint for a given point, or return a large
  multi-building way. The script must log misses so they can be hand-checked rather than
  silently shipping a wrong polygon. Mirrors the "parser needs real evidence" project rule.
- **`maxNativeZoom` change (19→20):** verify floor zoom still looks acceptable.
