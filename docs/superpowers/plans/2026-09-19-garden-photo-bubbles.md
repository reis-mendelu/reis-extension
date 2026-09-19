# Botanical Garden Photo Bubbles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the MENDELU botanical garden's inner map twelve places carried by their own photograph — a small circular crop that grows under the cursor and opens into a card — plus nineteen more as plain dots.

**Architecture:** A new hand-authored data file (`gardenPlaces.json`) holds the twelve; the existing hand-curated `pois` array on remote place `-101` holds the other nineteen. Bubbles are Leaflet `divIcon` markers drawn by a new layer module, gated on the existing drill-in rule, with their growth and zoom-hiding done in CSS exactly as `.building-label` already does. The card is one component shared by the desktop panel and the mobile sheet.

**Tech Stack:** TypeScript, React, Zustand, Leaflet 1.x, Tailwind + DaisyUI, Vitest.

**Spec:** [`docs/superpowers/specs/2026-09-19-garden-photo-bubbles-design.md`](../specs/2026-09-19-garden-photo-bubbles-design.md)

## Global Constraints

- **Parser Rules do not apply here** — nothing in this plan touches an IS Mendelu HTML parser.
- **No `localStorage` / `sessionStorage`.** Not needed by this plan at all.
- **No custom CSS** except Leaflet-generated DOM, which the `.garden-bubble` rules are. They go in `src/index.css` beside `.room-label` / `.place-label`. Everything in React uses Tailwind + DaisyUI semantic classes.
- **No `useEffect` for data fetching.** The full photo is an `<img src>`; the browser fetches it. There is no fetch client in this plan.
- **Max 200 lines per file.**
- **Direct imports only** — no re-export barrels.
- **Test first.** Every task writes a failing test before implementation.
- **Language codes are `'cz' | 'en'`**, never `'cs'`, outside `Intl` and locale filenames.
- Run tests with `npx vitest run <path>`.
- Commit messages end with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## Two deliberate deviations from the spec

Both simplify; flag to the maintainer if either is unwanted.

1. **No IndexedDB photo cache and no `src/api/gardenPhotos.ts`.** The spec proposed copying the `successRate.ts` fetch-and-cache pattern. A photograph is not JSON: a plain `<img src>` pointed at jsDelivr is cached by the browser, needs no `DB_VERSION` bump (currently 22, a migration every user would run), and needs no manifest change — `content_security_policy` in `wxt.config.ts:132` constrains only `script-src` and `object-src`, and `https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main/*` is already in `host_permissions` (`wxt.config.ts:109`). The user-visible behaviour the spec promised — blurred bundled thumb first, full photo swapped in, never a grey box — is unchanged. This drops the spec's tests 6 (photo-client cache/failure) and 7 (no request at startup): with no client there is nothing to cache and nothing to fire early, since the `<img>` mounts only when the card does.
2. **The zoom floor is CSS, not a redraw.** `drawRemotePlaces` runs from a store-driven effect that knows nothing about zoom. Rather than add a zoom listener that rebuilds markers, a container class is toggled on `zoomend` and the bubbles are hidden by CSS — the mechanism `reis-hide-building-labels` already uses at `mapLayers.ts:93-96`.

## File Structure

**Created**
- `src/data/map/gardenPlaces.json` — the twelve. Hand-authored, never generated.
- `src/data/map/__tests__/pointInRing.ts` — shared ray-casting helper, extracted from `mapData.test.ts`.
- `src/data/map/__tests__/gardenPlaces.test.ts` — schema, geometry, duplication, count.
- `src/components/CampusMap/gardenBubbleLayer.ts` — builds the markers. One responsibility.
- `src/components/CampusMap/__tests__/gardenBubbleLayer.test.ts`
- `src/components/CampusMap/GardenPlaceCard.tsx` — the card, shared by both shells.
- `src/components/CampusMap/__tests__/GardenPlaceCard.test.tsx`
- `public/garden/<id>.webp` — 96×96 bundled thumbs (added as photos are chosen).

**Modified**
- `src/types/campusMap.ts` — `GardenPlace`, and a new `MapSelection` member.
- `src/store/slices/createMapSlice.ts` — `selectGardenPlace`.
- `src/data/map/remotePlaces.json` — `Skleníky` leaves `pois`; eighteen new dots join it.
- `src/data/map/__tests__/mapData.test.ts` — imports the extracted helper.
- `src/components/CampusMap/mapLayers.ts` — `drawRemotePlaces` draws bubbles for `-101`.
- `src/components/CampusMap/MapCanvas.tsx:220` — drill-in must survive a garden selection.
- `src/components/CampusMap/DetailPanel.tsx` — renders the card.
- `src/components/mobile/screens/map/MapPanelBody.tsx` + `MapSheet.tsx` — the phone's card.
- `src/components/mobile/screens/MapScreen.tsx` — search result label.
- `src/index.css` — `.garden-bubble`.
- `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`.

---

### Task 1: The `GardenPlace` type, the data file, and its guards

Seeds the file with the two places whose coordinates are already real data, so the tests have something true to check. Task 2 authors the rest.

**Files:**
- Modify: `src/types/campusMap.ts`
- Create: `src/data/map/gardenPlaces.json`
- Create: `src/data/map/__tests__/pointInRing.ts`
- Create: `src/data/map/__tests__/gardenPlaces.test.ts`
- Modify: `src/data/map/__tests__/mapData.test.ts:20-31` (delete the local `pointInRing`, import it)
- Modify: `src/data/map/remotePlaces.json` (remove the `Skleníky` entry from `places[-101].pois`)

**Interfaces:**
- Consumes: `RemotePlace` from `src/types/campusMap.ts`.
- Produces: `interface GardenPlace`; `pointInRing(point: number[], ring: number[][]): boolean`.

- [ ] **Step 1: Extract the ray-casting helper**

