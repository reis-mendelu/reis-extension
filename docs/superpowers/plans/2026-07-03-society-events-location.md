# Society Map Events: Location Model & Creation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let student-society organizers create/edit/delete campus-map events in reis-admin, located either in a specific campus room or anywhere in the city via a dropped pin or a searched address, and have those real events replace the reis-extension campus map's hardcoded mock data.

**Architecture:** One new Supabase table (`spolky_events`) with a mode-discriminated location (`venue_kind` + `room_code` + `coord_lng/coord_lat` + `location`), RLS copied verbatim from the working `notifications` pattern. A new `src/features/events/` module in reis-admin provides create/edit/delete, embedding a small raw-Leaflet picker (building click for room mode, pin-drop + Nominatim address search for city mode) built from the same static `buildings.json`/`rooms-index.json` reis-extension already ships, duplicated into reis-admin (no shared package — see Global Constraints). reis-extension's `src/api/mapEvents.ts` swaps its mock seam for a real `select` against the new table; no changes are needed to `EventPin`/`EventDetailCard`/`EventLayer`/`EventsList` since the `MapEvent` shape is unchanged.

**Tech Stack:** React 19 + TypeScript (both repos), Vite (reis-admin) / WXT (reis-extension), Supabase (`zvbpgkmnrqyprtkyxkwn`, project "reis-notifications"), Leaflet 1.9.4 (raw API, no react-leaflet), DaisyUI 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-03-society-events-location-design.md`

## Global Constraints

- Repos: `reis-extension` (this worktree, branch `worktree-society-map-events`) and `../reis-admin` (branch `society-map-events`, based on `origin/main`). Every reis-admin task below runs with `cwd` = `/Users/dominik-personal/Documents/reis-admin`.
- No image upload capability (out of scope, per spec).
- No moderation/approval queue (out of scope, per spec) — RLS trusts any active `spolky_accounts` row.
- No in-extension creation UI (out of scope, per spec) — reis-admin only.
- Mock data (`SEEDS`, `VENUE`, `VENUE_LABELS`, `URLS` in `src/api/mapEvents.ts`) is deleted entirely, not kept as a fallback.
- Map styling in reis-admin's new picker must use fixed hex literals (the basemap is always light regardless of app theme) — never DaisyUI theme tokens for map layers, matching `src/components/CampusMap/mapHelpers.ts`'s existing convention in reis-extension.
- reis-admin has zero test infrastructure today. This plan adds Vitest as a minimal dev dependency purely to TDD the two new pure logic functions (coordinate resolution, geocode-response parsing) — no component/DOM testing (no jsdom, no Testing Library) is introduced, matching the spec's explicit call that no E2E/component coverage is needed for the new admin UI.
- No shared package is created between the two repos. `buildings.json`/`rooms-index.json` and the small map-style constants are duplicated into reis-admin; the `EventCategory` union is duplicated as a plain string-literal type. Comments at each duplication point note the reis-extension source of truth.
- The admin form's location toggle only offers "campus" and "offcampus" — `venue_kind: 'online'` remains a valid value in the type/schema but has no UI entry point in this feature (not a regression; nothing offers it today either).
- Room codes are stored using each room's friendly `name` field (e.g. `"Q01"`), not its opaque internal `code` (e.g. `"BA39N1009"`) — `focusRoomByCode` in reis-extension already matches on either, and `name` is what the existing mock data used.

---

## File Structure

**reis-admin** (new branch `society-map-events`):
- New: `supabase/migrations/20260703120000_add_spolky_events.sql`
- Modify: `src/lib/database.types.ts` — add `spolky_events` table type
- Modify: `package.json` — add `leaflet`, `@types/leaflet`, `vitest`, `"test"` script
- New: `src/data/map/buildings.json`, `src/data/map/rooms-index.json` — copied static data
- New: `src/features/events/mapStyles.ts` — duplicated style constants + `ringToLatLng`
- New: `src/features/events/locationResolvers.ts` — pure functions (tested)
- New: `src/features/events/locationResolvers.test.ts`
- New: `src/features/events/nominatim.ts` — address search (tested)
- New: `src/features/events/nominatim.test.ts`
- New: `src/features/events/CampusPickerMap.tsx` — raw-Leaflet picker (manual verification)
- New: `src/features/events/eventCategories.ts` — duplicated `EventCategory` union + Czech labels
- New: `src/features/events/EventForm.tsx`
- New: `src/features/events/EventList.tsx`
- New: `src/features/events/index.tsx` — `EventsView`, mirrors `notifications/index.tsx`
- Modify: `src/App.tsx` — add `/events` route
- Modify: `src/components/Sidebar.tsx` — add nav item
- Modify: `src/components/AppLayout.tsx` — add page title

**reis-extension** (worktree `society-map-events`):
- Modify: `src/data/societies.ts` — add `af`, `ldf`, `zf`
- Modify: `src/api/mapEvents.ts` — real fetch, mock deleted
- Modify: `src/api/__tests__/mapEvents.test.ts` — test the real row-mapping function
- Modify: `src/store/slices/createMapSlice.ts` — drop now-unused `language` arg at the one call site
- Modify: `src/data/eventCategories.ts` — delete `inferCategory` + `RULES` (mock-only, no other callers)

---

### Task 1: Supabase migration — `spolky_events` table + RLS

**Files:**
- Create: `/Users/dominik-personal/Documents/reis-admin/supabase/migrations/20260703120000_add_spolky_events.sql`

**Interfaces:**
- Produces: table `public.spolky_events` with columns `id, association_id, title, category, date, end_date, time, venue_kind, room_code, coord_lng, coord_lat, location, url, created_at, updated_at` — every later task's SQL/TS type must match these names exactly.

- [ ] **Step 1: Write the migration file**

```sql
-- Society-authored campus-map events. Location is mode-discriminated:
-- venue_kind='campus' carries room_code (+ coord resolved from the building's
-- centre); venue_kind='offcampus' carries coord from a dropped pin or a
-- geocoded address, with `location` as the free-text label. RLS mirrors the
-- existing notifications table's association-scoped pattern exactly.

CREATE TABLE public.spolky_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  association_id text NOT NULL,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'party', 'boardgames', 'trip', 'quiz', 'sports',
    'film', 'karaoke', 'culture', 'social', 'other'
  )),
  date date NOT NULL,
  end_date date,
  time text,
  venue_kind text NOT NULL CHECK (venue_kind IN ('campus', 'online', 'offcampus')),
  room_code text,
  coord_lng double precision,
  coord_lat double precision,
  location text,
  url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spolky_events ENABLE ROW LEVEL SECURITY;

