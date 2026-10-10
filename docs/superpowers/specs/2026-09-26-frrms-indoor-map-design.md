# FRRMS (budova Z) indoor map: design

Date: 2026-09-26. Status: approved in brainstorming. Repos: reis-data, then reis-extension.

## Goal

Today a tap on FRRMS shows an outline and "Žádný plán podlaží není k dispozici", and
every `Zxx (ČP II.)` lesson resolves to the whole building. After this change, a tap on
FRRMS opens a **floor stack (1.NP–4.NP, default 2.NP) with every room drawn**, and a
student picks a room. The IS rooms (Aula, Z1–Z11, Z13–Z15, Z24–Z26, Z28, and the 4.NP
coworking room) land on their own room and floor, as they do in A, B, C, E, M, Q and X.

This is built from the information that exists today. A door-sign walk of 2.NP corrects
identities before the release PR, without blocking the build (see "Identities").

## Decisions already taken (do not reopen)

- **Licence.** Shipping room geometry derived from the public tender PDFs without a
  sublicence is accepted (Dominik, 2026-09-26). The PDFs never enter a repo or a build;
  only derived geometry and public IS facts do.
- **No .dwg is coming** from MENDELU.
- **Floors: 1.NP–4.NP.** 5.–8.NP are dormitory-only with no drawings, so they are not drawn.
  1.PP is not drawn either.
- **Walking routes into Z are out of v1.** Z has no routing-graph nodes, so there is no
  "Trasa" button for Z rooms. "Show on map" works.
- Campus bounds (`META.campus.bounds`) do not change. Z sits ~600 m north of today's
  framing, and the map's opening view stays as it is.

## Inputs

The research inventory lives outside every repo (it is derived from the drawings):
`~/Documents/reis/frrms-indoor-research/` (README.md is the summary). Its
`research/frrms_structure.geojson` has one feature per segmented space for 1.NP–4.NP,
with `code`, `name_printed`, `is_label`, `category`, `identity_confidence`, evidence and
notes, and it rebuilds byte-identically from `research/merge_structure.py`.

Facts it establishes, which the design relies on:
- The footprint is OSM way 305942870, a RÚIAN import 0.13 m from the cadastre. The plans
  fit it at 0.15 m median on 2.NP. **Reuse the 2.NP transform for 3.NP** (3.NP's own fit
  has a 5.7 m outlier).
- IS has 20 rooms in Z. **There is no Z12, Z22, Z23 or Z27.** The handover's Z22/Z23 are
  real spaces (N2080/N2082) with no IS room behind them.
- IS `Číslo` is wrong for Z11 (an 11 m² storeroom) and Z15 (a 0.94 m² shaft). For Z24 and
  Z28 it holds the door numbers 284/285, which map to pasport N2084/N2085 (N2085 is
  printed "Učebna 28").

## Data model

- **Building.** `id` 9000001: positive, above every room id in use (max 2,324,639), clear
  of the negative landmark and remote-place ranges, and yielding a clean CDN filename.
  `name` "Z", `description` "FRRMS". `outline` = OSM way 305942870. Coordinate traps
  apply: `outline` is [lon, lat], `center` is [lat, lon], and `bounds` is [[S, W], [N, E]].
  `defaultFloorId` is 2.NP, set explicitly rather than by the "level 0" rule.
- **Floors.** Ids 9000013 / 9000012 / 9000011 / 9000010 for levels 3 / 2 / 1 / 0, listed
  top floor first like every building. Z uses **level = NP − 1**, which matches IS's floor
  index and buildings A, C and Q. `name` is the level as a string. `roomCount` excludes
  `structure`.
- **Rooms.** Every field of `RoomProperties`:
  - `id`: from 9001000 up, assigned deterministically as sorted (floor, code, seg id).
  - `code`: `BZ00` + pasport (e.g. `BZ00N2024`). **`BZ00` is a synthetic prefix**,
    documented as such in reis-data. The pairing code needs a prefix and no MENDELU source
    defines one for Z. Rooms without a pasport code get `BZ00-<level>-<seg id>`.
  - `passportNumber`: the pasport code, or null.
  - `name`: the IS label for IS rooms; otherwise the printed name, or empty.
  - `nickname`: null, except the coworking room.
  - `seats`: from IS.
  - `hasProjector` / `hasWhiteboard`: null (unknown).
  - `type`: the printed room type.
  - `category`: `teaching` | `office` | `service` | `circulation` | `other`.
- **What is drawn.**
  - Every segmented space is drawn except roofs, atrium voids and courtyards
    (`frrms_structure` categories `roof`, `roof?`, `void`, `courtyard`), which are dropped.
  - Terraces and dormitory cells are drawn as `other` and left **unnamed**.
  - Unidentified rooms are drawn unnamed. An empty name keeps a room out of search; that
    is intended, since it means reIS names nothing it cannot stand behind.
  - The Aula is on **1.NP** (N1000). Its 2.NP drum is drawn unnamed, so "Aula" names one
    room only.
  - The coworking room (N4002, 4.NP): `name` "Coworking", `nickname` "Zasedačka FRRMS 4NP",
    and the IS label pairs to it.