Create `src/data/map/__tests__/pointInRing.ts`:

```ts
/** Ray casting, mirroring the selection the fetch script makes. */
export function pointInRing(point: number[], ring: number[][]): boolean {
  const px = point[0]!;
  const py = point[1]!;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
```

In `src/data/map/__tests__/mapData.test.ts`, delete its local copy of `pointInRing` and add to the imports:

```ts
import { pointInRing } from './pointInRing';
```

- [ ] **Step 2: Write the failing test**

Create `src/data/map/__tests__/gardenPlaces.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import gardenPlaces from '../gardenPlaces.json';
import remotePlaces from '../remotePlaces.json';
import { pointInRing } from './pointInRing';
import type { GardenPlace, RemotePlace } from '../../../types/campusMap';

const PLACES = (gardenPlaces as { places: GardenPlace[] }).places;
const GARDEN = (remotePlaces as { places: RemotePlace[] }).places.find((p) => p.id === -101)!;
const RING = GARDEN.area!.coordinates[0]!;

describe('gardenPlaces.json', () => {
  it('gives every place a unique id and both languages', () => {
    const ids = new Set<string>();
    for (const p of PLACES) {
      expect(p.id).toMatch(/^[a-z0-9-]+$/);
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.name.cz.length).toBeGreaterThan(0);
      expect(p.name.en.length).toBeGreaterThan(0);
      expect(p.why.cz.length).toBeGreaterThan(0);
      expect(p.why.en.length).toBeGreaterThan(0);
    }
  });

  it('numbers every place per the official plan', () => {
    for (const p of PLACES) {
      expect(p.number).toMatch(/^[1-5]\.\d{1,2}$/);
      expect(p.section).toBe(Number(p.number.split('.')[0]));
    }
  });

  it('places every point inside the garden', () => {
    for (const p of PLACES) {
      expect(pointInRing([p.lon, p.lat], RING), `${p.id} is outside the garden`).toBe(true);
    }
  });

  it('never lists a place as both a bubble and a dot', () => {
    const dotNames = new Set((GARDEN.pois ?? []).map((d) => d.name));
    for (const p of PLACES) {
      expect(dotNames.has(p.name.cz), `${p.name.cz} is both a bubble and a dot`).toBe(false);
    }
  });

  it('only records a hashed filename for a photo', () => {
    for (const p of PLACES) {
      if (p.photo !== undefined) expect(p.photo).toMatch(/^[a-z0-9-]+\.[0-9a-f]{6}\.webp$/);
    }
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run src/data/map/__tests__/gardenPlaces.test.ts`
Expected: FAIL — `Cannot find module '../gardenPlaces.json'`.

- [ ] **Step 4: Add the type**

In `src/types/campusMap.ts`, after the `RemotePlace` interface:

```ts
// A place INSIDE the botanical garden that is worth walking to — one of the
// twelve carried by its own photograph, as opposed to the nineteen that stay
// plain dots in `RemotePlace.pois`. Hand-authored in
// `src/data/map/gardenPlaces.json`; no script generates or touches it.
//
// The curation line is "somewhere you would send a friend to sit", which is
// what `why` has to earn — not a description of the plants.
export interface GardenPlace {
  /** Stable slug, and the stem of the bundled thumb: `public/garden/<id>.webp`. */
  id: string;
  /** The garden's own published numbering, e.g. "2.6" for Rokle. */
  number: string;
  /** 1 Okolí správní budovy … 5 Botanický systém — the first half of `number`. */
  section: 1 | 2 | 3 | 4 | 5;
  name: { cz: string; en: string };
  /** ONE line: the reason to walk there. */
  why: { cz: string; en: string };
  lon: number;
  lat: number;
  /**
   * The FULL photo's filename on the CDN, content-hashed
   * (`rokle.8f3a1c.webp`) because jsDelivr caches `@main` mutably and a
   * replaced photo at the same path would not propagate.
   *
   * Optional on purpose: coordinates are one pass and land first, photographs
   * are picked on their own schedule. A place without one renders as a dot.
   */
  photo?: string;
  /** Author + licence; rendered under the photo only when set. */
  credit?: string;
}
```

- [ ] **Step 5: Seed the data file**

Create `src/data/map/gardenPlaces.json`. Both coordinates below are the ones already in `remotePlaces.json` — real data, not invented:

```json
{
  "places": [
    {
      "id": "skleniky",
      "number": "1.2",
      "section": 1,
      "name": { "cz": "Skleníky", "en": "Greenhouses" },
      "why": {
        "cz": "Čtyři skleníky orchidejí — jedna z největších sbírek v Evropě. V zimě nejteplejší místo v Brně.",
        "en": "Four greenhouses of orchids, among the largest collections in Europe. The warmest place in Brno in winter."
      },
      "lon": 16.61432,
      "lat": 49.215612
    },
    {
      "id": "spravni-budova",
      "number": "1.1",
      "section": 1,
      "name": { "cz": "Správní budova a učebny", "en": "Administration and classrooms" },
      "why": {
        "cz": "Vchod do zahrady a místo, kde se platí — nebo neplatí, s průkazem MENDELU.",
        "en": "The way in, and where you pay — or don't, with a MENDELU card."
      },
      "lon": 16.614536,
      "lat": 49.215447
    }
  ]
}
```

- [ ] **Step 6: Remove the duplicate dot**

In `src/data/map/remotePlaces.json`, inside `places` where `"id": -101`, delete the `pois` entry named `"Skleníky"`. `"Správní budova"` also becomes a bubble above, so delete that entry too — `pois` ends this task as an empty array `[]`, which Task 2 fills with the nineteen dots.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/data/map/__tests__/`
Expected: PASS — both `gardenPlaces.test.ts` and `mapData.test.ts` (which now imports the extracted helper).

- [ ] **Step 8: Commit**

```bash
git add src/types/campusMap.ts src/data/map/gardenPlaces.json src/data/map/remotePlaces.json src/data/map/__tests__/
git commit -m "$(cat <<'EOF'
feat(map): add the GardenPlace type and its guards

