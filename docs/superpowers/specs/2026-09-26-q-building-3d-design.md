# Building Q in 3D — pilot design

> **Superseded (2026-09-27).** The 3D card this spec describes was built (#461) and rejected: a card in the sheet read as clutter. What shipped instead is the map itself tilting into building Q (#462), off unless `VITE_MAP3D=1`. The data and model sections still hold.

Date: 2026-09-26 · Status: approved in brainstorming, pilot for one building

## Why

Students open the campus map to answer one question: *where exactly is my
room?* The flat floor picker answers "which floor" only after you know to ask.
A real-looking building, cut open at the lesson's floor, answers it at a
glance — and Google Maps cannot, because only reIS holds per-floor room plans.

Q carries 23% of all weekly lesson slots (ZS 2026/27, 4,614 slots, reis-scraper
`data/study-plans/timetable-events.json`), the single biggest building. It is
the pilot: built properly, shipped, then B/A/Z decided from real use.

## What the student sees

- **Only for a room in Q.** Every other room behaves exactly as today.
- **Phone/iPad:** a lesson's map pin opens the map on Q as today; the room's
  `MapSheet` (portrait) or `MapRail` (landscape/iPad) leads with a 3D card.
- **Desktop:** the same card replaces the flat thumbnail in `MapHoverCard` and
  leads the map's `DetailPanel` when a Q room is selected.
- **The card:** Q in its real massing and façade colours with window bands.
  Every storey above the lesson's floor lifts off like a lid and fades; the
  target storey's walls turn translucent and its rooms are drawn inside, the
  room glowing in the brand colour; storeys below stay solid. The real,
  sloping terrain is drawn, so floors −1/−2 read as underground on the east
  side and exposed on the west, as they are. A label reads
  "Q · <n>. patro · <room>". Drag to spin; it springs back to the default view.
- **Credit:** "3D: © Statutární město Brno, CC BY 4.0, upraveno" on the card
  (CC BY 4.0 requires saying the work was modified) and in the README.

**What opens the card:** a room someone came looking for — a lesson's map pin,
or search, which focus it the same way (`roomRef`) — opens the phone sheet /
tablet rail on it. A room tapped while exploring the plan does not move the
sheet; its card is there when the sheet is expanded. Desktop shows it in the
detail panel for any selected Q room, and in the hover card.

Out of scope for the pilot: interiors beyond room outlines, other buildings,
events as triggers, a free-browse mode, photo textures.

## Data (reis-data)

- **Source:** Brno LOD2 building model, FeatureServer
  `gis.brno.cz/ags1/rest/services/Hosted/KAM_3D_budovy_LOD2_WM/FeatureServer/0`,
  `kod_ruian=45515174` → 6 flat-roofed parts (footprint, `baseheight` 231.66 m,
  `bldgheight` 7.4–28.8 m). Flat roofs, so footprint + base + height *is* the
  LOD2 geometry. The raw response is committed to `source/3d/Q/brno-lod2-parts.json`.
- **Terrain:** ČÚZK DMR 5G samples around Q (230.7–240.6 m: ~10 m fall to the
  west), fitted to a plane, committed as `source/3d/Q/terrain-samples.json`.
- **Floor elevations** (m above base): fitted from the step heights between
  parts (west wing roof 22.18 = top of 3rd, east 25.62 = 4th, south 28.75 = 5th;
  podium roofs 12.1/12.8 = top of 0) and the terrain (east ground ≈ 8.3 = floor 0).
- **Generator:** `scripts/buildQModel.mjs` (no dependencies, like the rest of
  reis-data) writes `map/3d/Q.glb` and `map/3d/Q.json`. The "hand finishing"
  from the brainstorm is done in this script instead of Blender — reproducible
  and reviewable: façade colours chosen from Wikimedia Commons reference photos
  (teal render, glass west wing, light concrete plinth, silver curved roof on the
  north block, glass courtyard roof), and window bands per storey.
- **glb layout:** one node per storey, `storey:<level>` (all parts' walls and
  windows for that storey), roofs in the top storey of their part. That split is
  what makes the cutaway a per-node transform instead of runtime clipping. No
  textures, no Draco/KTX2 (they would need `wasm-unsafe-eval` in the extension
  CSP). Budget: < 1.5 MB, < 20k triangles.
- **Q.json:** `{ buildingId: 0, anchor: [lng, lat], storeys: {level: elevation},
  ground: {a, b, c}, defaultAzimuthDeg, attribution }`, local frame x = east,
  y = up, z = south, metres.
- **Alignment test:** `scripts/buildQModel.test.mjs` fails if any vertex of any
  Q floor outline in `map/rooms-0.geojson` lies more than 1.5 m outside the
  union of the LOD2 part footprints.

## Extension

- `three` (GLTFLoader, no r3f), reached only through `React.lazy`, so it stays
  out of the main chunk and the content-script graph.
- `src/components/Building3D/`: `Building3DCard` (static shell: label, credit,
  fallback, lazy boundary), `Building3DCanvas` (lazy chunk), `scene`,
  `projection`, `floorSlabs`, `cutaway`, `orbit`, `webgl` (WebGL2 detection),
  `themeColor` (resolve a DaisyUI colour to hex), `models` (which buildings
  have one: `[0]`). Each under 200 lines.
- Store: `buildingModels: Record<number, BuildingModel | 'failed'>` in the map
  slice; `loadBuildingModel(id)` in `buildingGeometryActions`, fired from
  `loadMapBuilding` (which every hover and map selection already goes through).
  IndexedDB store `map_models` (DB v23), 30-day expiry, stale-but-usable on
  fetch failure. `src/api/buildingModels.ts` fetches from the same jsDelivr
  base as the room outlines — no new host.
- Renders on demand only (drag, spring-back, resize), one WebGL context,
  disposed on unmount.
- Fallback to today's flat `RoomThumbnail` when WebGL2 is missing, the model
  or rooms are not loaded yet, or the model failed.

## Testing and verification

- Unit: `cutaway` (classification + lift), `projection` (round-trip, metres),
  `floorSlabs` (target room coloured, one mesh per room, elevation), store
  action (IDB cache, single fetch, failure state), card (non-Q → nothing, no
  WebGL2 → `RoomThumbnail`), `contentScriptGraph` still green.
- UI: verify-ui at 320/390/430, tablet and landscape, both themes; a 3rd-floor
  room, a floor −1 room, the desktop hover card, and the fallback. Assert the
  canvas exists and the lifted storeys sit above the target, not just a
  screenshot.

## Decided during implementation

- **Floor wording follows the students, not the map level.** Q4.03 is on level 3,
  which Czech calls "3. patro" (4.NP on the door); "podlaží 3" would contradict
  the room's own name. Level 0 is "přízemí", negatives "N. podzemní podlaží".
- **Default view from the south (azimuth 195°).** The phone shows the card under
  a north-up map; from the south the east wing is on the right in both.
- **The phone sheet opens at `half` for a Q room** and the map pans the room above
  it (`panPinClearOfSheet`, the helper event pins already use) — otherwise the
  room was centred behind the card that described it.
- **A fresh canvas per scene.** Disposing forces the context lost (prompt GPU
  release, which iOS needs), and a canvas keeps returning its lost context — a
  reused one broke StrictMode and any re-render on a new room.
- **A renderer that fails never takes the app down.** The throw is routed to an
  ErrorBoundary that shows the flat plan, and WebGL is marked unavailable for the
  session. Found in an embedded browser that advertised WebGL2 and failed.
- **A floor counts as underground if the ground rises above it anywhere** under
  the building, not just at the centre — Q's −1 opens west and is buried east.
  The lid hides its floor slabs, which otherwise stack into milk over a basement.
- **Main chunk: +2.6 KB gzip** (card shell, store action, API, schema, strings —
  what decides whether to load the 3D chunk at all). `three` is 169 KB gzip in
  the lazy `Building3DCanvas` chunk only; none in main or the content script.
- **Harness:** `scripts/shot.ts` gained `--route`, `--call`, `--wait-for`,
  `--hover`, `--no-webgl`, and launches with SwiftShader so headless runs can draw
  WebGL at all.