-- anon (extension): read every event, no auth on the student side
CREATE POLICY "anon_read_spolky_events"
  ON public.spolky_events FOR SELECT TO anon
  USING (true);

-- authenticated (admin dashboard): read every event (needed for the
-- reis_admin "ghost" view and the social-proof read pattern already used by
-- notifications); write only to their own association's rows.
CREATE POLICY "auth_read_spolky_events"
  ON public.spolky_events FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "auth_insert_spolky_events"
  ON public.spolky_events FOR INSERT TO authenticated
  WITH CHECK (
    association_id = (
      SELECT association_id FROM public.spolky_accounts
      WHERE email = (auth.jwt() ->> 'email') AND is_active = true LIMIT 1
    )
    OR get_my_role() = 'reis_admin'
  );

CREATE POLICY "auth_update_spolky_events"
  ON public.spolky_events FOR UPDATE TO authenticated
  USING (
    association_id = (
      SELECT association_id FROM public.spolky_accounts
      WHERE email = (auth.jwt() ->> 'email') AND is_active = true LIMIT 1
    )
    OR get_my_role() = 'reis_admin'
  )
  WITH CHECK (
    association_id = (
      SELECT association_id FROM public.spolky_accounts
      WHERE email = (auth.jwt() ->> 'email') AND is_active = true LIMIT 1
    )
    OR get_my_role() = 'reis_admin'
  );

CREATE POLICY "auth_delete_spolky_events"
  ON public.spolky_events FOR DELETE TO authenticated
  USING (
    association_id = (
      SELECT association_id FROM public.spolky_accounts
      WHERE email = (auth.jwt() ->> 'email') AND is_active = true LIMIT 1
    )
    OR get_my_role() = 'reis_admin'
  );
```

- [ ] **Step 2: Apply the migration to the remote project**

Use the Supabase MCP tool `mcp__claude_ai_Supabase__execute_sql` with `project_id: "zvbpgkmnrqyprtkyxkwn"` and the exact SQL from Step 1 as `query`. This matches how prior migrations in this repo were applied (hand-authored file + direct execution against the remote project, no local Supabase stack).

- [ ] **Step 3: Verify**

Call `mcp__claude_ai_Supabase__list_tables` with `project_id: "zvbpgkmnrqyprtkyxkwn"`, `schemas: ["public"]`, `verbose: true`. Confirm `spolky_events` appears with `rls_enabled: true` and 0 rows, and its columns match Step 1 exactly.

- [ ] **Step 4: Commit**

```bash
cd /Users/dominik-personal/Documents/reis-admin
git add supabase/migrations/20260703120000_add_spolky_events.sql
git commit -m "feat(events): add spolky_events table with association-scoped RLS"
```

---

### Task 2: reis-admin database types

**Files:**
- Modify: `/Users/dominik-personal/Documents/reis-admin/src/lib/database.types.ts`

**Interfaces:**
- Consumes: the exact column set from Task 1.
- Produces: `Tables<'spolky_events'>` usable via `import { Tables } from '@/lib/database.types'`, matching the style already used for `Tables<'notifications'>`.

- [ ] **Step 1: Add the table block**

Insert alphabetically (after `spolky_accounts`, matching the file's existing ordering) inside the `Tables` object:

```ts
      spolky_events: {
        Row: {
          association_id: string
          category: string
          coord_lat: number | null
          coord_lng: number | null
          created_at: string
          date: string
          end_date: string | null
          id: string
          location: string | null
          room_code: string | null
          time: string | null
          title: string
          updated_at: string
          url: string | null
          venue_kind: string
        }
        Insert: {
          association_id: string
          category: string
          coord_lat?: number | null
          coord_lng?: number | null
          created_at?: string
          date: string
          end_date?: string | null
          id?: string
          location?: string | null
          room_code?: string | null
          time?: string | null
          title: string
          updated_at?: string
          url?: string | null
          venue_kind: string
        }
        Update: {
          association_id?: string
          category?: string
          coord_lat?: number | null
          coord_lng?: number | null
          created_at?: string
          date?: string
          end_date?: string | null
          id?: string
          location?: string | null
          room_code?: string | null
          time?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          venue_kind?: string
        }
        Relationships: []
      }
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/dominik-personal/Documents/reis-admin
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat(events): add spolky_events to database.types.ts"
```

---

### Task 3: Add Leaflet + Vitest tooling to reis-admin

**Files:**
- Modify: `/Users/dominik-personal/Documents/reis-admin/package.json`

**Interfaces:**
- Produces: `leaflet`/`@types/leaflet` importable by Task 6/8; `vitest` runnable by Tasks 4 and 5.

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/dominik-personal/Documents/reis-admin
npm install --save-exact leaflet@1.9.4
npm install --save-dev --save-exact @types/leaflet@1.9.21 vitest@3.2.4
```

- [ ] **Step 2: Add the test script**

In `package.json` `scripts`, add:

```json
    "test": "vitest run"
```

- [ ] **Step 3: Verify**

```bash
npx vitest run
```

Expected: "No test files found" (no test files exist yet) — exits without error, confirming the runner is wired up.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add leaflet + vitest for the events feature"
```

---

### Task 4: Copy static map data + style constants into reis-admin

**Files:**
- Create: `/Users/dominik-personal/Documents/reis-admin/src/data/map/buildings.json` (copy of reis-extension's file, byte-identical)
- Create: `/Users/dominik-personal/Documents/reis-admin/src/data/map/rooms-index.json` (copy of reis-extension's file, byte-identical)
- Create: `/Users/dominik-personal/Documents/reis-admin/src/features/events/mapStyles.ts`

**Interfaces:**
- Produces: `BUILDING_STYLE`, `SELECTED_STYLE`, `ringToLatLng(ring: number[][]): [number, number][]` — consumed by Task 6 (`CampusPickerMap.tsx`).

- [ ] **Step 1: Copy the static data files**

```bash
cp /Users/dominik-personal/Documents/reis-extension/src/data/map/buildings.json \
   /Users/dominik-personal/Documents/reis-admin/src/data/map/buildings.json
cp /Users/dominik-personal/Documents/reis-extension/src/data/map/rooms-index.json \
   /Users/dominik-personal/Documents/reis-admin/src/data/map/rooms-index.json
```

- [ ] **Step 2: Write `mapStyles.ts`**

```ts
// Duplicated from reis-extension's src/components/CampusMap/mapHelpers.ts —
// this repo has no shared package with the extension, so keep these two files
// in sync by hand if the source ever changes. Fixed hex literals: the campus
// basemap is always light regardless of this app's theme.
import type { PathOptions } from 'leaflet';