Twelve places in the botanical garden get their own file, because
remotePlaces.json is generated geometry and this is hand-written editorial
content. Seeded with the two whose coordinates are already real data; the
tests assert every point lands inside the garden polygon.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: All thirty-one places

The georeferencing pass. Coordinates are read off the garden's published plan (`https://arboretum.mendelu.cz/wp-content/uploads/2022/02/mapka.jpg`, 900×677, markers numbered 1.1–5.14) and placed against the 32 footpaths already in `remotePlaces.json`. **OpenStreetMap cannot supply these** — Overpass over the garden polygon returns 15 elements and no named collection.

The safety net is a test: every place must be inside the garden *and* within 40 m of a mapped footpath, because all of these are places you walk to.

**Files:**
- Modify: `src/data/map/gardenPlaces.json` (2 places → 12)
- Modify: `src/data/map/remotePlaces.json` (`places[-101].pois`: `[]` → 19 dots)
- Modify: `src/data/map/__tests__/gardenPlaces.test.ts`

**Interfaces:**
- Consumes: `GardenPlace`, `pointInRing` from Task 1.
- Produces: the complete 31-place dataset every later task renders.

- [ ] **Step 1: Write the failing tests**

Append to `src/data/map/__tests__/gardenPlaces.test.ts`:

```ts
/** Metres between two lon/lat points, flat-earth — fine over 400 m. */
function metres(a: number[], b: number[]): number {
  const mPerDegLat = 111_320;
  const mPerDegLon = mPerDegLat * Math.cos((a[1]! * Math.PI) / 180);
  const dx = (a[0]! - b[0]!) * mPerDegLon;
  const dy = (a[1]! - b[1]!) * mPerDegLat;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Distance from a point to the nearest vertex of any mapped footpath. */
function metresToNearestPath(point: number[], paths: number[][][]): number {
  let best = Infinity;
  for (const path of paths) for (const v of path) best = Math.min(best, metres(point, v));
  return best;
}

describe('the thirty-one places', () => {
  const dots = GARDEN.pois ?? [];

  it('covers the official plan once, with no gaps and no repeats', () => {
    expect(PLACES).toHaveLength(12);
    expect(dots).toHaveLength(19);
    const numbers = PLACES.map((p) => p.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('puts every dot inside the garden too', () => {
    for (const d of dots) {
      expect(pointInRing([d.lon, d.lat], RING), `${d.name} is outside the garden`).toBe(true);
    }
  });

  it('puts every place within walking reach of a mapped footpath', () => {
    const paths = GARDEN.paths!;
    for (const p of PLACES) {
      expect(metresToNearestPath([p.lon, p.lat], paths), `${p.id} is nowhere near a path`)
        .toBeLessThan(40);
    }
    for (const d of dots) {
      expect(metresToNearestPath([d.lon, d.lat], paths), `${d.name} is nowhere near a path`)
        .toBeLessThan(40);
    }
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/data/map/__tests__/gardenPlaces.test.ts`
Expected: FAIL — `expected [ …2 items ] to have a length of 12`.

- [ ] **Step 3: Author the twelve bubbles**

Extend `gardenPlaces.json` to twelve entries. The ten to add, chosen on the "somewhere to sit" line, with their official numbers:

| id | number | name (cz) |
|---|---|---|
| `transeje` | 1.3 | Tranšeje |
| `rokle` | 2.6 | Rokle |
| `terasy` | 2.9 | Terasy |
| `vodni-kaskada` | 3.2 | Vodní kaskáda |
| `pergoly` | 3.4 | Pergoly |
| `alpinum` | 4.4 | Alpinum |
| `rostliny-jizni-polokoule` | 4.5 | Rostliny jižní polokoule |
| `zahrada-vysociny` | 4.6 | Zahrada Vysočiny |
| `zahrada-pro-nevidome` | 5.9 | Zahrada pro nevidomé |
| `ruze` | 5.14 | Růže |

For each: read its numbered marker's position on the plan image, find the same spot on the garden's own footpath network in `remotePlaces.json` (`places[-101].paths`), and take `lon`/`lat` from there. Write a `why` that says why you would *sit* there, in both languages, one line. Leave `photo` and `credit` out entirely until a photograph is chosen.

- [ ] **Step 4: Author the nineteen dots**

Fill `places[-101].pois` in `remotePlaces.json` with the remaining nineteen from the plan, in the existing `{ "name", "lon", "lat" }` shape, same method: 2.1 Středomoří, 2.2 Kavkaz, 2.3 Jihovýchodní Evropa, 2.4 Severní Amerika, 2.5 Step jihovýchodní Evropy, 2.7 Sbírka lomikamenů, 2.8 Alpinkový skleník, 3.1 Sbírka vrb, 3.3 Duby a skalníky, 3.5 Denivky, 4.1 Vždyzelený svah, 4.2 Východoasijské trvalky, 4.3 Původní sbírka dřevin, 4.7 Meteorologická stanice, 5.9–5.14 minus the two that are bubbles — i.e. 5.10 Zahrada miniatur, 5.11 Jednoděložné, 5.12 Hvězdnicovité, 5.13 Pryskyřníkovité — plus 5.1 Rostliny léčivé a užitkové.

`fetch-remote-places.mjs:176` lists `pois` in `PRESERVE`, so these survive a refetch; no change to that script.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/data/map/__tests__/`
Expected: PASS. A failure naming a place is a misread coordinate — fix the coordinate, never the tolerance.

- [ ] **Step 6: Commit**

```bash
git add src/data/map/gardenPlaces.json src/data/map/remotePlaces.json src/data/map/__tests__/gardenPlaces.test.ts
git commit -m "$(cat <<'EOF'
feat(map): place all thirty-one spots in the botanical garden