- **Geometry fixes before export.**
  - Z14/Z15 use the handover's hand-cut hall outlines instead of the seat-row slivers.
  - The 1.NP black-hatched corridors get a merge pass, seeded by the ~20 printed
    corridor, stair and lift codes that already have positions.
  - Coordinates are rounded to 7 decimals and features sorted, so the file hashes are stable.

## Identities

v1 ships the current best assignment from `frrms_structure.geojson`:
- 7 confirmed: Aula, Z1, Z2, Z4, Z26, Z28, Coworking.
- Z3 pinned: the only room between Z2 and Z4.
- 10 inferred: Z5–Z10, Z13, Z14, Z24, Z25.
- 2 low: Z11 in seg 149 (seg 151 not ruled out), and Z15.

There is no "approximate location" UI. **The walk corrects before the release PR**
(photos in walk order: Z2→Z11 along the façade, both tiered halls, the ~80 m² room by the
halls, Z24/Z25 and their neighbours). The correction costs nothing on devices because the
app requests `rooms-9000001.geojson` only once the bundled `buildings.json` lists Z, so
nobody holds a cached copy until that app release. Corrections after the release take up
to 30 days to reach devices (see `src/api/campusMap.ts`).

## reis-data changes (PR 1)

- `source/curated/Z/`:
  - `building.json`
  - `rooms.geojson`
  - `manifest.json`: every source tender URL with PDF sha256, pipeline parameters, fit
    parameters, tool versions, and the frrms_structure sha256.
  - `README.md`: provenance, the synthetic `BZ00` prefix, and the licence decision.
  - The generator that turns `frrms_structure.geojson` into these two files, so the
    export is reproducible. The segmentation pipeline itself stays in the private folder,
    because it needs the PDFs.
- `scripts/buildMapData.mjs`: merge curated buildings into `buildings.json` (step 3),
  emit `map/rooms-<id>.geojson` for them (step 1), and add them to the rooms index
  (step 2). **Never recompute campus bounds.** A re-fetch of the MENDELU API must not
  wipe curated data: curated files are separate inputs, never edits to `source/mendelu-*`.
- `scripts/pairIsRooms.mjs`: scope extended from campus 1 to also campus 139 (ČP II.),
  with the prefix taken from curated buildings too. Handle door-number `Číslo` (284/285)
  and the two wrong links (Z11, Z15) with an explicit, commented override table, not
  heuristics.
- `scripts/placeIsRooms.mjs`: ČP II. Z rooms leave the landmark-1587 fallback. K01–K03
  (Budova K, not Z) keep a place target (see "Open item").
- Tests: curated schema, pairing for ČP II. (including 284/285, Z11, Z15, Z24–Z28, the
  Aula collision) and placement.

## reis-extension changes (PR 2)

- Copy only the regenerated files into `src/data/map/`: `buildings.json`, `isRoomLabels.json`
  and `isRoomPlaces.json`, plus the new Z entries in `rooms-index.json`, added by hand
  because that file carries hand edits. Build into a scratch `--ext=` dir, and `cmp`
  `landmarks.json`/`remotePlaces.json` first.
- Landmark 1587 stops being drawn: building Z takes its outline and the "Z" letter
  (`LANDMARK_LETTERS` in `mapLayers.ts`). Kolej Akademie (1616) shares the outline:
  - it is not drawn as a second polygon;
  - Z's building card shows "Also here: Kolej Akademie" (today that line exists only on
    landmark cards, in `DetailPanel.tsx`);
  - searching "Kolej Akademie" still finds it.
- "Aula (ČP II.)" must resolve to Z's Aula. This depends on the campus-aware label fix
  running in its own session ("Fix FRRMS 'Aula (ČP II.)' resolving to building A"), which
  lands first.
- Tests that hardcode seven buildings or Z's absence are updated with the new expectation,
  not deleted:
  - `mapData.test.ts:22`, `campusGraph.test.ts:85`, `campusWalksData.test.ts:11`;
  - `RoutePicker.test.tsx:33-36` (Z still absent from routing in v1);
  - `nextLessonTarget.test.ts:60`: Z25 now resolves to a room, but no route;
  - `lookupRoomPlace.test.ts:15`, `createMapSlice.test.ts:173`.
- **Both trees.** The change lives in shared `CampusMap/` and data, so the extension and
  the phone/iPad tree get it together. Verify with `verify-ui` at 320/390/430 and tablet
  width, in both themes:
  - FRRMS opens on 2.NP;
  - the floor switcher shows four floors;
  - Z14 via search focuses its room;
  - a next-lesson card for a Z room shows its room, not the landmark.

## Error handling

This uses the existing paths. A missing or failed CDN fetch for Z falls back the way
every building does (stale cache, else no rooms). The schema validates the curated
geojson like any other.

## Open item

K01–K03 are Budova K (ÚCB AF), another building on the same campus, and today they point
at landmark 1587, which is wrong already. With 1587 no longer drawn, retarget them to a
Budova K pin if one exists. Otherwise point them at the campus, or leave them unplaced.
Pick whichever of these exists, and say so in the PR.

## Out of scope

Routing into Z; 1.PP and 5.–8.NP; equipment flags; the vector-native re-segmentation and
the matching-based identity assignment from the accuracy research. The research files
record those for a later pass.
