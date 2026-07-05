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

## Out of scope

- No routing/directions, no travel time, no distance display.
- No building outlines/floor plans for the remote sites (they have none here).
- No bidirectional edit; data is a static bundled JSON.
