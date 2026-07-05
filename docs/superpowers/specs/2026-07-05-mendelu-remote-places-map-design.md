# Additional MENDELU places on the campus map

**Date:** 2026-07-05
**Status:** Approved

## Goal

Add four off-campus MENDELU sites to the CampusMap feature so students can find
them from the top-right **Places** picker and see where they are on the map.
No navigation/directions — selecting a place only pans the map and opens its
detail card.

The four sites (map-pin coordinates, decimal degrees):

| shortName | name | lat | lon | url |
|---|---|---|---|---|
| Botanická zahrada a arboretum | Botanická zahrada a arboretum MENDELU | 49.2128 | 16.6168 | https://arboretum.mendelu.cz/ |
| Zahradnická fak. – Lednice | Zahradnická fakulta – Lednice | 48.7970 | 16.8011 | https://zf.mendelu.cz/ |
| ŠZP Žabčice | Školní zemědělský podnik Žabčice | 49.0230 | 16.6179 | https://szp.mendelu.cz/ |
| ŠLP Křtiny | Školní lesní podnik Masarykův les Křtiny | 49.2983 | 16.7443 | https://www.slpkrtiny.cz/ |

These are 0.3–50 km from the Brno campus, so they are **points**, not building
polygons like the existing landmarks.

## Design

Reuse the existing **POI selection machinery** (`MapSelection.kind === 'poi'`).
No new selection kind, no new detail-panel branch.

### Data — `src/data/map/remotePlaces.json` (new)

`{ places: RemotePlace[] }`, each `{ id, name, shortName, lat, lon, url, address }`.
Synthetic negative ids `-101…-104` so they never collide with real building /
poi / landmark ids.

New type in `src/types/campusMap.ts`:

```ts
export interface RemotePlace {
  id: number; name: string; shortName: string;
  lat: number; lon: number; url: string | null; address: string | null;
}
```

### Store — `createMapSlice.ts` + `store/types.ts`

Add `focusRemotePlaceById(id)` (mirrors `focusPoiById`): builds a poi-shaped
selection at the site's coord and bumps `mapFocusRequest`. The **address** goes
into the poi `type` field, which `DetailPanel` renders as the muted subtitle
line under the title — so the card reads title (name) / subtitle (address) /
website link. The existing MapCanvas overview effect flies to the poi coord at
zoom 18.

### UI

- **LandmarkPicker.tsx** — two `menu-title` section headers: "Kampus"
  (`map.placesCampus`) above the existing rows, "Další pracoviště"
  (`map.placesOther`) above four new rows, each calling `focusRemotePlaceById`
  and highlighting when its id is the selected poi.
- **EdgeIndicators.tsx** — add the four to `TARGETS` with an `isRemote` flag so
  an off-screen ▲ arrow points toward each; clicking flies there via
  `focusRemotePlaceById` (campus → `focusCampus`, landmark → `focusLandmarkById`,
  remote → `focusRemotePlaceById`).
- **MapCanvas.tsx** — `drawRemotePlaces()` (mirrors `drawLandmarks`) drops a
  clickable `circleMarker` + tooltip at each site in the overview layer, so
  flying to a site lands on a visible pin, not empty basemap. Marker click uses
  `selectMapPoi` (select without moving — you already see the pin).
- **i18n** — `map.placesCampus` / `map.placesOther` in `cs.json` + `en.json`.
  Place names stay verbatim (proper nouns).

## Testing (first)

- `remotePlaces.json` data-shape test: 4 entries, unique ids, lat ∈ [48,50],
  lon ∈ [16,17], non-empty name/shortName, url present.
- `focusRemotePlaceById` slice test: sets a poi selection with the site's coord,
  address in `type`, and bumps `mapFocusRequest`; unknown id logs an error and
  leaves state unchanged.

## Revision 2026-07-05 (user feedback)

After first implementation, two changes:

1. **No edge-indicator arrows** for the remote sites — reverted the
   `EdgeIndicators` additions. Arrows remain for on-campus landmarks + the
   main-campus "way back" only.
2. **Real building footprints instead of green point markers.** `RemotePlace`
   now carries an `outline` polygon (dropped `lat`/`lon`); the sites draw as blue
   `BUILDING_STYLE` polygons like campus buildings/landmarks (via
   `drawRemotePlaces` = polygon, not `circleMarker`). Focus flies to the outline
   centroid (`polygonCentroid`). Footprints sourced from OpenStreetMap by pinned
   way ID via `scripts/fetch-remote-places.mjs`:
   - arboretum → way 44368231 (named garden area)
   - Lednice ZF → way 54053791 (main faculty building)
   - Žabčice ŠZP → way 835010329 (named farmyard areal)
   - Křtiny ŠLP → way 61229872 (Zámek Křtiny building)

   Arboretum + Žabčice are inherently areas (garden / farm complex); Křtiny is
   the château building. Tests updated to validate the outline rings and the
   centre-based focus coord.

   **Follow-up:** the Lednice faculty is a whole campus, not one building. Its
   entry is now a **MultiPolygon of all 25 building footprints** inside the ZF
   grounds (OSM way 242749779 used as a `poly:` spatial filter), each drawn as
   its own blue building like the main campus. `RemotePlace.outline` is a
   `Polygon | MultiPolygon` union; `remotePlaceRings`/`remotePlaceCenter`
   (mapHelpers) normalize both — draw iterates every ring, focus flies to the
   bounding-box centre so a multi-building campus frames on its middle.

   **Arboretum inner map:** the arboretum is a garden with buildings inside it,
   so it now carries an optional `area` (the garden boundary, drawn faintly in a
   green `GARDEN_STYLE` behind the buildings) plus an `outline` MultiPolygon of
   the 9 inner buildings/greenhouses (fetched the same grounds-poly way, with a
   `keepAsArea` flag). `remotePlaceCenter` includes `area` in its bbox.