Twelve bubbles and nineteen dots, read off the garden's own published plan
and placed against the footpath network already in remotePlaces.json —
OpenStreetMap maps nothing inside the fence. Tests assert each point is in
the garden and within 40 m of a path you can actually walk.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The bubble layer

**Files:**
- Create: `src/components/CampusMap/gardenBubbleLayer.ts`
- Create: `src/components/CampusMap/__tests__/gardenBubbleLayer.test.ts`
- Modify: `src/index.css` (after the `.leaflet-tooltip.place-label` block, ~line 483)

**Interfaces:**
- Consumes: `GardenPlace` (Task 1), the data file (Task 2).
- Produces:
  - `GARDEN_PLACE_ID: -101`
  - `GARDEN_PLACES: GardenPlace[]`
  - `BUBBLE_HIDE_BELOW_ZOOM: 17`
  - `drawGardenBubbles(layer: L.LayerGroup, opts: { lang: Language; touch: boolean; onSelect: (place: GardenPlace) => void }): number` — returns the number of markers added.

- [ ] **Step 1: Write the failing test**

Create `src/components/CampusMap/__tests__/gardenBubbleLayer.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import L from 'leaflet';
import { drawGardenBubbles, GARDEN_PLACES } from '../gardenBubbleLayer';

describe('drawGardenBubbles', () => {
  it('adds one marker per garden place', () => {
    const layer = L.layerGroup();
    const n = drawGardenBubbles(layer, { lang: 'cz', touch: false, onSelect: () => {} });
    expect(n).toBe(GARDEN_PLACES.length);
    expect(layer.getLayers()).toHaveLength(GARDEN_PLACES.length);
  });

  it('hands the clicked place to onSelect', () => {
    const layer = L.layerGroup();
    const onSelect = vi.fn();
    drawGardenBubbles(layer, { lang: 'cz', touch: false, onSelect });
    (layer.getLayers()[0] as L.Marker).fire('click');
    expect(onSelect).toHaveBeenCalledWith(GARDEN_PLACES[0]);
  });

  it('rests bigger on a touch device, where there is no hover to grow it', () => {
    const mouse = L.layerGroup();
    const touch = L.layerGroup();
    drawGardenBubbles(mouse, { lang: 'cz', touch: false, onSelect: () => {} });
    drawGardenBubbles(touch, { lang: 'cz', touch: true, onSelect: () => {} });
    const size = (g: L.LayerGroup) =>
      ((g.getLayers()[0] as L.Marker).options.icon as L.DivIcon).options.iconSize as L.PointTuple;
    expect(size(touch)[0]).toBeGreaterThan(size(mouse)[0]);
    expect(size(touch)[0]).toBeGreaterThanOrEqual(44);
  });

  it('labels each bubble in the chosen language', () => {
    const cz = L.layerGroup();
    drawGardenBubbles(cz, { lang: 'cz', touch: false, onSelect: () => {} });
    expect((cz.getLayers()[0] as L.Marker).getTooltip()!.getContent()).toBe(
      GARDEN_PLACES[0]!.name.cz
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/CampusMap/__tests__/gardenBubbleLayer.test.ts`
Expected: FAIL — cannot resolve `../gardenBubbleLayer`.

- [ ] **Step 3: Write the layer**

Create `src/components/CampusMap/gardenBubbleLayer.ts`:

```ts
import L from 'leaflet';
import gardenPlacesJson from '../../data/map/gardenPlaces.json';
import type { GardenPlace } from '../../types/campusMap';
import type { Language } from '../../store/types';

/** The botanical garden's id in remotePlaces.json — the only site with bubbles. */
export const GARDEN_PLACE_ID = -101;

export const GARDEN_PLACES = (gardenPlacesJson as { places: GardenPlace[] }).places;

/**
 * Below this zoom the twelve converge into a heap of overlapping circles, so
 * they are hidden — by a container class toggled on `zoomend`, the way
 * `reis-hide-building-labels` already works, rather than by rebuilding markers
 * the store-driven redraw knows nothing about.
 */
export const BUBBLE_HIDE_BELOW_ZOOM = 17;

/** Resting diameter. A mouse grows it on hover; a finger cannot, so a touch
 *  device rests at the 44 px minimum target instead. */
const SIZE_MOUSE = 28;
const SIZE_TOUCH = 44;

export interface GardenBubbleOptions {
  lang: Language;
  /** True on a coarse pointer: no hover exists, so the middle state does not. */
  touch: boolean;
  onSelect: (place: GardenPlace) => void;
}

/**
 * A photograph pinned at each of the garden's twelve places. Only drawn when
 * the garden is drilled into — see drawRemotePlaces — so the campus overview
 * never becomes a gallery.
 *
 * The thumb is bundled (`public/garden/<id>.webp`, 96×96, ~4 KB) rather than
 * fetched: this is the state you see almost all the time, and it has to paint
 * instantly, offline, standing in the garden on one bar of signal.
 */
export function drawGardenBubbles(layer: L.LayerGroup, opts: GardenBubbleOptions): number {
  const size = opts.touch ? SIZE_TOUCH : SIZE_MOUSE;
  let drawn = 0;
  for (const place of GARDEN_PLACES) {
    const icon = L.divIcon({
      className: 'garden-bubble',
      html: `<img src="/garden/${place.id}.webp" alt="" />`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
    L.marker([place.lat, place.lon], { icon, title: place.name[opts.lang] })
      .on('click', () => opts.onSelect(place))
      .bindTooltip(place.name[opts.lang], {
        direction: 'top',
        offset: [0, -size / 2],
        className: 'place-label',
      })
      .addTo(layer);
    drawn++;
  }
  return drawn;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/CampusMap/__tests__/gardenBubbleLayer.test.ts`
Expected: PASS.

