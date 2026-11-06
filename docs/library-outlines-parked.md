# Library outlines on the map (parked, 2026-10-30)

Dominik drew both libraries on the floor plan (building A, floor -1, `floorId` 57574):
**Knihovna A** (purple) and **Knihovna IC** (orange). The idea: a student should see the
library as ONE place with a name, and the bookable study rooms inside it, instead of six
rooms that look random. A first build worked; it was parked to finish and ship booking first.

## What was built, and how it looked

- Two closed outlines drawn under the rooms while the library screen is open: the picked one
  solid and tinted orange (`#ea580c`, 3 px, fill 0.14), the other dashed (2 px, fill 0.06),
  both named ("Knihovna A" / "Knihovna IC") by a permanent `building-label` tooltip in
  `LABELS_PANE`, `interactive: false`, `poly.bringToBack()`.
- Chips `Knihovna A` / `Knihovna IC` framed the study rooms padded by 1.2 (`LatLngBounds.pad`):
  framing the whole footprint made the rooms too small to name (rooms are a few metres in a 60 m wing).
- A's outline: the library-typed rooms of the wing (A015 57618, A005 57615, AS01 57631 and the four
  study rooms) plus the hall (P1028 57607, P1021 57613), closed by 2.5 m, plus a straight bridge along
  the south side of the corridor between wing and hall (Dominik's line): quad
  (1208340, 5439637) (1208379, 5439661) (1208358, 5439661) (1208341, 5439660) in metres east/north of
  the local projection `x = lng*cos(49.21deg)*111320, y = lat*110540`.
- IC's outline: P1008 57636, BA01P1012 57640 (the IC rooms), P1015 57638, P1014 57641, P1013 57642,
  closed by 2.5 m. Computed offline with shapely (not a dependency), simplified to 0.35 m.
- Label anchors: A `[16.615316, 49.210013]`, IC `[16.615845, 49.210305]` ([lng, lat]).

## Why it was parked

- Still open when parked: on a fresh pin tap the camera sometimes stayed at campus level until a chip was
  tapped (only while building A's floor was still loading: the `!fc` branch of the draw effect fits the
  building, and the refit when rooms arrive did not always land).
- The student persona (reis-student) read the outline as "a building shape" and the name as the cue;
  it wanted a "how do I get there" action on the list, and did not know what IC means.
- Needs its own pass on look, label collisions and the framing; the booking did not depend on it.

## Rings ([lng, lat], closed)

```ts
const RING_A: number[][] = [
  [16.615116, 49.209984],
  [16.61519, 49.210012],
  [16.615215, 49.209994],
  [16.615237, 49.20999],
  [16.615314, 49.210014],
  [16.615336, 49.209991],
  [16.615337, 49.209979],
  [16.615353, 49.209957],
  [16.615406, 49.209897],
  [16.615432, 49.209879],
  [16.615649, 49.209888],
  [16.615693, 49.209915],
  [16.615746, 49.209928],
  [16.615835, 49.209923],
  [16.615853, 49.209931],
  [16.615859, 49.209945],
  [16.615917, 49.209974],
  [16.615933, 49.209955],
  [16.615917, 49.209944],
  [16.615915, 49.209929],
  [16.615949, 49.209887],
  [16.6159, 49.209869],
  [16.615887, 49.209855],
  [16.615797, 49.209823],
  [16.61578, 49.209822],
  [16.615406, 49.209671],
  [16.615386, 49.209676],
  [16.615357, 49.209704],
  [16.615195, 49.209894],
  [16.615146, 49.209934],
  [16.615118, 49.20997],
  [16.615116, 49.209984],
];

const RING_IC: number[][] = [
  [16.615613, 49.210344],
  [16.615722, 49.210386],
  [16.615806, 49.210292],
  [16.615834, 49.210286],
  [16.615866, 49.210296],
  [16.615923, 49.210232],
  [16.61594, 49.210226],
  [16.615975, 49.210227],
  [16.615989, 49.210222],
  [16.616176, 49.210001],
  [16.616115, 49.209978],
  [16.616085, 49.20996],
  [16.616003, 49.209936],
  [16.615805, 49.210153],
  [16.615826, 49.210188],
  [16.615817, 49.210213],
  [16.615802, 49.210222],
  [16.615783, 49.210224],
  [16.615731, 49.210206],
  [16.615613, 49.210344],
];
```

## Drawing code (was `src/components/CampusMap/libraryAreas.ts`)

```ts
import L from 'leaflet';
import { LIBRARY_AREAS, areaOfPart } from '../../data/map/libraryAreas';
import type { LibraryPart } from '../../data/map/libraryRooms';
import { LABELS_PANE } from './mapPanes';

/** reIS orange: the library is one thing, so it gets one colour that is not a room's. */
const AREA = '#ea580c';

const latLngs = (ring: number[][]): L.LatLngTuple[] => ring.map(([x, y]) => [y!, x!]);

/** The box of one library's outline: what the camera frames for that part. */
export function areaBounds(part: LibraryPart): L.LatLngBounds {
  return L.latLngBounds(latLngs(areaOfPart(part).ring));
}

/**
 * Draws both libraries as places while the library screen is open: the picked
 * one solid and tinted, the other dashed, each named beside its study rooms. The
 * outlines go UNDER the rooms, so the study rooms keep their colour on top of
 * them and the reading rooms around them are just "inside the library".
 */
export function drawLibraryAreas(
  group: L.LayerGroup,
  picked: LibraryPart | null,
  lang: 'cz' | 'en'
): void {
  group.clearLayers();
  if (picked === null) return;
  for (const area of LIBRARY_AREAS) {
    const on = area.part === picked;
    const poly = L.polygon(latLngs(area.ring), {
      color: AREA,
      weight: on ? 3 : 2,
      opacity: on ? 0.95 : 0.7,
      dashArray: on ? undefined : '6 5',
      fillColor: AREA,
      fillOpacity: on ? 0.14 : 0.06,
      interactive: false,
    });
    group.addLayer(poly);
    poly.bringToBack();
    const [lng, lat] = area.labelAt;
    group.addLayer(
      L.tooltip({
        permanent: true,
        direction: 'top',
        className: 'building-label',
        pane: LABELS_PANE,
        interactive: false,
      })
        .setLatLng([lat, lng])
        .setContent(lang === 'cz' ? area.labelCs : area.labelEn)
    );
  }
}

```