## Revision 2026-07-05 (arboretum drill-in + inner map)

Two changes to the arboretum, mirroring the campus-faculty drill interaction:

1. **Drill-in reveal.** At the campus overview the arboretum shows only its faint
   green garden boundary (`area`). Clicking it — or picking it from Místa — flies
   in and reveals the inner map; clicking bare basemap collapses it again. The
   "drilled" state is **derived from the selection** (a site is drilled when it is
   the selected poi), so no new store state is needed — every drill transition
   already bumps `mapFocusRequest`, and the draw effect reads the selection at run
   time. Sites without an `area` (Lednice/Žabčice/Křtiny) are far off-screen and
   always show their footprints.

2. **Meaningful inner content.** `RemotePlace` gains optional `paths`
   (footpath polylines) and `pois` (labelled `{name,lon,lat}` points). For the
   arboretum: the real OSM footpath network (32 ways, ~3.8 km, `PATH_STYLE` dotted
   grey), the 9 buildings, and 8 labelled points (`POI_MARKER_STYLE` purple dots).
   Two greenhouses + two viewpoints are exact OSM features; five collection labels
   (Alpinum/skalka, garden for the blind, rose collection, water cascade, meteo
   station) are **approximate** — OSM has no geometry for them, so they were placed
   from the official 5-section layout (arboretum.mendelu.cz) and snapped onto the
   nearest path vertex so they sit inside the garden on the walkable network.

## Revision 2026-07-05 (arboretum polish + data-source finding)

- **Fit-to-bounds on drill-in.** Focusing a remote site now `flyToBounds` of its
  extent (`remotePlaceBounds`, `maxZoom 18`, padding) instead of `flyTo(center, 18)`
  — the arboretum no longer over-zooms past its own size; it frames the whole
  garden. `remotePlaceExtent` prefers the `area` boundary when present.
- **Buildings trimmed.** The arboretum keeps only the 5-polygon greenhouse complex
  (within ~66 m of the greenhouse cluster); the 4 scattered outbuildings (162–492 m
  away, "random spots") were dropped.
- **No georeferenced source for the ~40 sub-collections.** Confirmed the official
  "site map" (arboretum.mendelu.cz) is a static JPG with no coordinates / KML /
  GeoJSON, and OSM has **zero** tagged trees and no named sub-sections inside the
  boundary (only paths + greenhouses + 2 viewpoints + 1 firepit). So the 5-section
  collection markers remain hand-placed approximations; going finer would require
  manually georeferencing the static plan image.
- **13 highlights georeferenced from the plan (option A).** Downloaded the static
  plan (`mapka.jpg`, 900×677) and read its numbered labels. The plan is the garden
  rotated ~90° CCW (greenhouses top-left = real north); using the greenhouse
  cluster as anchor, derived a linear px→(lat), py→(lon) transform, mapped ~13 key
  labels (Skleníky, Správní budova, Sbírka lomikamenů, Alpinkový skleník, Sbírka
  vrb, Vodní kaskáda, Denivky, Alpinum, Meteostanice, Zahrada Vysočiny, Zahrada
  pro nevidomé, Zahrada miniatur, Růže) and **snapped each to the nearest OSM path
  vertex** (7–76 m from estimate) so they sit on walkways inside the garden. Still
  approximate — no georeferenced source exists — but positioned from the real plan.

## Revision 2026-07-05 (accuracy over coverage — drop approximate markers)

The hand-georeferenced collection highlights read as inaccurate on the live map
(the plan is stylised/rotated; a hand transform lands markers ±50–100 m off, which
is visible at drill zoom). **Reverted the arboretum POIs to only genuinely-real
OSM features:** the two building labels **Skleníky** (greenhouse) and **Správní
budova** (admin building), each sitting on its real OSM footprint. All 11
approximate collection markers were removed. The rest of the inner map is
unchanged and remains fully real geometry — the garden boundary (`area`), the
five greenhouse-complex footprints (`outline`), and the 32-way footpath network
(`paths`). Principle: show only what we can place accurately; an empty-but-correct
map beats a full-but-wrong one. (OSM's only other real interior POIs are 2
viewpoints + 1 firepit — available to add back if wanted.)

## Out of scope

- No routing/directions, no travel time, no distance display.
- No building outlines/floor plans for the remote sites (they have none here).
- No bidirectional edit; data is a static bundled JSON.