- [ ] **Step 5: Style the bubble**

Add to `src/index.css`, directly after the `.leaflet-tooltip.place-label::before` block:

```css
/* One of the garden's twelve places, carried by its own photograph. Leaflet
 * builds this DOM from a divIcon and takes a single className, which is why
 * this is CSS and not a Tailwind class — the same standing exception as
 * .room-label and .place-label above.
 *
 * The growth is a transform, not a size change: Leaflet positions the icon by
 * its top-left corner, so animating width/height would walk the bubble off its
 * own place while it grows. */
.leaflet-marker-icon.garden-bubble {
  border-radius: 9999px;
  overflow: hidden;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 6px rgb(15 23 42 / 0.28);
  background: #e3ebdd;
  transition:
    transform 140ms ease-out,
    box-shadow 140ms ease-out;
}
.leaflet-marker-icon.garden-bubble img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
/* Only where a pointer can actually hover. On a phone this rule must not exist
 * at all, or a tap leaves the bubble stuck at 2x until something else is
 * tapped. */
@media (hover: hover) {
  .leaflet-marker-icon.garden-bubble:hover {
    transform: scale(2);
    box-shadow: 0 8px 20px rgb(15 23 42 / 0.32);
    z-index: 1000;
  }
}
/* Zoomed out, twelve circles land on top of each other — toggled from
 * MapCanvas by zoom, exactly like the building letters. */
.reis-hide-garden-bubbles .leaflet-marker-icon.garden-bubble {
  display: none;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/CampusMap/gardenBubbleLayer.ts src/components/CampusMap/__tests__/gardenBubbleLayer.test.ts src/index.css
git commit -m "$(cat <<'EOF'
feat(map): draw the garden's places as photo bubbles

A divIcon carrying the bundled 96px thumb. Grows on hover where a pointer
can hover, and rests at the 44px touch target where it cannot, because a
finger has no middle state between resting and opening.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire the layer in, without losing the drill-in

The trap: `MapCanvas.tsx:220` decides the garden is "drilled in" by asking whether the *selection* is a `poi` whose id is a remote place. Selecting a garden place would therefore collapse the garden back to an outline and take the bubbles with it. The selection kind has to count as drilled too.

**Files:**
- Modify: `src/types/campusMap.ts` (the `MapSelection` union)
- Modify: `src/store/slices/createMapSlice.ts:110` (add the action)
- Modify: `src/components/CampusMap/mapLayers.ts:155-199` (`drawRemotePlaces`)
- Modify: `src/components/CampusMap/MapCanvas.tsx:218-223` and its zoom handling
- Create: `src/components/CampusMap/__tests__/gardenDrillIn.test.ts`

**Interfaces:**
- Consumes: `drawGardenBubbles`, `GARDEN_PLACE_ID`, `BUBBLE_HIDE_BELOW_ZOOM` (Task 3).
- Produces:
  - `MapSelection` member `{ kind: 'gardenPlace'; place: GardenPlace }`
  - store action `selectGardenPlace(place: GardenPlace): void`
  - `drilledRemoteId(selection: MapSelection | null): number | null` exported from `mapLayers.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/CampusMap/__tests__/gardenDrillIn.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { drilledRemoteId } from '../mapLayers';
import { GARDEN_PLACES, GARDEN_PLACE_ID } from '../gardenBubbleLayer';
import type { MapSelection } from '../../../types/campusMap';