export const BUILDING_STYLE: PathOptions = {
  color: '#2563eb', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.25, bubblingMouseEvents: false,
};

export const SELECTED_STYLE: PathOptions = {
  color: '#ea580c', weight: 3, fillColor: '#fb923c', fillOpacity: 0.85, bubblingMouseEvents: false,
};

// A distinct pin color for the off-campus/city mode — never orange, so it's
// never mistaken for a selected building.
export const PIN_COLOR = '#16a34a';

export function ringToLatLng(ring: number[][]): [number, number][] {
  return ring.map((c) => [c[1], c[0]] as [number, number]);
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/dominik-personal/Documents/reis-admin
git add src/data/map/buildings.json src/data/map/rooms-index.json src/features/events/mapStyles.ts
git commit -m "feat(events): add campus map data + style constants"
```

---

### Task 5: Pure location-resolution logic (TDD)

**Files:**
- Create: `/Users/dominik-personal/Documents/reis-admin/src/features/events/locationResolvers.ts`
- Test: `/Users/dominik-personal/Documents/reis-admin/src/features/events/locationResolvers.test.ts`

**Interfaces:**
- Consumes: `Building` shape `{ id: number; name: string; center: [number, number] }` (subset of `buildings.json`'s per-building objects), `RoomIndexEntry` shape `{ code: string; name: string; buildingId: number }` (subset of `rooms-index.json`'s entries).
- Produces: `resolveBuildingCoord(buildingId, buildings): [number, number] | null`, `roomsForBuilding(buildingId, rooms): RoomIndexEntry[]` — consumed by Task 7 (`EventForm.tsx`).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { resolveBuildingCoord, roomsForBuilding } from './locationResolvers';

const BUILDINGS = [
  { id: 0, name: 'Q', center: [16.614, 49.2096] as [number, number] },
  { id: 5, name: 'A', center: [16.601, 49.211] as [number, number] },
];

const ROOMS = [
  { code: 'BA39N1009', name: 'Q01', buildingId: 0 },
  { code: 'BA39N6006', name: 'Q6.06', buildingId: 0 },
  { code: 'XY1', name: 'A101', buildingId: 5 },
];

describe('resolveBuildingCoord', () => {
  it('returns the matching building\'s centre', () => {
    expect(resolveBuildingCoord(0, BUILDINGS)).toEqual([16.614, 49.2096]);
  });

  it('returns null for an unknown building id', () => {
    expect(resolveBuildingCoord(999, BUILDINGS)).toBeNull();
  });
});

describe('roomsForBuilding', () => {
  it('filters rooms to the given building, sorted by name', () => {
    const result = roomsForBuilding(0, ROOMS);
    expect(result.map((r) => r.name)).toEqual(['Q01', 'Q6.06']);
  });

  it('returns an empty array for a building with no rooms', () => {
    expect(roomsForBuilding(999, ROOMS)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/dominik-personal/Documents/reis-admin
npx vitest run src/features/events/locationResolvers.test.ts
```

Expected: FAIL — `locationResolvers.ts` doesn't exist yet.

- [ ] **Step 3: Implement**

```ts
export interface BuildingLite {
  id: number;
  name: string;
  center: [number, number];
}

export interface RoomIndexEntry {
  code: string;
  name: string;
  buildingId: number;
}

export function resolveBuildingCoord(
  buildingId: number,
  buildings: BuildingLite[],
): [number, number] | null {
  const b = buildings.find((x) => x.id === buildingId);
  return b ? b.center : null;
}

export function roomsForBuilding(
  buildingId: number,
  rooms: RoomIndexEntry[],
): RoomIndexEntry[] {
  return rooms
    .filter((r) => r.buildingId === buildingId)
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run src/features/events/locationResolvers.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/events/locationResolvers.ts src/features/events/locationResolvers.test.ts
git commit -m "feat(events): add pure building/room location resolvers"
```

---

### Task 6: Nominatim address search (TDD)

**Files:**
- Create: `/Users/dominik-personal/Documents/reis-admin/src/features/events/nominatim.ts`
- Test: `/Users/dominik-personal/Documents/reis-admin/src/features/events/nominatim.test.ts`

**Interfaces:**
- Produces: `GeocodeResult { label: string; coord: [number, number] }`, `parseNominatimResults(raw: unknown[]): GeocodeResult[]` (pure, tested), `searchAddress(query: string): Promise<GeocodeResult[]>` (network wrapper, not unit-tested) — consumed by Task 7 (`EventForm.tsx`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseNominatimResults } from './nominatim';

describe('parseNominatimResults', () => {
  it('maps Nominatim rows into label + [lng, lat] coord', () => {
    const raw = [
      { display_name: 'Česká, Brno-střed, Brno, Czechia', lon: '16.606389', lat: '49.198056' },
    ];
    expect(parseNominatimResults(raw)).toEqual([
      { label: 'Česká, Brno-střed, Brno, Czechia', coord: [16.606389, 49.198056] },
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(parseNominatimResults([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/dominik-personal/Documents/reis-admin
npx vitest run src/features/events/nominatim.test.ts
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

```ts
// Free, keyless geocoding for the off-campus address-search input. Bounded to
// a Brno viewbox (left,top,right,bottom = lon_min,lat_max,lon_max,lat_min) so
// short/ambiguous queries resolve locally. Nominatim's usage policy caps
// unauthenticated use at ~1 req/sec — callers must debounce.
const BRNO_VIEWBOX = '16.40,49.28,16.75,49.10';

export interface GeocodeResult {
  label: string;
  coord: [number, number]; // [lng, lat]
}

interface NominatimRow {
  display_name: string;
  lon: string;
  lat: string;
}

export function parseNominatimResults(raw: unknown[]): GeocodeResult[] {
  return (raw as NominatimRow[]).map((row) => ({
    label: row.display_name,
    coord: [parseFloat(row.lon), parseFloat(row.lat)],
  }));
}

export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    viewbox: BRNO_VIEWBOX,
    bounded: '1',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'Accept-Language': 'cs' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return parseNominatimResults(data);
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run src/features/events/nominatim.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/events/nominatim.ts src/features/events/nominatim.test.ts
git commit -m "feat(events): add Brno-bounded Nominatim address search"
```

---

### Task 7: `CampusPickerMap.tsx` — raw-Leaflet picker

**Files:**
- Create: `/Users/dominik-personal/Documents/reis-admin/src/features/events/CampusPickerMap.tsx`

**Interfaces:**
- Consumes: `BUILDING_STYLE`, `SELECTED_STYLE`, `PIN_COLOR`, `ringToLatLng` (Task 4); `buildings.json` (Task 4).
- Produces: `<CampusPickerMap mode selectedBuildingId onBuildingClick pin onPinChange />` — consumed by Task 9 (`EventForm.tsx`).
- No automated test: this is an interactive Leaflet-DOM component and reis-admin intentionally has no jsdom/component-testing setup (see Global Constraints). Verified manually in Task 9's manual-verification step once it's wired into the form.

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import buildingsJson from '../../data/map/buildings.json';
import { BUILDING_STYLE, SELECTED_STYLE, PIN_COLOR, ringToLatLng } from './mapStyles';

interface BuildingsMeta {
  buildings: Array<{
    id: number;
    outline: { coordinates: number[][][] };
    center: [number, number];
    bounds: [[number, number], [number, number]];
  }>;
  campus: { bounds: [[number, number], [number, number]] };
}

const META = buildingsJson as BuildingsMeta;

interface CampusPickerMapProps {
  mode: 'campus' | 'offcampus';
  selectedBuildingId: number | null;
  onBuildingClick: (buildingId: number) => void;
  pin: [number, number] | null; // [lng, lat]
  onPinChange: (coord: [number, number]) => void;
}

export default function CampusPickerMap({
  mode, selectedBuildingId, onBuildingClick, pin, onPinChange,
}: CampusPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const buildingLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const markerRef = useRef<L.Marker | null>(null);

  // init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { attributionControl: true });
    const [[s, w], [n, e]] = META.campus.bounds;
    map.fitBounds([[s, w], [n, e]]);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 20,
    }).addTo(map);
    buildingLayerRef.current.addTo(map);
    mapRef.current = map;
  }, []);

  // draw / restyle buildings whenever mode or selection changes
  useEffect(() => {
    buildingLayerRef.current.clearLayers();
    for (const b of META.buildings) {
      const style = b.id === selectedBuildingId ? SELECTED_STYLE : BUILDING_STYLE;
      const poly = L.polygon(ringToLatLng(b.outline.coordinates[0]), style);
      if (mode === 'campus') {
        poly.on('click', () => onBuildingClick(b.id));
      }
      poly.addTo(buildingLayerRef.current);
    }
  }, [mode, selectedBuildingId, onBuildingClick]);

  // off-campus mode: click-to-drop-pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'offcampus') return;
    const handler = (e: L.LeafletMouseEvent) => onPinChange([e.latlng.lng, e.latlng.lat]);
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [mode, onPinChange]);

  // render/move the draggable pin marker — a plain colored-circle div icon
  // (not the default Leaflet pin) so it's visually distinct from a building
  // selection, and draggable so the organizer can fine-tune placement after
  // an initial click or address-search hit.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!pin || mode !== 'offcampus') {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const latlng: [number, number] = [pin[1], pin[0]];
    if (!markerRef.current) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:18px;height:18px;border-radius:9999px;background:${PIN_COLOR};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marker = L.marker(latlng, { icon, draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        onPinChange([p.lng, p.lat]);
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(latlng);
    }
  }, [pin, mode, onPinChange]);

  return <div ref={containerRef} className="w-full h-80 rounded-lg overflow-hidden border border-base-300" />;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/dominik-personal/Documents/reis-admin
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/events/CampusPickerMap.tsx
git commit -m "feat(events): add raw-Leaflet campus/city location picker"
```

---

### Task 8: Duplicated `EventCategory` union + Czech labels

**Files:**
- Create: `/Users/dominik-personal/Documents/reis-admin/src/features/events/eventCategories.ts`

**Interfaces:**
- Produces: `EventCategory` type, `CATEGORY_LABELS: Record<EventCategory, string>` — consumed by Task 9 (`EventForm.tsx`).

- [ ] **Step 1: Write the file**

```ts
// Duplicated from reis-extension's src/types/events.ts `EventCategory` union —
// keep in sync by hand if that union ever changes (no shared package between
// the two repos; see plan Global Constraints).
export type EventCategory =
  | 'party' | 'boardgames' | 'trip' | 'quiz' | 'sports'
  | 'film' | 'karaoke' | 'culture' | 'social' | 'other';

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  party: 'Párty',
  boardgames: 'Deskové hry',
  trip: 'Výlet',
  quiz: 'Kvíz',
  sports: 'Sport',
  film: 'Film',
  karaoke: 'Karaoke',
  culture: 'Kultura',
  social: 'Společenská akce',
  other: 'Ostatní',
};
```

- [ ] **Step 2: Commit**

```bash
cd /Users/dominik-personal/Documents/reis-admin
git add src/features/events/eventCategories.ts
git commit -m "feat(events): add duplicated EventCategory union + Czech labels"
```

---

### Task 9: `EventForm.tsx`

**Files:**
- Create: `/Users/dominik-personal/Documents/reis-admin/src/features/events/EventForm.tsx`

**Interfaces:**
- Consumes: `supabase` (`@/lib/supabase`), `Tables` (`@/lib/database.types`, Task 2), `DatePicker` (`@/components/DatePicker`), `toLocalDateString` (`@/lib/utils`), `resolveBuildingCoord`/`roomsForBuilding` (Task 5), `searchAddress`/`GeocodeResult` (Task 6), `CampusPickerMap` (Task 7), `EventCategory`/`CATEGORY_LABELS` (Task 8), `buildingsJson`/`roomsIndexJson` (Task 4).
- Produces: `<EventForm associationId={string} onRefresh={() => void} editingEvent={Tables<'spolky_events'> | null} onCancelEdit={() => void} />` — consumed by Task 11 (`index.tsx`). When `editingEvent` is non-null the form opens pre-filled and submits an `update` instead of an `insert`; both Create and Edit use one form so every field (including location) stays editable after publish, per spec.
- Manual verification only (no automated test — see Task 7's rationale, same applies to this form).

- [ ] **Step 1: Write the component**

```tsx
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, X, Send } from 'lucide-react';
import { toLocalDateString } from '@/lib/utils';
import DatePicker from '@/components/DatePicker';
import { Tables } from '@/lib/database.types';
import buildingsJson from '../../data/map/buildings.json';
import roomsIndexJson from '../../data/map/rooms-index.json';
import { resolveBuildingCoord, roomsForBuilding, type BuildingLite, type RoomIndexEntry } from './locationResolvers';
import { searchAddress, type GeocodeResult } from './nominatim';
import CampusPickerMap from './CampusPickerMap';
import { CATEGORY_LABELS, type EventCategory } from './eventCategories';

const BUILDINGS = (buildingsJson as { buildings: BuildingLite[] }).buildings;
const ROOMS = roomsIndexJson as RoomIndexEntry[];

interface EventFormProps {
  associationId: string | null;
  onRefresh: () => void;
  editingEvent?: Tables<'spolky_events'> | null;
  onCancelEdit?: () => void;
}

type LocationMode = 'campus' | 'offcampus';

const EMPTY_STATE = {
  title: '', category: 'other' as EventCategory, date: '', endDate: '', time: '', url: '',
  mode: 'campus' as LocationMode, buildingId: null as number | null, roomCode: '',
  pin: null as [number, number] | null, addressLabel: '',
};

export default function EventForm({ associationId, onRefresh, editingEvent, onCancelEdit }: EventFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState(EMPTY_STATE.title);
  const [category, setCategory] = useState<EventCategory>(EMPTY_STATE.category);
  const [date, setDate] = useState(EMPTY_STATE.date);
  const [endDate, setEndDate] = useState(EMPTY_STATE.endDate);
  const [time, setTime] = useState(EMPTY_STATE.time);
  const [url, setUrl] = useState(EMPTY_STATE.url);
  const [mode, setMode] = useState<LocationMode>(EMPTY_STATE.mode);
  const [buildingId, setBuildingId] = useState<number | null>(EMPTY_STATE.buildingId);
  const [roomCode, setRoomCode] = useState<string>(EMPTY_STATE.roomCode);
  const [pin, setPin] = useState<[number, number] | null>(EMPTY_STATE.pin);
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<GeocodeResult[]>([]);
  const [addressLabel, setAddressLabel] = useState(EMPTY_STATE.addressLabel);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill and auto-expand when an event is handed in for editing. A room's
  // buildingId isn't stored on the row itself, so it's re-derived from the
  // stored room_code via the same ROOMS index the picker uses.
  useEffect(() => {
    if (!editingEvent) return;
    setTitle(editingEvent.title);
    setCategory(editingEvent.category as EventCategory);
    setDate(editingEvent.date);
    setEndDate(editingEvent.end_date ?? '');
    setTime(editingEvent.time ?? '');
    setUrl(editingEvent.url ?? '');
    setMode(editingEvent.venue_kind as LocationMode);
    setRoomCode(editingEvent.room_code ?? '');
    setBuildingId(
      editingEvent.room_code
        ? (ROOMS.find((r) => r.name === editingEvent.room_code)?.buildingId ?? null)
        : null,
    );
    setPin(
      editingEvent.coord_lng != null && editingEvent.coord_lat != null
        ? [editingEvent.coord_lng, editingEvent.coord_lat]
        : null,
    );
    setAddressLabel(editingEvent.location ?? '');
    setIsExpanded(true);
  }, [editingEvent]);

  const roomOptions = useMemo(
    () => (buildingId != null ? roomsForBuilding(buildingId, ROOMS) : []),
    [buildingId],
  );

  const handleAddressSearch = async () => {
    setAddressResults(await searchAddress(addressQuery));
  };

  const pickAddressResult = (r: GeocodeResult) => {
    setPin(r.coord);
    setAddressLabel(r.label);
    setAddressResults([]);
  };

  const resetForm = () => {
    setTitle(EMPTY_STATE.title); setCategory(EMPTY_STATE.category); setDate(EMPTY_STATE.date);
    setEndDate(EMPTY_STATE.endDate); setTime(EMPTY_STATE.time); setUrl(EMPTY_STATE.url);
    setMode(EMPTY_STATE.mode); setBuildingId(EMPTY_STATE.buildingId); setRoomCode(EMPTY_STATE.roomCode);
    setPin(EMPTY_STATE.pin); setAddressQuery(''); setAddressResults([]); setAddressLabel(EMPTY_STATE.addressLabel);
    setIsExpanded(false);
    onCancelEdit?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!associationId || !title || !date) return;

    const coord = mode === 'campus'
      ? (buildingId != null ? resolveBuildingCoord(buildingId, BUILDINGS) : null)
      : pin;
    const location = mode === 'campus' ? (roomCode || null) : (addressLabel || null);

    const payload = {
      association_id: associationId,
      title,
      category,
      date,
      end_date: endDate || null,
      time: time || null,
      venue_kind: mode,
      room_code: mode === 'campus' ? (roomCode || null) : null,
      coord_lng: coord ? coord[0] : null,
      coord_lat: coord ? coord[1] : null,
      location,
      url: url || null,
    };

    setSubmitting(true);
    try {
      const { error } = editingEvent
        ? await supabase.from('spolky_events').update(payload).eq('id', editingEvent.id)
        : await supabase.from('spolky_events').insert([payload]);
      if (error) throw error;

      toast.success(editingEvent ? 'Uloženo' : 'Událost vytvořena');
      resetForm();
      onRefresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Chyba při ukládání');
    } finally {
      setSubmitting(false);
    }
  };

  const todayStr = toLocalDateString(new Date());

  if (!isExpanded) {
    return (
      <button onClick={() => setIsExpanded(true)} className="btn btn-primary w-full gap-2 shadow-sm">
        <Plus size={20} /> Vytvořit novou událost
      </button>
    );
  }

  return (
    <div className="card bg-base-100 shadow-md border border-base-content/10">
      <div className="card-body p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="card-title text-xl">{editingEvent ? 'Upravit událost' : 'Nová událost'}</h2>
          <button onClick={resetForm} className="btn btn-ghost btn-sm btn-square"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Název události" className="input input-bordered w-full" required maxLength={80}
          />

          <select
            value={category} onChange={(e) => setCategory(e.target.value as EventCategory)}
            className="select select-bordered w-full"
          >
            {(Object.entries(CATEGORY_LABELS) as [EventCategory, string][]).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <DatePicker value={date} onChange={setDate} min={todayStr} />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input input-bordered w-full" />
          </div>
          <DatePicker value={endDate} onChange={setEndDate} min={date || todayStr} />

          <input
            type="url" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="Odkaz (nepovinné)" className="input input-bordered w-full" maxLength={200}
          />

          <div className="join">
            <button
              type="button"
              className={`btn btn-sm join-item ${mode === 'campus' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('campus')}
            >
              Na kampusu
            </button>
            <button
              type="button"
              className={`btn btn-sm join-item ${mode === 'offcampus' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('offcampus')}
            >
              Ve městě
            </button>
          </div>

          <CampusPickerMap
            mode={mode}
            selectedBuildingId={buildingId}
            onBuildingClick={(id) => { setBuildingId(id); setRoomCode(''); }}
            pin={pin}
            onPinChange={setPin}
          />

          {mode === 'campus' ? (
            <select
              value={roomCode} onChange={(e) => setRoomCode(e.target.value)}
              className="select select-bordered w-full" disabled={buildingId == null}
            >
              <option value="">{buildingId == null ? 'Nejprve klikněte na budovu' : 'Vyberte místnost'}</option>
              {roomOptions.map((r) => (
                <option key={r.code} value={r.name}>{r.name}</option>
              ))}
            </select>
          ) : (
            <div className="space-y-2">
              <div className="join w-full">
                <input
                  type="text" value={addressQuery} onChange={(e) => setAddressQuery(e.target.value)}
                  placeholder="Hledat adresu…" className="input input-bordered join-item w-full"
                />
                <button type="button" className="btn join-item" onClick={handleAddressSearch}>Hledat</button>
              </div>
              {addressResults.length > 0 && (
                <ul className="menu bg-base-200 rounded-box">
                  {addressResults.map((r) => (
                    <li key={r.label}><a onClick={() => pickAddressResult(r)}>{r.label}</a></li>
                  ))}
                </ul>
              )}
              {addressLabel && <p className="text-sm text-base-content/70">{addressLabel}</p>}
            </div>
          )}

          <div className="card-actions justify-end pt-2 border-t border-base-200">
            <button type="button" onClick={resetForm} className="btn btn-ghost" disabled={submitting}>Zrušit</button>
            <button type="submit" className="btn btn-primary gap-2 px-8" disabled={submitting || !title || !date}>
              {submitting ? <span className="loading loading-spinner"></span> : (<><Send size={18} /> {editingEvent ? 'Uložit' : 'Vytvořit'}</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/dominik-personal/Documents/reis-admin
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

Log in as a society account, open the new events view (built in Task 11), click "Vytvořit novou událost", confirm: (a) campus mode — clicking a building highlights it orange and populates the room dropdown; submitting inserts a row with `venue_kind='campus'`, a non-null `room_code`, and `coord_lng`/`coord_lat` equal to the building's `center`; (b) offcampus mode — clicking the map or picking an address result drops a green marker; submitting inserts a row with `venue_kind='offcampus'`, `room_code=null`, and `coord_lng`/`coord_lat` from the pin. Then, from the list (Task 10/11), click "Upravit" on an existing event of each kind and confirm the form re-opens pre-filled with the correct mode/building/room or pin/address, and saving updates the same row (`id` unchanged) rather than creating a new one.

- [ ] **Step 4: Commit**

```bash
git add src/features/events/EventForm.tsx
git commit -m "feat(events): add event creation form with dual location modes"
```

---

### Task 10: `EventList.tsx`

**Files:**
- Create: `/Users/dominik-personal/Documents/reis-admin/src/features/events/EventList.tsx`

**Interfaces:**
- Consumes: `Tables<'spolky_events'>` (Task 2).
- Produces: `<EventList events onRefresh onEdit={(event: Tables<'spolky_events'>) => void} />` — consumed by Task 11 (`index.tsx`). "Upravit" hands the full row up to the parent, which passes it to `EventForm` as `editingEvent` (Task 9) — this list does not edit anything itself.
- Manual verification only (same rationale as Tasks 7/9).

- [ ] **Step 1: Write the component**

```tsx
import { Trash2, Pencil, CalendarOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Tables } from '@/lib/database.types';

interface EventListProps {
  events: Tables<'spolky_events'>[];
  onRefresh: () => void;
  onEdit: (event: Tables<'spolky_events'>) => void;
}

export default function EventList({ events, onRefresh, onEdit }: EventListProps) {
  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat tuto událost?')) return;
    try {
      const { error } = await supabase.from('spolky_events').delete().eq('id', id);
      if (error) throw error;
      toast.success('Událost smazána');
      onRefresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Chyba mazání');
    }
  };

  if (!events.length) {
    return (
      <div className="text-center py-8 opacity-40">
        <CalendarOff className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">Žádné události</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr><th>Událost</th><th className="w-28">Datum</th><th>Místo</th><th className="w-24"></th><th className="w-10"></th></tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td className="font-medium">{e.title}</td>
              <td className="text-sm text-base-content/70">
                {new Date(e.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}
              </td>
              <td className="text-sm text-base-content/70">{e.room_code || e.location || '—'}</td>
              <td><button className="btn btn-ghost btn-xs gap-1" onClick={() => onEdit(e)}><Pencil size={12} /> Upravit</button></td>
              <td><button className="btn btn-ghost btn-xs btn-square text-error" onClick={() => handleDelete(e.id)}><Trash2 size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/dominik-personal/Documents/reis-admin
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/events/EventList.tsx
git commit -m "feat(events): add event list with edit/delete"
```

---

### Task 11: `EventsView` (`index.tsx`) + route/nav wiring

**Files:**
- Create: `/Users/dominik-personal/Documents/reis-admin/src/features/events/index.tsx`
- Modify: `/Users/dominik-personal/Documents/reis-admin/src/App.tsx`
- Modify: `/Users/dominik-personal/Documents/reis-admin/src/components/Sidebar.tsx`
- Modify: `/Users/dominik-personal/Documents/reis-admin/src/components/AppLayout.tsx`

**Interfaces:**
- Consumes: `EventForm` (Task 9), `EventList` (Task 10).
- Produces: route `/events`, nav item "Události".

- [ ] **Step 1: Write `index.tsx`** (mirrors `src/features/notifications/index.tsx`)

```tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { CalendarDays } from 'lucide-react';
import EventForm from './EventForm';
import EventList from './EventList';
import { Tables } from '@/lib/database.types';

interface EventsViewProps {
  associationId: string | null;
  isReisAdmin: boolean;
  isGhosting: boolean;
}

export default function EventsView({ associationId, isReisAdmin, isGhosting }: EventsViewProps) {
  const [events, setEvents] = useState<Tables<'spolky_events'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Tables<'spolky_events'> | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!isReisAdmin && !associationId) return;
    setLoading(true);
    try {
      let query = supabase.from('spolky_events').select('*').order('date', { ascending: true });
      if (!isReisAdmin || isGhosting) query = query.eq('association_id', associationId!);
      const { data, error } = await query;
      if (error) throw error;
      setEvents(data || []);
    } catch (error: unknown) {
      console.error('Fetch error:', error);
      toast.error('Chyba načítání dat');
    } finally {
      setLoading(false);
    }
  }, [associationId, isReisAdmin, isGhosting]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  if (!isReisAdmin && !associationId) {
    return <div className="skeleton w-full h-32 rounded-box opacity-50"></div>;
  }

  return (
    <div className="space-y-6">
      <EventForm
        associationId={associationId}
        onRefresh={fetchEvents}
        editingEvent={editingEvent}
        onCancelEdit={() => setEditingEvent(null)}
      />

      <div className="space-y-4">
        <h3 className="font-bold text-xl px-1 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" /> Vaše události
        </h3>
        {loading ? (
          <div className="space-y-3">
            <div className="skeleton h-20 w-full rounded-box opacity-20"></div>
            <div className="skeleton h-20 w-full rounded-box opacity-20"></div>
          </div>
        ) : (
          <EventList events={events} onRefresh={fetchEvents} onEdit={setEditingEvent} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the route in `App.tsx`**

Add the import near the other feature imports:

```tsx
import EventsView from '@/features/events';
```

Add the route inside `<Routes>`, alongside the other authenticated routes:

```tsx
                    <Route path="/events" element={<EventsView associationId={effectiveAssociationId} isReisAdmin={isReisAdmin} isGhosting={ghostingAssociation !== null} />} />
```

- [ ] **Step 3: Add the nav item in `Sidebar.tsx`**

Add `CalendarDays` (or another distinct `lucide-react` icon not already used for the primary nav array) to the imports, and add an entry to the primary nav items array alongside the existing `{ id: 'notifications', ... }` entry:

```tsx
  { id: 'events', label: 'Události', icon: CalendarDays },
```

- [ ] **Step 4: Add the page title in `AppLayout.tsx`**

Add a line inside the `inferredView === ...` title block, alongside the existing ones:

```tsx
                            {inferredView === 'events' && 'Události'}
```

- [ ] **Step 5: Typecheck**

```bash
cd /Users/dominik-personal/Documents/reis-admin
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 6: Manual verification**

```bash
npm run dev
```

Log in, confirm "Události" appears in the sidebar, navigating to it shows the form + list, and creating/editing/deleting an event works end-to-end against the real `spolky_events` table (verify with `mcp__claude_ai_Supabase__execute_sql`: `select * from spolky_events;`).

- [ ] **Step 7: Commit**

```bash
git add src/features/events/index.tsx src/App.tsx src/components/Sidebar.tsx src/components/AppLayout.tsx
git commit -m "feat(events): wire EventsView into routing, nav, and layout"
```

---

### Task 12: reis-extension — expand the society catalog to 6

**Files:**
- Modify: `/Users/dominik-personal/Documents/reis-extension/.claude/worktrees/society-map-events/src/data/societies.ts`

**Interfaces:**
- Produces: `SOCIETIES['af']`, `SOCIETIES['ldf']`, `SOCIETIES['zf']` — consumed by Task 13 (`mapEvents.ts`'s `societyById` calls) and already-existing consumers (`EventsList.tsx`'s `ALL_SOCIETIES` filter chips, no code change needed there).

- [ ] **Step 1: Add the three entries**

Reuse each faculty's existing brand color from `ORGANIZERS` in `src/types/events.ts` (`af: '#c87800'`, `ldf: '#0a5028'`, `zf: '#8c0a00'`) and the logo files already shipped at `public/spolky/{af,ldf,zf}.jpg`:

```ts
export const SOCIETIES: Record<string, Society> = {
  esn: { id: 'esn', name: 'ESN MENDELU', shortName: 'ESN', color: '#00AEEF', glyph: '✷', logo: '/spolky/esn.jpg', facultyKey: 'mendelu' },
  supef: { id: 'supef', name: 'SU PEF', shortName: 'SUPEF', color: '#0046a0', glyph: 'SU', logo: '/spolky/supef.jpg', facultyKey: 'pef' },
  au_frrms: { id: 'au_frrms', name: 'AU FRRMS', shortName: 'AU FRRMS', color: '#c32897', glyph: 'AU', logo: '/spolky/au_frrms.jpg', facultyKey: 'frrms' },
  af: { id: 'af', name: 'AF Spolek', shortName: 'AF', color: '#c87800', glyph: 'AF', logo: '/spolky/af.jpg', facultyKey: 'af' },
  ldf: { id: 'ldf', name: 'LDF Spolek', shortName: 'LDF', color: '#0a5028', glyph: 'LDF', logo: '/spolky/ldf.jpg', facultyKey: 'ldf' },
  zf: { id: 'zf', name: 'ZF Spolek', shortName: 'ZF', color: '#8c0a00', glyph: 'ZF', logo: '/spolky/zf.jpg', facultyKey: 'zf' },
};
```

Names (`AF Spolek`, `LDF Spolek`, `ZF Spolek`) match `spolky_accounts.association_name` exactly, confirmed via the earlier `select association_id, association_name from spolky_accounts` query.

- [ ] **Step 2: Run the existing society/event tests**

```bash
cd /Users/dominik-personal/Documents/reis-extension/.claude/worktrees/society-map-events
npx vitest run src/components/CampusMap/__tests__/EventsList.test.ts
```

Expected: PASS (the filter-chip test already iterates `ALL_SOCIETIES` generically).

- [ ] **Step 3: Commit**

```bash
git add src/data/societies.ts
git commit -m "feat(events): expand society catalog to all 6 spolky_accounts associations"
```

---

### Task 13: reis-extension — real `fetchMapEvents`, delete the mock seam

**Files:**
- Modify: `/Users/dominik-personal/Documents/reis-extension/.claude/worktrees/society-map-events/src/api/mapEvents.ts`
- Modify: `/Users/dominik-personal/Documents/reis-extension/.claude/worktrees/society-map-events/src/api/__tests__/mapEvents.test.ts`
- Modify: `/Users/dominik-personal/Documents/reis-extension/.claude/worktrees/society-map-events/src/store/slices/createMapSlice.ts`

**Interfaces:**
- Consumes: `supabase` (`src/services/spolky/supabaseClient.ts`), `societyById` (Task 12's expanded catalog), `MapEvent`/`EventCategory` (`src/types/events.ts`, unchanged), `spolky_events` columns (Task 1).
- Produces: `fetchMapEvents(): Promise<MapEvent[]>` (signature changes — drops the now-unused `language` parameter) and the exported pure mapper `toMapEvent(row: SpolkyEventRow): MapEvent` (tested directly).

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/api/__tests__/mapEvents.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toMapEvent } from '../mapEvents';

describe('toMapEvent', () => {
  it('maps a campus-room row into a MapEvent with a resolved building coord', () => {
    const row = {
      id: 'abc', association_id: 'supef', title: 'PEF Kvíz', category: 'quiz',
      date: '2026-07-10', end_date: null, time: '18:00', venue_kind: 'campus',
      room_code: 'Q01', coord_lng: 16.614247, coord_lat: 49.209592,
      location: null, url: null,
    };
    expect(toMapEvent(row)).toEqual({
      id: 'abc', title: 'PEF Kvíz', url: '', date: '2026-07-10', endDate: null,
      time: '18:00', location: null, imageUrl: null, organizerKey: 'pef',
      societyId: 'supef', coord: [16.614247, 49.209592], roomCode: 'Q01',
      venueKind: 'campus', category: 'quiz',
    });
  });

  it('maps an off-campus row with a free-text location and no room code', () => {
    const row = {
      id: 'def', association_id: 'esn', title: 'Tram Party', category: 'party',
      date: '2026-07-17', end_date: null, time: '20:00', venue_kind: 'offcampus',
      room_code: null, coord_lng: 16.606389, coord_lat: 49.198056,
      location: 'Česká (sraz)', url: 'https://www.instagram.com/esnmendelubrno/',
    };
    expect(toMapEvent(row)).toEqual({
      id: 'def', title: 'Tram Party', url: 'https://www.instagram.com/esnmendelubrno/',
      date: '2026-07-17', endDate: null, time: '20:00', location: 'Česká (sraz)',
      imageUrl: null, organizerKey: 'mendelu', societyId: 'esn',
      coord: [16.606389, 49.198056], roomCode: null, venueKind: 'offcampus', category: 'party',
    });
  });

  it('maps a null coord when either coordinate is missing', () => {
    const row = {
      id: 'ghi', association_id: 'af', title: 'AF Den', category: 'culture',
      date: '2026-08-01', end_date: null, time: null, venue_kind: 'offcampus',
      room_code: null, coord_lng: null, coord_lat: null, location: 'TBD', url: null,
    };
    expect(toMapEvent(row).coord).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/dominik-personal/Documents/reis-extension/.claude/worktrees/society-map-events
npx vitest run src/api/__tests__/mapEvents.test.ts
```

Expected: FAIL — `toMapEvent` is not exported yet (the file still only exports `MOCK_MAP_EVENTS`/`fetchMapEvents`).

- [ ] **Step 3: Replace `mapEvents.ts` entirely**

```ts
import type { MapEvent, EventCategory } from '../types/events';
import { societyById } from '../data/societies';
import { supabase } from '../services/spolky/supabaseClient';
import { logError } from '../utils/reportError';

interface SpolkyEventRow {
  id: string;
  association_id: string;
  title: string;
  category: string;
  date: string;
  end_date: string | null;
  time: string | null;
  venue_kind: string;
  room_code: string | null;
  coord_lng: number | null;
  coord_lat: number | null;
  location: string | null;
  url: string | null;
}

// Pure row -> MapEvent mapping, kept separate from the network call so it's
// directly unit-testable without hitting Supabase.
export function toMapEvent(row: SpolkyEventRow): MapEvent {
  const soc = societyById(row.association_id);
  const coord: [number, number] | null =
    row.coord_lng != null && row.coord_lat != null ? [row.coord_lng, row.coord_lat] : null;
  return {
    id: row.id,
    title: row.title,
    url: row.url ?? '',
    date: row.date,
    endDate: row.end_date,
    time: row.time,
    location: row.location,
    imageUrl: null,
    organizerKey: soc.facultyKey,
    societyId: row.association_id,
    coord,
    roomCode: row.room_code,
    venueKind: row.venue_kind as MapEvent['venueKind'],
    category: row.category as EventCategory,
  };
}

export async function fetchMapEvents(): Promise<MapEvent[]> {
  const { data, error } = await supabase
    .from('spolky_events')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    logError('Api.fetchMapEvents', error);
    return [];
  }

  return (data ?? []).map((row) => toMapEvent(row as SpolkyEventRow));
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run src/api/__tests__/mapEvents.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Update the one `fetchMapEvents` call site**

In `src/store/slices/createMapSlice.ts`, the `loadMapEvents` action currently reads (per the earlier audit, around line 119):

```ts
      const events = await fetchMapEvents(language);
```

Change it to:

```ts
      const events = await fetchMapEvents();
```

If `language` becomes unused in that function as a result, remove the now-dead parameter/variable at that call site only — do not touch unrelated logic in the same file.

- [ ] **Step 6: Run the map slice test suite**

```bash
npx vitest run src/store/slices/__tests__/createMapSlice.test.ts
```

Expected: PASS (or update any test that explicitly asserted `fetchMapEvents` was called with a language argument — change the assertion to a no-arg call).

- [ ] **Step 7: Commit**

```bash
git add src/api/mapEvents.ts src/api/__tests__/mapEvents.test.ts src/store/slices/createMapSlice.ts
git commit -m "feat(events): replace mock map events with real spolky_events fetch"
```

---

### Task 14: reis-extension — delete dead `inferCategory` mock seam

**Files:**
- Modify: `/Users/dominik-personal/Documents/reis-extension/.claude/worktrees/society-map-events/src/data/eventCategories.ts`

**Interfaces:**
- Removes: `inferCategory`, `RULES` (confirmed via grep to have no callers outside the now-deleted mock in `mapEvents.ts`). `CATEGORY_ICON`, `CATEGORY_COLOR`, `CATEGORY_EMOJI_SRC` are unaffected and remain exported.

- [ ] **Step 1: Delete the mock-only code**

Remove the `RULES` array and the `inferCategory` function (currently lines 59–76) from `src/data/eventCategories.ts`, leaving `CATEGORY_ICON`, `CATEGORY_COLOR`, and `CATEGORY_EMOJI_SRC` untouched.

- [ ] **Step 2: Confirm nothing else references it**

```bash
cd /Users/dominik-personal/Documents/reis-extension/.claude/worktrees/society-map-events
grep -rn "inferCategory" src/
```

Expected: no matches.

- [ ] **Step 3: Typecheck + full test run**

```bash
npm run typecheck
npx vitest run
```

Expected: both pass with no new failures.

- [ ] **Step 4: Commit**

```bash
git add src/data/eventCategories.ts
git commit -m "chore(events): delete dead inferCategory mock seam"
```

---

## Final Verification (after all tasks)

```bash
cd /Users/dominik-personal/Documents/reis-extension/.claude/worktrees/society-map-events
npm run typecheck && npm run lint && npx vitest run

cd /Users/dominik-personal/Documents/reis-admin
npx tsc --noEmit && npx vitest run
```

Then manually: create an event in reis-admin for each location mode, open the reis-extension campus map (`npm run dev`, load the extension, navigate to IS Mendelu), and confirm both events render as pins in the correct place with the correct society color/category emoji, and the "fly to room" click works for the campus-mode event.