describe('drilledRemoteId', () => {
  it('keeps the garden open while one of its places is selected', () => {
    const sel: MapSelection = { kind: 'gardenPlace', place: GARDEN_PLACES[0]! };
    expect(drilledRemoteId(sel)).toBe(GARDEN_PLACE_ID);
  });

  it('still drills in on the site itself', () => {
    const sel: MapSelection = {
      kind: 'poi',
      poi: { id: GARDEN_PLACE_ID, name: 'Botanická zahrada', type: '', url: null, phone: null, email: null },
      coord: [16.6132, 49.2135],
    };
    expect(drilledRemoteId(sel)).toBe(GARDEN_PLACE_ID);
  });

  it('is closed for a room, an event, or nothing at all', () => {
    expect(drilledRemoteId(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/CampusMap/__tests__/gardenDrillIn.test.ts`
Expected: FAIL — `drilledRemoteId` is not exported from `mapLayers`.

- [ ] **Step 3: Add the selection kind and the action**

In `src/types/campusMap.ts`, add to the `MapSelection` union:

```ts
  | { kind: 'gardenPlace'; place: GardenPlace } // one of the garden's twelve
```

In `src/store/slices/createMapSlice.ts`, beside `selectMapPoi` at line 110:

```ts
  selectGardenPlace: (place) => set({ mapSelection: { kind: 'gardenPlace', place } }),
```

and declare `selectGardenPlace: (place: GardenPlace) => void;` on the slice's interface next to `selectMapPoi`.

- [ ] **Step 4: Move the drill-in rule into `mapLayers.ts`**

In `src/components/CampusMap/mapLayers.ts`, add above `drawRemotePlaces`:

```ts
/**
 * Which remote site is open, from the current selection.
 *
 * `gardenPlace` counts: selecting one of the garden's twelve must NOT fold the
 * garden back into an outline — that would take the bubble you just clicked
 * off the map with it.
 */
export function drilledRemoteId(selection: MapSelection | null): number | null {
  if (selection?.kind === 'gardenPlace') return GARDEN_PLACE_ID;
  if (selection?.kind === 'poi' && REMOTE_IDS.has(selection.poi.id)) return selection.poi.id;
  return null;
}
```

with these imports added at the top of the file:

```ts
import { drawGardenBubbles, GARDEN_PLACE_ID } from './gardenBubbleLayer';
import type { Landmark, RemotePlace, MapSelection } from '../../types/campusMap';
```

- [ ] **Step 5: Draw the bubbles inside the drilled site**

In `drawRemotePlaces`, inside the `if (drilled || !collapsible)` block, after the `p.pois` loop:

```ts
      if (p.id === GARDEN_PLACE_ID) {
        drawGardenBubbles(layer, {
          lang: select.language,
          touch: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
          onSelect: select.selectGardenPlace,
        });
      }
```

- [ ] **Step 6: Use it from MapCanvas and hide the bubbles when zoomed out**

In `src/components/CampusMap/MapCanvas.tsx`, replace lines 218-223 (the inline `drilledRemoteId` const and the call) with:

```ts
      drawRemotePlaces(layer, select, drilledRemoteId(select.mapSelection));
```

importing `drilledRemoteId` alongside `drawRemotePlaces` at line 23, and deleting the now-unused local const.

In `src/components/CampusMap/mapLayers.ts`, inside `syncLabelVisibility` at line 93, add the second toggle:

```ts
    map
      .getContainer()
      .classList.toggle('reis-hide-garden-bubbles', map.getZoom() < BUBBLE_HIDE_BELOW_ZOOM);
```

importing `BUBBLE_HIDE_BELOW_ZOOM` with the others.

- [ ] **Step 7: Run the suite**

Run: `npx vitest run src/components/CampusMap/ src/store/`
Expected: PASS, including the existing `MapCanvas` and map-slice tests — if one fails on the selection union, it is asserting exhaustively over `MapSelection` and needs the new kind handled, not silenced.

- [ ] **Step 8: Commit**

```bash
git add src/types/campusMap.ts src/store/slices/createMapSlice.ts src/components/CampusMap/
git commit -m "$(cat <<'EOF'
feat(map): open the garden's bubbles without closing the garden

Drill-in was derived from the selection being a poi, so selecting one of the
garden's places would have folded the site back to an outline and taken the
bubble with it. drilledRemoteId() now counts a gardenPlace selection too.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The card

One component, both shells — the pattern `EventDetailCard` already follows.

**Files:**
- Create: `src/components/CampusMap/GardenPlaceCard.tsx`
- Create: `src/components/CampusMap/__tests__/GardenPlaceCard.test.tsx`
- Modify: `src/components/CampusMap/DetailPanel.tsx:28` (desktop)
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`

**Interfaces:**
- Consumes: `GardenPlace` (Task 1), the `gardenPlace` selection kind (Task 4).
- Produces: `<GardenPlaceCard place={place} flush?={boolean} />`

- [ ] **Step 1: Add the strings**

In `src/i18n/locales/cs.json` under `"map"`:

```json
    "gardenHours": "Po–Pá 7:00–15:00 · zdarma s průkazem MENDELU",
    "gardenSection1": "Okolí správní budovy",
    "gardenSection2": "Jižní svahy",
    "gardenSection3": "Centrální část",
    "gardenSection4": "Staré arboretum",
    "gardenSection5": "Botanický systém"
```

In `src/i18n/locales/en.json` under `"map"`:

```json
    "gardenHours": "Mon–Fri 7:00–15:00 · free with a MENDELU card",
    "gardenSection1": "Around the administration building",
    "gardenSection2": "Southern slopes",
    "gardenSection3": "Central part",
    "gardenSection4": "Old arboretum",
    "gardenSection5": "Botanical system"
```

- [ ] **Step 2: Write the failing test**

Create `src/components/CampusMap/__tests__/GardenPlaceCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GardenPlaceCard } from '../GardenPlaceCard';
import type { GardenPlace } from '../../../types/campusMap';

const PLACE: GardenPlace = {
  id: 'rokle',
  number: '2.6',
  section: 2,
  name: { cz: 'Rokle', en: 'The ravine' },
  why: { cz: 'Zarostlý zářez pod jižními svahy.', en: 'An overgrown cut below the slopes.' },
  lon: 16.6123,
  lat: 49.2141,
};

describe('GardenPlaceCard', () => {
  it('names the place, its section and why you would go', () => {
    render(<GardenPlaceCard place={PLACE} />);
    expect(screen.getByText('Rokle')).toBeInTheDocument();
    expect(screen.getByText(/Jižní svahy/)).toBeInTheDocument();
    expect(screen.getByText(/2\.6/)).toBeInTheDocument();
    expect(screen.getByText(PLACE.why.cz)).toBeInTheDocument();
  });

  it('always says when the garden is open and that students get in free', () => {
    render(<GardenPlaceCard place={PLACE} />);
    expect(screen.getByText(/7:00–15:00/)).toBeInTheDocument();
    expect(screen.getByText(/zdarma/)).toBeInTheDocument();
  });

  it('shows the bundled thumb even with no full photo chosen yet', () => {
    const { container } = render(<GardenPlaceCard place={PLACE} />);
    expect(container.querySelector('img[src="/garden/rokle.webp"]')).not.toBeNull();
    // and nothing is reaching for a photo that was never chosen
    expect(container.querySelector('img[src^="https://"]')).toBeNull();
  });

  it('loads the full photo from the CDN when one is recorded', () => {
    render(<GardenPlaceCard place={{ ...PLACE, photo: 'rokle.8f3a1c.webp', credit: 'Jan Novák, CC BY-SA 4.0' }} />);
    expect(screen.getByAltText('Rokle')).toHaveAttribute(
      'src',
      'https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main/garden/rokle.8f3a1c.webp'
    );
    expect(screen.getByText(/Jan Novák/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run src/components/CampusMap/__tests__/GardenPlaceCard.test.tsx`
Expected: FAIL — cannot resolve `../GardenPlaceCard`.

- [ ] **Step 4: Write the card**

Create `src/components/CampusMap/GardenPlaceCard.tsx`:

```tsx
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { GardenPlace } from '../../types/campusMap';

/** Where the full photos live. `@main` is cached mutably by jsDelivr, which is
 *  why `photo` carries a content hash instead of a bare name. */
const PHOTO_CDN = 'https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main/garden';

export interface GardenPlaceCardProps {
  place: GardenPlace;
  /** The rail and sheet frame their own content, so the card renders flush. */
  flush?: boolean;
}

/**
 * One of the garden's twelve, opened.
 *
 * The photo is two images stacked: the bundled 96 px thumb, blurred and scaled,
 * paints immediately with no network — then the full one fades in over it. A
 * student standing in the garden on one bar of signal sees the place either
 * way, and never a grey box or a bare spinner. There is no fetch and no cache
 * here on purpose: an <img> is what the browser already caches well.
 */
export function GardenPlaceCard({ place, flush = false }: GardenPlaceCardProps) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.language);
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className={
        flush
          ? 'space-y-2'
          : 'space-y-2 rounded-lg border border-base-300 bg-base-100 p-4'
      }
    >
      <div className="relative aspect-[5/3] w-full overflow-hidden rounded-box bg-base-200">
        <img
          src={`/garden/${place.id}.webp`}
          alt=""
          role="presentation"
          className={`absolute inset-0 h-full w-full scale-110 object-cover blur-sm transition-opacity duration-300 ${
            loaded ? 'opacity-0' : 'opacity-100'
          }`}
        />
        {place.photo && (
          <img
            src={`${PHOTO_CDN}/${place.photo}`}
            alt={place.name[lang]}
            onLoad={() => setLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </div>

      <h3 className="font-bold text-base-content">{place.name[lang]}</h3>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="badge badge-sm badge-primary">{t(`map.gardenSection${place.section}`)}</span>
        <span className="badge badge-sm badge-ghost">{place.number}</span>
      </div>

      <p className="text-sm text-base-content/70">{place.why[lang]}</p>

      <p className="border-t border-base-300 pt-2 text-xs text-base-content/70">
        {t('map.gardenHours')}
      </p>

      {place.credit && <p className="text-[11px] text-base-content/70">{place.credit}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Render it on the desktop panel**

In `src/components/CampusMap/DetailPanel.tsx`, immediately after the `sel.kind === 'event'` line:

```tsx
  if (sel.kind === 'gardenPlace') return <GardenPlaceCard place={sel.place} />;
```

with `import { GardenPlaceCard } from './GardenPlaceCard';` added to the imports.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/components/CampusMap/`
Expected: PASS, `DetailPanel.test.tsx` included.

- [ ] **Step 7: Commit**

```bash
git add src/components/CampusMap/GardenPlaceCard.tsx src/components/CampusMap/__tests__/GardenPlaceCard.test.tsx src/components/CampusMap/DetailPanel.tsx src/i18n/locales/
git commit -m "$(cat <<'EOF'
feat(map): open a garden place into a card

The bundled thumb paints blurred with no network and the full photo fades in
over it, so the card works standing in the garden on one bar of signal. Every
card carries the thing students do not know: free entry with a MENDELU card,
and that the garden shuts at three and all weekend.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: The phone

`MapPanelBody` currently renders one event or the events list and nothing else, and `MapSheet` hugs its content only for an event. Both need the third case.

**Files:**
- Modify: `src/components/mobile/screens/map/MapPanelBody.tsx`
- Modify: `src/components/mobile/screens/map/MapSheet.tsx:38,76,90,155,195`
- Modify: `src/components/mobile/screens/MapScreen.tsx:13-18` (`resultLabel`)
- Create: `src/components/mobile/screens/map/__tests__/gardenPlaceSheet.test.tsx`

**Interfaces:**
- Consumes: `GardenPlaceCard` (Task 5), the `gardenPlace` selection kind (Task 4).
- Produces: `MapPanelBody` prop `selectedGardenPlace: GardenPlace | null`.

- [ ] **Step 1: Write the failing test**

Create `src/components/mobile/screens/map/__tests__/gardenPlaceSheet.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapPanelBody } from '../MapPanelBody';
import type { GardenPlace } from '../../../../../types/campusMap';

const PLACE: GardenPlace = {
  id: 'rokle',
  number: '2.6',
  section: 2,
  name: { cz: 'Rokle', en: 'The ravine' },
  why: { cz: 'Zarostlý zářez pod jižními svahy.', en: 'An overgrown cut below the slopes.' },
  lon: 16.6123,
  lat: 49.2141,
};

describe('MapPanelBody', () => {
  it('shows a garden place when one is selected', () => {
    render(<MapPanelBody selectedEvent={null} selectedGardenPlace={PLACE} />);
    expect(screen.getByText('Rokle')).toBeInTheDocument();
    expect(screen.getByText(/7:00–15:00/)).toBeInTheDocument();
  });

  it('prefers an event when somehow both are set', () => {
    render(<MapPanelBody selectedEvent={null} selectedGardenPlace={null} />);
    expect(screen.queryByText('Rokle')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/mobile/screens/map/__tests__/gardenPlaceSheet.test.tsx`
Expected: FAIL — `selectedGardenPlace` is not a prop of `MapPanelBody`.

- [ ] **Step 3: Teach the panel body the third case**

In `src/components/mobile/screens/map/MapPanelBody.tsx`, extend the props and the body:

```tsx
export interface MapPanelBodyProps {
  selectedEvent: MapEvent | null;
  /** One of the botanical garden's twelve places, tapped on the map. */
  selectedGardenPlace: GardenPlace | null;
  /** The rail frames its own content, so the card inside it renders flush. */
  flush?: boolean;
}

export function MapPanelBody({
  selectedEvent,
  selectedGardenPlace,
  flush = false,
}: MapPanelBodyProps) {
  if (selectedEvent) {
    return (
      <div className={flush ? 'px-5' : 'px-4'}>
        <EventDetailCard event={selectedEvent} flush={flush} />
      </div>
    );
  }
  if (selectedGardenPlace) {
    return (
      <div className={flush ? 'px-5' : 'px-4'}>
        <GardenPlaceCard place={selectedGardenPlace} flush={flush} />
      </div>
    );
  }
  return <MapEventsSection />;
}
```

adding the imports:

```tsx
import { GardenPlaceCard } from '../../../CampusMap/GardenPlaceCard';
import type { GardenPlace } from '../../../../types/campusMap';
```

- [ ] **Step 4: Give the sheet the same treatment it gives an event**

In `src/components/mobile/screens/map/MapSheet.tsx`, beside the `selectedEvent` const at line 38:

```tsx
  const selectedGardenPlace = selection?.kind === 'gardenPlace' ? selection.place : null;
```

Then, treating a place exactly as an event is treated:
- line 76: `if (selectedEvent || selectedGardenPlace) setSheetState('half');` (and add `selectedGardenPlace` to that effect's dependency array)
- line 90: `const hugContent = !!selectedEvent || !!selectedGardenPlace;`
- line 155: the `selectedEvent ?` branch that renders the title becomes `selectedEvent || selectedGardenPlace ?`, with the title falling back to `selectedGardenPlace.name[lang]`
- line 195: `<MapPanelBody selectedEvent={selectedEvent} selectedGardenPlace={selectedGardenPlace} />`

Pass `selectedGardenPlace` through `MapRail` the same way it already passes `selectedEvent`.

- [ ] **Step 5: Label it in search results**

In `src/components/mobile/screens/MapScreen.tsx`, add to `resultLabel` before the final `return ''`:

```ts
  if (m.kind === 'gardenPlace') return m.place.name.cz;
```

- [ ] **Step 6: Run the mobile suite**

Run: `npx vitest run src/components/mobile/`
Expected: PASS. Existing `MapSheet`/`MapRail` tests that render `MapPanelBody` need `selectedGardenPlace={null}` added — that is the prop becoming required, not a regression.

- [ ] **Step 7: Commit**

```bash
git add src/components/mobile/screens/
git commit -m "$(cat <<'EOF'
feat(map): open a garden place in the phone's sheet

There is no hover on a phone, so one tap goes from the resting bubble
straight to the card. The sheet hugs it and sits at half, the way it already
does for an event.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Photographs, and seeing it

The first photographs land here. Until they do, every place renders as a bubble with an empty tinted circle — which is why this task exists separately: everything above ships and is testable without a single photo.

**Files:**
- Create: `public/garden/<id>.webp` (96×96, one per chosen place)
- Modify: `src/data/map/gardenPlaces.json` (`photo`, `credit`)
- Modify: `src/data/map/__tests__/gardenPlaces.test.ts`
- Push the 800×480 originals to the `reis-data` sibling repo under `garden/`

**Interfaces:**
- Consumes: everything above.
- Produces: the shipped feature.

- [ ] **Step 1: Write the failing test**

Append to `src/data/map/__tests__/gardenPlaces.test.ts`:

```ts
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

describe('garden photographs', () => {
  it('bundles a thumb for every place that has one', () => {
    for (const p of PLACES) {
      const thumb = fileURLToPath(new URL(`../../../../public/garden/${p.id}.webp`, import.meta.url));
      if (p.photo) {
        expect(existsSync(thumb), `${p.id} has a full photo but no bundled thumb`).toBe(true);
      }
    }
  });

  it('credits every photo that is not ours', () => {
    for (const p of PLACES) {
      if (p.credit !== undefined) expect(p.credit.length).toBeGreaterThan(3);
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/data/map/__tests__/gardenPlaces.test.ts`
Expected: PASS trivially while no place has a `photo` — it starts guarding the moment the first one does.

- [ ] **Step 3: Prepare each chosen photograph**

For every place with a picked photo, from the original file:

```bash
cd /Users/Dominik.Holek/Documents/reis/reis-extension
mkdir -p public/garden
# the bundled thumb — square crop, 96px, what the bubble shows
magick <original> -resize 96x96^ -gravity center -extent 96x96 -quality 72 public/garden/<id>.webp
# the card photo — 800x480, hashed so a replacement actually propagates past jsDelivr
magick <original> -resize 800x480^ -gravity center -extent 800x480 -quality 82 /tmp/<id>.webp
shasum -a 256 /tmp/<id>.webp | cut -c1-6   # → the hash for the filename
```

Rename to `<id>.<hash>.webp`, commit it to the `reis-data` repo under `garden/`, and record it in `gardenPlaces.json` as `photo`, with `credit` set for anything not shot by the maintainer. Anything from `arboretum.mendelu.cz` needs MENDELU's permission first; Wikimedia Commons files carry their own per-file terms and must be credited.

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: See it**

Use the `verify-ui` skill: screenshots at 320 / 390 / 430 with the overflow, collision and contrast assertions, on the garden drilled in. The two findings to expect are a bubble sitting on a path label, and the card's hours line against the photo. Never judge this from one screenshot.

Then `npm run dev:web` and drill into the garden by hand: hover a bubble on the desktop tree, tap one on a narrow window, zoom out past 17 and confirm the bubbles vanish rather than pile up.

- [ ] **Step 6: Commit**

```bash
git add public/garden src/data/map/gardenPlaces.json src/data/map/__tests__/gardenPlaces.test.ts
git commit -m "$(cat <<'EOF'
feat(map): add the garden photographs

Thumbs bundled at 96px; the card photos live in reis-data behind jsDelivr
with a content hash in the filename, because @main is cached mutably and a
replaced photo at the same path would never reach anyone.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Notes for the executor

- **Never relax a failing geometry test.** A place outside the garden or 60 m from any path is a misread coordinate, not a bad tolerance.
- **The twelve are editorial.** If a `why` line reads like a plant label ("a collection of willows"), it is wrong — it has to say why you would sit there.
- The `photo` field being absent is a normal state, not an unfinished one.
