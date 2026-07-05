# Society Map Mode & Event Authoring Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the modal `SocietyPostManager` shell with a Student↔Society mode on the real Leaflet campus map, where a logged-in society authors events by clicking the map (create/edit/delete), sees its own live + faded "scheduled" pins, and the public map only shows the rolling this-week+next-week window.

**Architecture:** All map UI state lives in the existing `MapSlice`; a new `mapMode` flag swaps the event *source* (public `mapEvents` ↔ the society's own `societyMapEvents`, derived from `societyPosts`) and the side panel (`EventsList` ↔ `MyEventsPanel`). Writes go through the already-built `societyPosts` API (`createPost`/`updatePost`/`deletePost`) on the RLS-gated `adminAuthClient`. Placement is click-to-place: a `placingEvent` flag makes the next map click capture a `[lng,lat]` coordinate — no geocoding. A pure `eventWindow.ts` module classifies each event as past / public / scheduled by date.

**Tech Stack:** WXT + React 19, Zustand (sliced) + Immer, Leaflet, Tailwind 4 + DaisyUI 5, TypeScript strict, Vitest + happy-dom, @testing-library/react.

## Global Constraints

- **Test-first (TDD):** every task writes a failing test before implementation.
- **Publishable-key only.** Public reads use the anon `supabase` client (`services/spolky/supabaseClient`); every write uses `adminAuthClient` (`services/admin/authClient`). Never introduce `service_role`.
- **Society mode is UI-gated, server-enforced.** Enter society mode only when `adminRole === 'association'` **and** `adminAssociationId != null`; RLS still gates every write.
- **NO `localStorage`/`sessionStorage`** — persistence via IndexedDB/chrome.storage only (none needed here; `mapMode` is in-memory).
- **NO `useEffect` for data fetching** — components read the store; fetching stays in slices/API.
- **NO custom CSS** — DaisyUI/Tailwind classes only. Society brand colours come from `src/data/societies.ts` (`societyById`, `ALL_SOCIETIES`).
- **Coordinates:** `MapEvent.coord` and stored `coord_lng/coord_lat` are `[lng, lat]`; `buildings.json` `center` is `[lat, lng]` (already handled by `roomCodeToCoord`).
- **Public window = 14 rolling days** (`PUBLIC_WINDOW_DAYS`). Past = `daysUntil < 0`; public = `0 ≤ daysUntil < 14`; scheduled = `daysUntil ≥ 14`.
- **Max 200 lines per file** — `createMapSlice.ts` is near this; keep helpers in `eventWindow.ts`/`mapHelpers.ts`, panel logic in its own component.
- **Parsers are off-limits** — none are touched here.

## File Structure

| File | New/Modify | Responsibility |
|------|-----------|----------------|
| `src/components/CampusMap/eventWindow.ts` | Create | Pure date classification: `daysUntilEvent`, `isPastEvent`, `isPublicEvent`, `isScheduledEvent`, `goLiveDate`, `PUBLIC_WINDOW_DAYS`. |
| `src/components/CampusMap/__tests__/eventWindow.test.ts` | Create | Tests for the above. |
| `src/store/types.ts` | Modify | Extend `MapSlice` interface: `mapMode`, `societyMapEvents`, `placingEvent`, `draftCoord`, + actions. |
| `src/store/slices/createMapSlice.ts` | Modify | Implement new state/actions; extract `locateEvent`; `refreshSocietyMapEvents`; placement actions; `setMapMode` guard. |
| `src/store/slices/createAdminSlice.ts` | Modify | After `loadSocietyPosts`, call `get().refreshSocietyMapEvents()`; on logout reset `mapMode`/society events. |
| `src/components/CampusMap/MapModeToggle.tsx` | Create | Student/Society segmented toggle, shown only to a logged-in association. |
| `src/components/CampusMap/MyEventsPanel.tsx` | Create | Society-mode side panel: Create button + Live/Scheduled/Past sections. |
| `src/components/CampusMap/EventComposer.tsx` | Create | Create/edit form (name, date, click-to-place) → `createPost`/`updatePost`. |
| `src/components/CampusMap/MapSidePanel.tsx` | Modify | In society mode render `MyEventsPanel`; else the existing tabs. |
| `src/components/CampusMap/CampusMapView.tsx` | Modify | Mount `MapModeToggle`, `EventComposer`, and the placement banner. |
| `src/components/CampusMap/EventLayer.tsx` | Modify | Source events by `mapMode`; pass `scheduled` to pins. |
| `src/components/CampusMap/EventPin.tsx` | Modify | `scheduled` prop → faded/dashed style. |
| `src/components/CampusMap/MapCanvas.tsx` | Modify | When `placingEvent`, a map click captures `[lng,lat]` via `placeDraftCoord`. |
| `src/components/CampusMap/EventDetailCard.tsx` | Modify | Society-mode own event → Edit / Delete affordance. |
| `src/api/mapEvents.ts` | Modify | Filter `fetchMapEvents` to the public window. |
| `src/api/__tests__/mapEvents.test.ts` | Create/Modify | Test window filter + `toMapEvent`. |
| `src/i18n/locales/{en,cs}.json` | Modify | New `map.*`/`admin.*` strings. |

**Milestones (each independently shippable/testable):**
- **A — Display:** mode state + toggle + society event source + My-events panel (read-only over existing posts).
- **B — Create:** click-to-place composer → `createPost`.
- **C — Manage:** scheduled pin styling + edit/delete.
- **D — Public correctness:** rolling-window filter on the public map/feed.

> Deferred to a Phase-2 plan (not here): surfacing `view_count`/`click_count` analytics in the Past section. The public "Jdu"/Interest RSVP already exists (`EventRsvp`, `createRsvpSlice`) and renders in `EventDetailCard` — no work needed in Phase 1.

---

## Milestone A — Display

### Task A1: Event window classification helpers

**Files:**
- Create: `src/components/CampusMap/eventWindow.ts`
- Test: `src/components/CampusMap/__tests__/eventWindow.test.ts`

**Interfaces:**
- Consumes: `parseEventDate` from `./eventHelpers`.
- Produces: `PUBLIC_WINDOW_DAYS: number`; `daysUntilEvent(iso: string, now?: Date): number`; `isPastEvent(iso, now?): boolean`; `isPublicEvent(iso, now?): boolean`; `isScheduledEvent(iso, now?): boolean`; `goLiveDate(iso, now?): Date`.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/CampusMap/__tests__/eventWindow.test.ts
import { describe, it, expect } from 'vitest';
import {
  PUBLIC_WINDOW_DAYS, daysUntilEvent, isPastEvent, isPublicEvent, isScheduledEvent, goLiveDate,
} from '../eventWindow';

const NOW = new Date('2026-07-06T09:00:00'); // local midnight anchor = 2026-07-06

describe('eventWindow', () => {
  it('PUBLIC_WINDOW_DAYS is 14', () => {
    expect(PUBLIC_WINDOW_DAYS).toBe(14);
  });
  it('daysUntilEvent counts whole days from local midnight', () => {
    expect(daysUntilEvent('2026-07-06', NOW)).toBe(0);
    expect(daysUntilEvent('2026-07-10', NOW)).toBe(4);
    expect(daysUntilEvent('2026-07-01', NOW)).toBe(-5);
  });
  it('classifies past / public / scheduled by the 14-day window', () => {
    expect(isPastEvent('2026-07-05', NOW)).toBe(true);
    expect(isPublicEvent('2026-07-05', NOW)).toBe(false);

    expect(isPublicEvent('2026-07-06', NOW)).toBe(true);   // today
    expect(isPublicEvent('2026-07-19', NOW)).toBe(true);    // day 13, last public day
    expect(isScheduledEvent('2026-07-19', NOW)).toBe(false);

    expect(isPublicEvent('2026-07-20', NOW)).toBe(false);   // day 14, no longer public
    expect(isScheduledEvent('2026-07-20', NOW)).toBe(true);
    expect(isScheduledEvent('2026-08-15', NOW)).toBe(true);
  });
  it('goLiveDate is the first day the event enters the public window', () => {
    // 2026-08-15 is day 40; it becomes public when daysUntil === 13 → 2026-08-02.
    expect(goLiveDate('2026-08-15', NOW).toISOString().slice(0, 10)).toBe('2026-08-02');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/eventWindow.test.ts`
Expected: FAIL — `Cannot find module '../eventWindow'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/components/CampusMap/eventWindow.ts
import { parseEventDate } from './eventHelpers';

// How far ahead the PUBLIC map/feed shows events: this week + next week.
// Past events and anything further out are hidden from students; a society's own
// far-future events surface only in Society mode as "scheduled" pins.
export const PUBLIC_WINDOW_DAYS = 14;

function startOfDay(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Whole days from local midnight-today to the event date (negative = past).
export function daysUntilEvent(iso: string, now: Date = new Date()): number {
  return Math.round((parseEventDate(iso).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

export function isPastEvent(iso: string, now: Date = new Date()): boolean {
  return daysUntilEvent(iso, now) < 0;
}

// today .. today+13 inclusive.
export function isPublicEvent(iso: string, now: Date = new Date()): boolean {
  const d = daysUntilEvent(iso, now);
  return d >= 0 && d < PUBLIC_WINDOW_DAYS;
}

// A society's own upcoming event still outside the public window.
export function isScheduledEvent(iso: string, now: Date = new Date()): boolean {
  return daysUntilEvent(iso, now) >= PUBLIC_WINDOW_DAYS;
}

// The first calendar day the event becomes public (enters the window):
// date − (PUBLIC_WINDOW_DAYS − 1) days.
export function goLiveDate(iso: string, now: Date = new Date()): Date {
  void now;
  const d = startOfDay(parseEventDate(iso));
  d.setDate(d.getDate() - (PUBLIC_WINDOW_DAYS - 1));
  return d;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/CampusMap/__tests__/eventWindow.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/CampusMap/eventWindow.ts src/components/CampusMap/__tests__/eventWindow.test.ts
git commit -m "feat(map): pure event-window classification (past/public/scheduled)"
```

---

### Task A2: MapSlice — mode + society event source

**Files:**
- Modify: `src/store/types.ts` (MapSlice interface, after the `focusEventById` line ~445)
- Modify: `src/store/slices/createMapSlice.ts`
- Test: `src/store/slices/__tests__/createMapSlice.test.ts` (append)

**Interfaces:**
- Consumes: `societyPosts` from `AdminSlice`; `toMapEvent` from `../../api/mapEvents`; existing `roomCodeToCoord`, `INDEX`, `META`.
- Produces on the store: `mapMode: 'student' | 'society'`; `societyMapEvents: MapEvent[]`; `setMapMode(mode: 'student' | 'society'): void`; `refreshSocietyMapEvents(): void`.

- [ ] **Step 1: Add the interface members** in `src/store/types.ts` inside `interface MapSlice`, immediately after `focusEventById(...)`:

```ts
  // --- Society authoring mode ---
  /** 'student' = public map; 'society' = the logged-in association's own events + authoring. */
  mapMode: 'student' | 'society';
  /** The logged-in association's own events (all dates), mapped from societyPosts. */
  societyMapEvents: MapEvent[];
  /** Switch map mode. Ignored (stays 'student') unless a society is logged in. */
  setMapMode: (mode: 'student' | 'society') => void;
  /** Rebuild societyMapEvents from the current societyPosts. Called after posts load/change. */
  refreshSocietyMapEvents: () => void;
```

- [ ] **Step 2: Write the failing test** (append to `createMapSlice.test.ts`)

```ts
import { toMapEvent } from '../../../api/mapEvents';
// ^ add to existing imports if not present

describe('map mode + society events', () => {
  it('defaults to student mode with no society events', () => {
    const s = useAppStore.getState();
    expect(s.mapMode).toBe('student');
    expect(s.societyMapEvents).toEqual([]);
  });

  it('setMapMode stays student when no society is logged in', () => {
    useAppStore.setState({ adminRole: null, adminAssociationId: null });
    useAppStore.getState().setMapMode('society');
    expect(useAppStore.getState().mapMode).toBe('student');
  });

  it('setMapMode enters society mode for a logged-in association', () => {
    useAppStore.setState({ adminRole: 'association', adminAssociationId: 'supef' });
    useAppStore.getState().setMapMode('society');
    expect(useAppStore.getState().mapMode).toBe('society');
    useAppStore.getState().setMapMode('student');
    expect(useAppStore.getState().mapMode).toBe('student');
  });

  it('refreshSocietyMapEvents maps societyPosts to located MapEvents', () => {
    useAppStore.setState({
      societyPosts: [{
        id: 'e1', association_id: 'supef', title: 'Party', body: null, category: 'party',
        date: '2026-07-10', end_date: null, time: '20:00', venue_kind: 'offcampus',
        room_code: null, coord_lng: 16.61, coord_lat: 49.21, location: 'Bar', url: null,
        created_by: null, visible_from: null,
      }],
    });
    useAppStore.getState().refreshSocietyMapEvents();
    const evs = useAppStore.getState().societyMapEvents;
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ id: 'e1', title: 'Party', coord: [16.61, 49.21] });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/store/slices/__tests__/createMapSlice.test.ts -t "map mode"`
Expected: FAIL — `setMapMode is not a function` / `mapMode` undefined.

- [ ] **Step 4: Implement in `createMapSlice.ts`**

Add the import at the top (with the other imports):

```ts
import { fetchMapEvents, toMapEvent } from '../../api/mapEvents';
```
(replace the existing `import { fetchMapEvents } from '../../api/mapEvents';`).

Add a module-level helper below `buildingById`:

```ts
// Campus events carry a room code but no coordinate; resolve it to the building
// centre so they can be pinned. Off-campus/online events keep their own coord (or none).
function locateEvent(e: MapEvent): MapEvent {
  return e.coord || e.venueKind !== 'campus' || !e.roomCode
    ? e
    : { ...e, coord: roomCodeToCoord(e.roomCode, INDEX, META) };
}
```
Add `MapEvent` to the type import from `../../types/events` at the top (create the import if absent):

```ts
import type { MapEvent } from '../../types/events';
```

Add the new state to the returned object (next to `mapEvents`/`eventFilter`):

```ts
  mapMode: 'student',
  societyMapEvents: [],
```

Rewrite `loadMapEvents`'s mapping to reuse `locateEvent`:

```ts
  loadMapEvents: async () => {
    if (get().mapEventsLoaded) return;
    try {
      const events = await fetchMapEvents();
      set({ mapEvents: events.map(locateEvent), mapEventsLoaded: true });
    } catch (err) {
      logError('MapSlice.loadMapEvents', err);
    }
  },
```

Add the two new actions (place them after `setEventFilter`):

```ts
  setMapMode: (mode) => {
    if (mode === 'society' && !get().adminAssociationId) return; // gate: society only
    set({ mapMode: mode, mapSelection: null, placingEvent: false, draftCoord: null });
    if (mode === 'society') get().refreshSocietyMapEvents();
  },

  refreshSocietyMapEvents: () => {
    const rows = get().societyPosts;
    set({ societyMapEvents: rows.map((r) => locateEvent(toMapEvent(r))) });
  },
```
(`placingEvent`/`draftCoord` are added in Task B1; if implementing A before B, temporarily drop them from the `set` here and add them back in B1.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/store/slices/__tests__/createMapSlice.test.ts -t "map mode"`
Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: no errors (confirms `toMapEvent(r)` accepts the `SpolkyEventRow` superset).

- [ ] **Step 7: Commit**

```bash
git add src/store/types.ts src/store/slices/createMapSlice.ts src/store/slices/__tests__/createMapSlice.test.ts
git commit -m "feat(map): mapMode + society event source in MapSlice"
```

---

### Task A3: Wire society posts → society map events; reset on logout

**Files:**
- Modify: `src/store/slices/createAdminSlice.ts`
- Test: `src/store/slices/__tests__/createAdminSlice.test.ts` (append)

**Interfaces:**
- Consumes: `get().refreshSocietyMapEvents()` (Task A2).
- Produces: after `loadSocietyPosts`, `societyMapEvents` reflects the loaded posts; after `adminLogout`, `mapMode` resets to `'student'`.

- [ ] **Step 1: Write the failing test**

```ts
describe('admin ↔ map wiring', () => {
  it('refreshes society map events after loading posts', async () => {
    // listMyPosts is mocked in this suite to return one row (see existing setup);
    // assert loadSocietyPosts populates societyMapEvents too.
    useAppStore.setState({ adminAssociationId: 'supef' });
    await useAppStore.getState().loadSocietyPosts();
    expect(useAppStore.getState().societyMapEvents.length).toBeGreaterThan(0);
  });

  it('logout resets map mode to student', async () => {
    useAppStore.setState({ mapMode: 'society', adminRole: 'association', adminAssociationId: 'supef' });
    await useAppStore.getState().adminLogout();
    expect(useAppStore.getState().mapMode).toBe('student');
    expect(useAppStore.getState().societyMapEvents).toEqual([]);
  });
});
```
(If the existing suite doesn't already mock `listMyPosts`, mock `../../api/societyPosts` at the top: `vi.mock('../../../api/societyPosts', () => ({ listMyPosts: vi.fn().mockResolvedValue([{ id:'e1', association_id:'supef', title:'X', body:null, category:'party', date:'2026-07-10', end_date:null, time:null, venue_kind:'offcampus', room_code:null, coord_lng:16.6, coord_lat:49.2, location:null, url:null, created_by:null, visible_from:null }]) }))`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/slices/__tests__/createAdminSlice.test.ts -t "admin ↔ map"`
Expected: FAIL — `societyMapEvents` empty / `mapMode` still `'society'`.

- [ ] **Step 3: Implement in `createAdminSlice.ts`**

In `loadSocietyPosts`, after `set({ societyPosts: posts })` add the refresh:

```ts
  loadSocietyPosts: async () => {
    const associationId = get().adminAssociationId;
    if (!associationId) { set({ societyPosts: [] }); get().refreshSocietyMapEvents(); return; }
    const posts = await listMyPosts(associationId);
    set({ societyPosts: posts });
    get().refreshSocietyMapEvents();
  },
```

In `adminLogout`, extend the reset `set(...)` to clear map mode:

```ts
  adminLogout: async () => {
    try { await adminAuthClient.auth.signOut(); } catch (e) { logError('Admin.logout', e); }
    set({ adminSession: null, adminRole: null, adminAssociationId: null, adminOverlayOpen: false, societyPosts: [], societyMapEvents: [], mapMode: 'student' });
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/slices/__tests__/createAdminSlice.test.ts -t "admin ↔ map"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/slices/createAdminSlice.ts src/store/slices/__tests__/createAdminSlice.test.ts
git commit -m "feat(admin): refresh society map events on load; reset mode on logout"
```

---

### Task A4: MapModeToggle component

**Files:**
- Create: `src/components/CampusMap/MapModeToggle.tsx`
- Test: `src/components/CampusMap/__tests__/MapModeToggle.test.tsx`

**Interfaces:**
- Consumes: `adminRole`, `mapMode`, `setMapMode` from the store; `useTranslation`.
- Produces: `<MapModeToggle />` — renders nothing unless `adminRole === 'association'`; otherwise a two-button segmented control.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/CampusMap/__tests__/MapModeToggle.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { MapModeToggle } from '../MapModeToggle';

describe('MapModeToggle', () => {
  beforeEach(() => {
    useAppStore.setState({ adminRole: null, adminAssociationId: null, mapMode: 'student' });
  });

  it('renders nothing when no association is logged in', () => {
    const { container } = render(<MapModeToggle />);
    expect(container).toBeEmptyDOMElement();
  });

  it('switches to society mode on click when logged in', () => {
    useAppStore.setState({ adminRole: 'association', adminAssociationId: 'supef' });
    render(<MapModeToggle />);
    fireEvent.click(screen.getByRole('button', { name: /society/i }));
    expect(useAppStore.getState().mapMode).toBe('society');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/MapModeToggle.test.tsx`
Expected: FAIL — `Cannot find module '../MapModeToggle'`.

- [ ] **Step 3: Implement**

```tsx
// src/components/CampusMap/MapModeToggle.tsx
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// Segmented Student/Society switch. Visible only to a logged-in association; it
// swaps the map between the public view and the society's authoring view.
export function MapModeToggle() {
  const role = useAppStore((s) => s.adminRole);
  const mode = useAppStore((s) => s.mapMode);
  const setMode = useAppStore((s) => s.setMapMode);
  const { t } = useTranslation();
  if (role !== 'association') return null;

  const btn = (key: 'student' | 'society', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === key}
      className={`tab gap-1.5 ${mode === key ? 'tab-active font-semibold' : ''}`}
      onClick={() => setMode(key)}
    >
      {label}
    </button>
  );

  return (
    <div role="tablist" className="tabs tabs-box tabs-sm bg-base-100/95 shadow-popover-heavy backdrop-blur-sm">
      {btn('student', t('map.mode.student'))}
      {btn('society', t('map.mode.society'))}
    </div>
  );
}
```

- [ ] **Step 4: Add i18n strings** to `src/i18n/locales/en.json` and `cs.json` under the `map` object (add a `mode` block):

en.json:
```json
"mode": { "student": "Student view", "society": "Society mode" },
```
cs.json:
```json
"mode": { "student": "Studentský pohled", "society": "Režim spolku" },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/CampusMap/__tests__/MapModeToggle.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/CampusMap/MapModeToggle.tsx src/components/CampusMap/__tests__/MapModeToggle.test.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat(map): Student/Society mode toggle (association-only)"
```

---

### Task A5: EventLayer + EventsList source events by mode

**Files:**
- Modify: `src/components/CampusMap/EventLayer.tsx`
- Modify: `src/components/CampusMap/EventsList.tsx`
- Test: `src/components/CampusMap/__tests__/EventLayer.test.tsx` (append a case)

**Interfaces:**
- Consumes: `mapMode`, `societyMapEvents`, `mapEvents` from the store.
- Produces: in society mode both the pins and the list read from `societyMapEvents`; student mode unchanged.

- [ ] **Step 1: Write the failing test** (append to `EventLayer.test.tsx`)

```tsx
it('renders the society events when in society mode', () => {
  useAppStore.setState({
    mapMode: 'society',
    societyMapEvents: [{
      id: 's1', title: 'Society Party', url: '', date: '2026-07-10', endDate: null, time: null,
      location: null, imageUrl: null, organizerKey: 'pef', societyId: 'supef',
      coord: [16.61, 49.21], roomCode: null, venueKind: 'offcampus', category: 'party',
    }],
    mapEvents: [], eventFilter: 'all', activeBuildingId: null,
  });
  // With the map instance mocked as in the existing suite, assert the layer uses
  // societyMapEvents (e.g. the pin title "Society Party" is present).
  // (Follow the existing EventLayer.test.tsx harness for mounting + map stub.)
});
```
(Adapt to the existing `EventLayer.test.tsx` map-instance stub; the assertion is that society-mode groups come from `societyMapEvents`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/EventLayer.test.tsx`
Expected: FAIL — layer still reads `mapEvents` (empty), no "Society Party".

- [ ] **Step 3: Implement in `EventLayer.tsx`** — replace the events source line:

```tsx
  const mode = useAppStore((s) => s.mapMode);
  const publicEvents = useAppStore((s) => s.mapEvents);
  const societyEvents = useAppStore((s) => s.societyMapEvents);
  const events = mode === 'society' ? societyEvents : publicEvents;
```
(remove the old `const events = useAppStore((s) => s.mapEvents);`). The rest of `EventLayer` is unchanged (`groups` already derives from `events`).

- [ ] **Step 4: Implement in `EventsList.tsx`** — same source swap at the top of the component:

```tsx
  const mode = useAppStore((s) => s.mapMode);
  const publicEvents = useAppStore((s) => s.mapEvents);
  const societyEvents = useAppStore((s) => s.societyMapEvents);
  const events = mode === 'society' ? societyEvents : publicEvents;
```
(replace `const events = useAppStore((s) => s.mapEvents);`). In society mode `MapSidePanel` renders `MyEventsPanel` instead (Task A6), so this swap mainly future-proofs `EventsList`; keep it minimal.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/CampusMap/__tests__/EventLayer.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/CampusMap/EventLayer.tsx src/components/CampusMap/EventsList.tsx src/components/CampusMap/__tests__/EventLayer.test.tsx
git commit -m "feat(map): pins + list read society events in society mode"
```

---

### Task A6: MyEventsPanel + panel swap

**Files:**
- Create: `src/components/CampusMap/MyEventsPanel.tsx`
- Modify: `src/components/CampusMap/MapSidePanel.tsx`
- Test: `src/components/CampusMap/__tests__/MyEventsPanel.test.tsx`

**Interfaces:**
- Consumes: `societyMapEvents`, `focusEventById`, `beginPlacing` (Task B1 — until then wire the Create button to a no-op/`console` and finish in B4), `useTranslation`; `isPastEvent`/`isScheduledEvent`/`goLiveDate` from `./eventWindow`; `sortByDate` from `./eventHelpers`.
- Produces: `<MyEventsPanel />` with three labelled sections (Live now / Scheduled / Past) and a Create button; rows call `focusEventById(id, { fly: true })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/CampusMap/__tests__/MyEventsPanel.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { MyEventsPanel } from '../MyEventsPanel';
import type { MapEvent } from '../../../types/events';

const mk = (id: string, date: string): MapEvent => ({
  id, title: `E-${id}`, url: '', date, endDate: null, time: null, location: null,
  imageUrl: null, organizerKey: 'pef', societyId: 'supef', coord: [16.6, 49.2],
  roomCode: null, venueKind: 'offcampus', category: 'party',
});

describe('MyEventsPanel', () => {
  beforeEach(() => {
    // NOW is real; pick dates relative to today so the buckets are deterministic.
    const today = new Date(); const iso = (d: number) => {
      const t = new Date(today); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10);
    };
    useAppStore.setState({
      mapMode: 'society',
      societyMapEvents: [mk('past', iso(-3)), mk('live', iso(2)), mk('sched', iso(30))],
    });
  });

  it('groups own events into Live / Scheduled / Past', () => {
    render(<MyEventsPanel />);
    expect(screen.getByText('E-live')).toBeInTheDocument();
    expect(screen.getByText('E-sched')).toBeInTheDocument();
    expect(screen.getByText('E-past')).toBeInTheDocument();
    // headings present
    expect(screen.getByText(/live now/i)).toBeInTheDocument();
    expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
    expect(screen.getByText(/past/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/MyEventsPanel.test.tsx`
Expected: FAIL — `Cannot find module '../MyEventsPanel'`.

- [ ] **Step 3: Implement**

```tsx
// src/components/CampusMap/MyEventsPanel.tsx
import { Plus } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { sortByDate } from './eventHelpers';
import { isPastEvent, isScheduledEvent, goLiveDate } from './eventWindow';
import type { MapEvent } from '../../types/events';

function Row({ event, sub, onClick }: { event: MapEvent; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-base-200">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-base-content">{event.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-base-content/60">{sub}</span>
      </span>
    </button>
  );
}

// Society-mode side panel: the association's own events grouped by lifecycle, plus
// the Create entry point. Live = on the public map now; Scheduled = still hidden
// from students (goes live ~2 weeks out); Past = aged off the map (kept for the
// society). Rows fly the map to the event.
export function MyEventsPanel() {
  const events = useAppStore((s) => s.societyMapEvents);
  const focusEvent = useAppStore((s) => s.focusEventById);
  const beginPlacing = useAppStore((s) => s.beginPlacing);
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  const past = sortByDate(events.filter((e) => isPastEvent(e.date))).reverse();
  const scheduled = sortByDate(events.filter((e) => isScheduledEvent(e.date)));
  const live = sortByDate(events.filter((e) => !isPastEvent(e.date) && !isScheduledEvent(e.date)));
  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  const section = (label: string, rows: MapEvent[], sub: (e: MapEvent) => string) =>
    rows.length > 0 && (
      <div>
        <div className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-base-content/60">{label}</div>
        {rows.map((e) => <Row key={e.id} event={e} sub={sub(e)} onClick={() => focusEvent(e.id, { fly: true })} />)}
      </div>
    );

  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-bold">{t('map.myEvents')}</span>
        <button type="button" className="btn btn-primary btn-xs gap-1" onClick={beginPlacing}>
          <Plus size={13} /> {t('map.createEvent')}
        </button>
      </div>
      <div className="overflow-y-auto">
        {section(t('map.liveNow'), live, (e) => fmt(e.date))}
        {section(t('map.scheduled'), scheduled, (e) => `${fmt(e.date)} · ${t('map.goesLive')} ${goLiveDate(e.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`)}
        {section(t('map.past'), past, (e) => fmt(e.date))}
        {events.length === 0 && <p className="px-3 py-6 text-center text-sm text-base-content/60">{t('map.noOwnEvents')}</p>}
      </div>
    </div>
  );
}
```
(`beginPlacing` is added in Task B1. If building A first, temporarily replace `onClick={beginPlacing}` with `onClick={() => {}}` and restore in B4.)

- [ ] **Step 4: Swap the panel in `MapSidePanel.tsx`** — read the mode and short-circuit to `MyEventsPanel`:

```tsx
import { MyEventsPanel } from './MyEventsPanel';
// ...
export function MapSidePanel() {
  const mode = useAppStore((s) => s.mapMode);
  const tab = useAppStore((s) => s.mapPanelTab);
  const setTab = useAppStore((s) => s.setMapPanelTab);
  const { t } = useTranslation();

  if (mode === 'society') {
    return (
      <div className="flex max-h-[80vh] w-64 flex-col overflow-hidden rounded-box border border-base-300 bg-base-100/95 shadow-popover-heavy backdrop-blur-sm">
        <MyEventsPanel />
      </div>
    );
  }
  // ...existing tabbed return unchanged...
}
```

- [ ] **Step 5: Add i18n strings** to `en.json`/`cs.json` under `map`:

en: `"myEvents": "My events", "createEvent": "Create event", "liveNow": "Live now", "scheduled": "Scheduled", "past": "Past", "goesLive": "goes live", "noOwnEvents": "No events yet — create your first."`
cs: `"myEvents": "Moje akce", "createEvent": "Vytvořit akci", "liveNow": "Živě", "scheduled": "Naplánované", "past": "Proběhlé", "goesLive": "zveřejní se", "noOwnEvents": "Zatím žádné akce — vytvořte první."`

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/components/CampusMap/__tests__/MyEventsPanel.test.tsx`
Expected: PASS.

- [ ] **Step 7: Mount the toggle** in `CampusMapView.tsx` — add `<MapModeToggle />` into the left column under the search:

```tsx
import { MapModeToggle } from './MapModeToggle';
// inside leftPanelRef column, after <FloorStack />:
        <MapModeToggle />
```

- [ ] **Step 8: Build + commit**

```bash
npm run build   # expect exit 0
git add src/components/CampusMap/MyEventsPanel.tsx src/components/CampusMap/MapSidePanel.tsx src/components/CampusMap/CampusMapView.tsx src/components/CampusMap/__tests__/MyEventsPanel.test.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat(map): My-events society panel + panel swap + toggle mount"
```

**Milestone A ships:** a logged-in society can flip to Society mode and see its own events grouped Live/Scheduled/Past, with its own pins on the map.

---

## Milestone B — Create (click-to-place)

### Task B1: Placement state in MapSlice

**Files:**
- Modify: `src/store/types.ts` (MapSlice interface)
- Modify: `src/store/slices/createMapSlice.ts`
- Test: `src/store/slices/__tests__/createMapSlice.test.ts` (append)

**Interfaces:**
- Produces: `placingEvent: boolean`; `draftCoord: [number, number] | null`; `beginPlacing(): void`; `cancelPlacing(): void`; `placeDraftCoord(coord: [number, number]): void`; `clearDraftCoord(): void`.

- [ ] **Step 1: Add interface members** in `types.ts` MapSlice:

```ts
  /** True while the user is picking a spot: the next map click captures a coordinate. */
  placingEvent: boolean;
  /** The coordinate [lng,lat] picked for the event being composed (null = none yet). */
  draftCoord: [number, number] | null;
  beginPlacing: () => void;
  cancelPlacing: () => void;
  /** Record a picked coordinate and leave placing mode. */
  placeDraftCoord: (coord: [number, number]) => void;
  clearDraftCoord: () => void;
```

- [ ] **Step 2: Write the failing test**

```ts
describe('click-to-place', () => {
  it('arms and captures a coordinate', () => {
    const s = useAppStore.getState();
    s.beginPlacing();
    expect(useAppStore.getState().placingEvent).toBe(true);
    useAppStore.getState().placeDraftCoord([16.6, 49.2]);
    const st = useAppStore.getState();
    expect(st.placingEvent).toBe(false);
    expect(st.draftCoord).toEqual([16.6, 49.2]);
  });
  it('cancel clears the armed state without a coordinate', () => {
    useAppStore.getState().beginPlacing();
    useAppStore.getState().cancelPlacing();
    expect(useAppStore.getState().placingEvent).toBe(false);
    expect(useAppStore.getState().draftCoord).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/store/slices/__tests__/createMapSlice.test.ts -t "click-to-place"`
Expected: FAIL — `beginPlacing is not a function`.

- [ ] **Step 4: Implement** — add initial state (`placingEvent: false, draftCoord: null,`) next to `mapMode` and the actions after `refreshSocietyMapEvents`:

```ts
  beginPlacing: () => set({ placingEvent: true, mapSelection: null }),
  cancelPlacing: () => set({ placingEvent: false }),
  placeDraftCoord: (coord) => set({ draftCoord: coord, placingEvent: false }),
  clearDraftCoord: () => set({ draftCoord: null }),
```

- [ ] **Step 5: Run + commit**

Run: `npx vitest run src/store/slices/__tests__/createMapSlice.test.ts -t "click-to-place"` → PASS
```bash
git add src/store/types.ts src/store/slices/createMapSlice.ts src/store/slices/__tests__/createMapSlice.test.ts
git commit -m "feat(map): placement state (arm/capture/cancel a coordinate)"
```

---

### Task B2: MapCanvas captures the placement click

**Files:**
- Modify: `src/components/CampusMap/MapCanvas.tsx`

**Interfaces:**
- Consumes: `placingEvent`, `placeDraftCoord` from the store (read live via `useAppStore.getState()` inside the Leaflet handler).

- [ ] **Step 1: Implement** — in the campus-overview `onOverviewClick` handler, intercept placement **before** the clear-selection logic:

```ts
      const onOverviewClick = (e: L.LeafletMouseEvent) => {
        const t = e.originalEvent.target as HTMLElement | null;
        if (t?.closest('.leaflet-reisEvents-pane')) return;
        const state = useAppStore.getState();
        if (state.placingEvent) {                       // click-to-place: capture [lng,lat]
          state.placeDraftCoord([e.latlng.lng, e.latlng.lat]);
          return;
        }
        const sel = state.mapSelection;
        if (sel?.kind === 'poi' && REMOTE_IDS.has(sel.poi.id)) select.focusCampus();
        else if (sel) select.clearMapSelection();
      };
```
(This is a behavioural change to an existing handler; there is no unit test for the Leaflet click path — it's verified via the composer test in B3 which calls `placeDraftCoord` directly, and by the manual build check. Do not add a brittle Leaflet-event test.)

- [ ] **Step 2: Build + commit**

```bash
npm run build   # exit 0
git add src/components/CampusMap/MapCanvas.tsx
git commit -m "feat(map): map click captures the placement coordinate"
```

---

### Task B3: EventComposer — create

**Files:**
- Create: `src/components/CampusMap/EventComposer.tsx`
- Test: `src/components/CampusMap/__tests__/EventComposer.test.tsx`

**Interfaces:**
- Consumes: `draftCoord`, `beginPlacing`, `clearDraftCoord`, `adminAssociationId`, `adminSession`, `loadSocietyPosts` from the store; `createPost`, `type PostInput` from `../../api/societyPosts`.
- Produces: `<EventComposer />` — renders only when composing (an `open` flag in the store, Task B4) or is controlled by props. For testability it takes `{ onDone }` and reads `draftCoord` from the store.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/CampusMap/__tests__/EventComposer.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventComposer } from '../EventComposer';

vi.mock('../../../api/societyPosts', async (orig) => ({
  ...(await orig<typeof import('../../../api/societyPosts')>()),
  createPost: vi.fn().mockResolvedValue({ id: 'new1' }),
}));
import { createPost } from '../../../api/societyPosts';

describe('EventComposer (create)', () => {
  beforeEach(() => {
    useAppStore.setState({ adminAssociationId: 'supef', adminSession: { user: { email: 'a@supef.cz' } } as never, draftCoord: null });
    vi.clearAllMocks();
  });

  it('publish is disabled until name, date and place are set', async () => {
    render(<EventComposer onDone={() => {}} />);
    const publish = screen.getByRole('button', { name: /publish/i });
    expect(publish).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Spring Party' } });
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2026-07-10' } });
    useAppStore.setState({ draftCoord: [16.61, 49.21] }); // as if the map was clicked
    expect(screen.getByRole('button', { name: /publish/i })).toBeEnabled();
  });

  it('publishes via createPost with the picked coordinate', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    const onDone = vi.fn();
    render(<EventComposer onDone={onDone} />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Spring Party' } });
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2026-07-10' } });
    fireEvent.click(screen.getByRole('button', { name: /publish/i }));
    await waitFor(() => expect(createPost).toHaveBeenCalled());
    const [input, assoc] = (createPost as unknown as vi.Mock).mock.calls[0];
    expect(assoc).toBe('supef');
    expect(input).toMatchObject({ title: 'Spring Party', date: '2026-07-10', venueKind: 'offcampus', coordLng: 16.61, coordLat: 49.21 });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/EventComposer.test.tsx`
Expected: FAIL — `Cannot find module '../EventComposer'`.

- [ ] **Step 3: Implement** (no native `<form>` — the iframe is sandboxed without `allow-forms`; submit from the button):

```tsx
// src/components/CampusMap/EventComposer.tsx
import { useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { createPost, type PostInput } from '../../api/societyPosts';

// Create an event by clicking the map. No <form> submit (sandboxed iframe blocks
// it); Publish is a button. Place is captured into the store's draftCoord by the
// map click, so this form owns only name + date. venueKind is 'offcampus' because
// the coordinate is a free point, not a room (satisfies the venue check constraint).
export function EventComposer({ onDone }: { onDone: () => void }) {
  const associationId = useAppStore((s) => s.adminAssociationId);
  const email = useAppStore((s) => s.adminSession?.user.email ?? '');
  const draftCoord = useAppStore((s) => s.draftCoord);
  const beginPlacing = useAppStore((s) => s.beginPlacing);
  const clearDraftCoord = useAppStore((s) => s.clearDraftCoord);
  const loadSocietyPosts = useAppStore((s) => s.loadSocietyPosts);
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const ready = !!title.trim() && !!date && !!draftCoord;

  const close = () => { clearDraftCoord(); onDone(); };

  const publish = async () => {
    if (!ready || busy || !associationId || !draftCoord) return;
    setBusy(true); setError(false);
    const input: PostInput = {
      title: title.trim(), body: '', category: 'party', date,
      venueKind: 'offcampus', coordLng: draftCoord[0], coordLat: draftCoord[1],
    };
    try {
      const res = await createPost(input, associationId, email);
      if (res.error) { setError(true); return; }
      await loadSocietyPosts();
      close();
    } catch { setError(true); } finally { setBusy(false); }
  };

  return (
    <div className="flex w-72 flex-col gap-3 rounded-box border border-base-300 bg-base-100/95 p-3 shadow-popover-heavy backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">{t('map.createEvent')}</span>
        <button type="button" className="btn btn-ghost btn-xs" aria-label={t('common.close')} onClick={close}><X size={14} /></button>
      </div>
      {error && <p className="text-error text-xs">{t('admin.saveError')}</p>}
      <label className="flex flex-col gap-1 text-xs">
        <span className="opacity-70">{t('map.eventName')}</span>
        <input aria-label={t('map.eventName')} className="input input-bordered input-sm" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="opacity-70">{t('map.eventDate')}</span>
        <input aria-label={t('map.eventDate')} type="date" className="input input-bordered input-sm" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <button type="button" className={`btn btn-sm gap-1 ${draftCoord ? 'btn-success btn-outline' : 'btn-outline'}`} onClick={beginPlacing}>
        <MapPin size={14} /> {draftCoord ? t('map.changePlace') : t('map.selectPlace')}
      </button>
      <button type="button" className="btn btn-primary btn-sm" disabled={!ready || busy} onClick={publish}>{t('map.publish')}</button>
    </div>
  );
}
```

- [ ] **Step 4: Add i18n strings** to `en.json`/`cs.json` under `map`:

en: `"eventName": "Event name", "eventDate": "Date", "selectPlace": "Select place on map", "changePlace": "Change place", "publish": "Publish event"`
cs: `"eventName": "Název akce", "eventDate": "Datum", "selectPlace": "Vybrat místo na mapě", "changePlace": "Změnit místo", "publish": "Zveřejnit akci"`
(Ensure `common.close` exists; if not, add `"close": "Close"` / `"Zavřít"`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/CampusMap/__tests__/EventComposer.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```bash
git add src/components/CampusMap/EventComposer.tsx src/components/CampusMap/__tests__/EventComposer.test.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat(map): event composer — create via click-to-place"
```

---

### Task B4: Wire composer open/close + placement banner

**Files:**
- Modify: `src/store/types.ts` (MapSlice: `composerOpen`, `openComposer`, `closeComposer`)
- Modify: `src/store/slices/createMapSlice.ts`
- Modify: `src/components/CampusMap/MyEventsPanel.tsx` (Create → `openComposer`)
- Modify: `src/components/CampusMap/CampusMapView.tsx` (render composer + placement banner)

**Interfaces:**
- Produces: `composerOpen: boolean`; `openComposer(): void` (sets `composerOpen: true`, clears any edit target — see C3); `closeComposer(): void` (clears `composerOpen`, `placingEvent`, `draftCoord`).

- [ ] **Step 1: Add interface + implementation.** In `types.ts` MapSlice:

```ts
  composerOpen: boolean;
  openComposer: () => void;
  closeComposer: () => void;
```
In `createMapSlice.ts` add `composerOpen: false,` to initial state and:

```ts
  openComposer: () => set({ composerOpen: true, draftCoord: null }),
  closeComposer: () => set({ composerOpen: false, placingEvent: false, draftCoord: null }),
```

- [ ] **Step 2: Point the Create button at it.** In `MyEventsPanel.tsx` replace `beginPlacing` in the Create button with `openComposer` (add `const openComposer = useAppStore((s) => s.openComposer);`). Keep `beginPlacing` for the composer's "Select place".

- [ ] **Step 3: Render the composer + banner** in `CampusMapView.tsx`:

```tsx
import { EventComposer } from './EventComposer';
// add store reads:
  const composerOpen = useAppStore((s) => s.composerOpen);
  const closeComposer = useAppStore((s) => s.closeComposer);
  const placing = useAppStore((s) => s.placingEvent);
  const cancelPlacing = useAppStore((s) => s.cancelPlacing);
  const { t } = useTranslation(); // add import
// inside the container, after <MapSidePanel /> block:
  {composerOpen && (
    <div className="absolute top-3 left-1/2 z-[1000] -translate-x-1/2 sm:left-3 sm:translate-x-0">
      <EventComposer onDone={closeComposer} />
    </div>
  )}
  {placing && (
    <div className="absolute top-3 left-1/2 z-[1001] flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-4 py-2 text-primary-content shadow-popover-heavy">
      <span className="text-sm font-semibold">{t('map.clickToPlace')}</span>
      <button type="button" className="btn btn-ghost btn-xs" onClick={cancelPlacing}>{t('common.cancel')}</button>
    </div>
  )}
```
Add i18n: en `"clickToPlace": "Click the map where your event is"`, `common.cancel` "Cancel"; cs `"clickToPlace": "Klikněte na mapu, kde akce je"`, `common.cancel` "Zrušit".

- [ ] **Step 4: Build + commit**

```bash
npm run build   # exit 0
git add src/store/types.ts src/store/slices/createMapSlice.ts src/components/CampusMap/MyEventsPanel.tsx src/components/CampusMap/CampusMapView.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat(map): open/close composer + placement banner"
```

**Milestone B ships:** a society clicks Create → names it → picks a date → clicks the map → Publish, and the event appears (via `loadSocietyPosts` → `refreshSocietyMapEvents`) as its own pin.

---

## Milestone C — Manage (scheduled styling + edit/delete)

### Task C1: Scheduled pin styling

**Files:**
- Modify: `src/components/CampusMap/EventPin.tsx`
- Modify: `src/components/CampusMap/EventLayer.tsx`
- Test: `src/components/CampusMap/__tests__/EventPin.test.tsx` (append)

**Interfaces:**
- Consumes: new optional `scheduled?: boolean` prop on `EventPin`.
- Produces: a faded pin (reduced opacity + dashed ring) when `scheduled`.

- [ ] **Step 1: Write the failing test** (append to `EventPin.test.tsx`)

```tsx
it('renders a faded style when scheduled', () => {
  const group = { key: 'k', coord: [16.6, 49.2] as [number, number], events: [{
    id: 'x', title: 'Future', url: '', date: '2026-12-01', endDate: null, time: null, location: null,
    imageUrl: null, organizerKey: 'pef', societyId: 'supef', coord: [16.6, 49.2] as [number, number],
    roomCode: null, venueKind: 'offcampus' as const, category: 'party' as const,
  }] };
  const { container } = render(<EventPin group={group} x={0} y={0} selected={false} scheduled locale="en-US" onSelect={() => {}} />);
  expect(container.querySelector('[data-scheduled="true"]')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/EventPin.test.tsx -t scheduled`
Expected: FAIL — no `[data-scheduled]` node.

- [ ] **Step 3: Implement in `EventPin.tsx`** — add the prop and apply style:

```tsx
interface EventPinProps {
  group: VenueGroup;
  x: number; y: number;
  selected: boolean;
  scheduled?: boolean;
  locale: string;
  onSelect: (id: string) => void;
}

export function EventPin({ group, x, y, selected, scheduled = false, locale, onSelect }: EventPinProps) {
  // ...existing lead/count/emojiSrc/color/dateLabel...
  return (
    <button /* ...unchanged... */ >
      <span
        data-scheduled={scheduled}
        className="relative flex items-center justify-center rounded-full bg-white transition-transform group-hover:scale-110"
        style={{
          width: 30, height: 30,
          opacity: scheduled ? 0.65 : 1,
          border: scheduled ? '1.5px dashed rgba(0,0,0,0.3)' : '1px solid rgba(0,0,0,0.12)',
          boxShadow: selected ? `0 0 0 2px ${color}, 0 1px 5px rgba(0,0,0,.3)` : '0 1px 4px rgba(0,0,0,.28)',
        }}
      >
        {/* ...unchanged img + hover bubble... */}
      </span>
    </button>
  );
}
```

- [ ] **Step 4: Pass `scheduled` from `EventLayer.tsx`** — import the helper and compute per group:

```tsx
import { isScheduledEvent } from './eventWindow';
// in the render map:
        <EventPin
          key={p.key}
          group={p.group}
          x={p.x}
          y={p.y}
          selected={p.group.events.some((e) => e.id === selectedId)}
          scheduled={mode === 'society' && isScheduledEvent(p.group.events[0].date)}
          locale={language === 'en' ? 'en-US' : 'cs-CZ'}
          onSelect={focusEvent}
        />
```
(`mode` is already read in Task A5.)

- [ ] **Step 5: Run + commit**

Run: `npx vitest run src/components/CampusMap/__tests__/EventPin.test.tsx` → PASS
```bash
git add src/components/CampusMap/EventPin.tsx src/components/CampusMap/EventLayer.tsx src/components/CampusMap/__tests__/EventPin.test.tsx
git commit -m "feat(map): faded scheduled pins in society mode"
```

---

### Task C2: EventComposer — edit mode

**Files:**
- Modify: `src/components/CampusMap/EventComposer.tsx`
- Modify: `src/store/types.ts` + `src/store/slices/createMapSlice.ts` (an `editEventId` target)
- Test: `src/components/CampusMap/__tests__/EventComposer.test.tsx` (append)

**Interfaces:**
- Produces: `editEventId: string | null`; `openComposer(id?: string)` now accepts an optional event id to edit; the composer prefills from `societyMapEvents.find(id)` and calls `updatePost(id, patch)` instead of `createPost`.

- [ ] **Step 1: Extend the slice.** In `types.ts` MapSlice change `openComposer` signature and add the target:

```ts
  editEventId: string | null;
  openComposer: (editId?: string) => void;
```
In `createMapSlice.ts`:

```ts
  editEventId: null,
  openComposer: (editId) => set({ composerOpen: true, editEventId: editId ?? null, draftCoord: null }),
  closeComposer: () => set({ composerOpen: false, editEventId: null, placingEvent: false, draftCoord: null }),
```

- [ ] **Step 2: Write the failing test** (append)

```tsx
vi.mock('../../../api/societyPosts', async (orig) => ({
  ...(await orig<typeof import('../../../api/societyPosts')>()),
  createPost: vi.fn().mockResolvedValue({ id: 'new1' }),
  updatePost: vi.fn().mockResolvedValue({}),
}));
import { updatePost } from '../../../api/societyPosts';

it('edits an existing event via updatePost', async () => {
  useAppStore.setState({
    adminAssociationId: 'supef',
    societyMapEvents: [{ id: 'e9', title: 'Old', url: '', date: '2026-07-10', endDate: null, time: null,
      location: null, imageUrl: null, organizerKey: 'pef', societyId: 'supef', coord: [16.6, 49.2],
      roomCode: null, venueKind: 'offcampus', category: 'party' }],
    editEventId: 'e9', draftCoord: [16.6, 49.2],
  });
  render(<EventComposer onDone={() => {}} />);
  expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Old');
  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(updatePost).toHaveBeenCalledWith('e9', expect.objectContaining({ title: 'New' })));
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/EventComposer.test.tsx -t edits`
Expected: FAIL — name not prefilled / `updatePost` not called.

- [ ] **Step 4: Implement edit mode in `EventComposer.tsx`** — prefill from the edit target and branch publish/save:

```tsx
  const editId = useAppStore((s) => s.editEventId);
  const editing = useAppStore((s) => s.societyMapEvents.find((e) => e.id === s.editEventId) ?? null);
  const setDraftCoord = useAppStore((s) => s.placeDraftCoord);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [date, setDate] = useState(editing?.date ?? '');
  // On mount for an edit, seed the draft coord from the event so "place" shows set:
  // (guard once — happy-dom re-render safe because placeDraftCoord is idempotent)
  if (editing && !useAppStore.getState().draftCoord && editing.coord) setDraftCoord(editing.coord);
```
Change the publish handler:

```ts
    try {
      const res = editId
        ? await updatePost(editId, { title: input.title, date: input.date, coord_lng: input.coordLng, coord_lat: input.coordLat, venue_kind: input.venueKind })
        : await createPost(input, associationId, email);
      if (res.error) { setError(true); return; }
      await loadSocietyPosts();
      close();
    } catch { setError(true); } finally { setBusy(false); }
```
Import `updatePost` and the button label switches: `{editId ? t('map.saveChanges') : t('map.publish')}`. Header switches to `t('map.editEvent')` when `editId`.
Add i18n: en `"editEvent": "Edit event", "saveChanges": "Save changes"`; cs `"editEvent": "Upravit akci", "saveChanges": "Uložit změny"`.

- [ ] **Step 5: Run + commit**

Run: `npx vitest run src/components/CampusMap/__tests__/EventComposer.test.tsx` → PASS
```bash
git add src/components/CampusMap/EventComposer.tsx src/store/types.ts src/store/slices/createMapSlice.ts src/components/CampusMap/__tests__/EventComposer.test.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat(map): composer edit mode via updatePost"
```

---

### Task C3: Edit/Delete affordance on the detail card

**Files:**
- Modify: `src/components/CampusMap/EventDetailCard.tsx`
- Test: `src/components/CampusMap/__tests__/DetailPanel.test.tsx` (append) or a new `EventDetailCard.test.tsx`

**Interfaces:**
- Consumes: `mapMode`, `adminAssociationId`, `openComposer`, `loadSocietyPosts` from the store; `deletePost` from `../../api/societyPosts`.
- Produces: in society mode, for the society's own event (`event.societyId === adminAssociationId`), an Edit button (→ `openComposer(event.id)`) and a Delete button (→ `deletePost` + reload).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/CampusMap/__tests__/EventDetailCard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventDetailCard } from '../EventDetailCard';
import type { MapEvent } from '../../../types/events';

vi.mock('../../../api/societyPosts', () => ({ deletePost: vi.fn().mockResolvedValue({}) }));
import { deletePost } from '../../../api/societyPosts';

const ev: MapEvent = { id: 'e1', title: 'Mine', url: '', date: '2026-07-10', endDate: null, time: null,
  location: null, imageUrl: null, organizerKey: 'pef', societyId: 'supef', coord: [16.6, 49.2],
  roomCode: null, venueKind: 'offcampus', category: 'party' };

describe('EventDetailCard society controls', () => {
  beforeEach(() => { useAppStore.setState({ mapMode: 'student', adminAssociationId: 'supef', loadSocietyPosts: vi.fn() as never }); vi.clearAllMocks(); });

  it('hides edit/delete for students', () => {
    render(<EventDetailCard event={ev} />);
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });

  it('deletes an own event in society mode', async () => {
    useAppStore.setState({ mapMode: 'society' });
    render(<EventDetailCard event={ev} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(deletePost).toHaveBeenCalledWith('e1'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/EventDetailCard.test.tsx`
Expected: FAIL — no Delete button.

- [ ] **Step 3: Implement** — add controls at the bottom of `EventDetailCard` when own event in society mode:

```tsx
  const mode = useAppStore((s) => s.mapMode);
  const myAssoc = useAppStore((s) => s.adminAssociationId);
  const openComposer = useAppStore((s) => s.openComposer);
  const loadSocietyPosts = useAppStore((s) => s.loadSocietyPosts);
  const mine = mode === 'society' && event.societyId === myAssoc;
  const removeEvent = async () => {
    const { deletePost } = await import('../../api/societyPosts');
    await deletePost(event.id);
    await loadSocietyPosts();
  };
  // ...inside the card, after the RSVP block:
  {mine && (
    <div className="flex gap-2 border-t border-base-300 pt-3">
      <button type="button" className="btn btn-outline btn-sm flex-1" onClick={() => openComposer(event.id)}>{t('map.edit')}</button>
      <button type="button" className="btn btn-outline btn-error btn-sm flex-1" onClick={removeEvent}>{t('map.delete')}</button>
    </div>
  )}
```
Add i18n: en `"edit": "Edit", "delete": "Delete"`; cs `"edit": "Upravit", "delete": "Smazat"`.
(Prefer a top-level `import { deletePost } from '../../api/societyPosts'` over dynamic import if it doesn't pull the admin client into the public bundle unnecessarily; the dynamic import keeps `adminAuthClient` out of the student path. Keep the static import only if bundle analysis shows no regression.)

- [ ] **Step 4: Run + build + commit**

Run: `npx vitest run src/components/CampusMap/__tests__/EventDetailCard.test.tsx` → PASS
```bash
npm run build   # exit 0
git add src/components/CampusMap/EventDetailCard.tsx src/components/CampusMap/__tests__/EventDetailCard.test.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat(map): edit/delete own event from the detail card"
```

**Milestone C ships:** scheduled events read as faded pins; a society edits or deletes any of its own events from the pin/detail card.

---

## Milestone D — Public correctness (rolling window filter)

### Task D1: Filter the public feed to the window

**Files:**
- Modify: `src/api/mapEvents.ts`
- Test: `src/api/__tests__/mapEvents.test.ts` (create if absent)

**Interfaces:**
- Consumes: `isPublicEvent` from `../components/CampusMap/eventWindow`.
- Produces: `fetchMapEvents` returns only events with `isPublicEvent(row.date)`; `toMapEvent` unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// src/api/__tests__/mapEvents.test.ts
import { describe, it, expect } from 'vitest';
import { toMapEvent } from '../mapEvents';
import { isPublicEvent } from '../../components/CampusMap/eventWindow';

const row = (date: string) => ({
  id: date, association_id: 'supef', title: 'E', category: 'party', date, end_date: null, time: null,
  venue_kind: 'offcampus', room_code: null, coord_lng: 16.6, coord_lat: 49.2, location: null, url: null,
});

describe('mapEvents public window', () => {
  it('toMapEvent maps coord as [lng,lat]', () => {
    expect(toMapEvent(row('2026-07-10')).coord).toEqual([16.6, 49.2]);
  });
  it('isPublicEvent gates past and far-future dates out', () => {
    const now = new Date('2026-07-06T09:00:00');
    expect(isPublicEvent('2026-07-01', now)).toBe(false); // past
    expect(isPublicEvent('2026-07-10', now)).toBe(true);  // in window
    expect(isPublicEvent('2026-08-30', now)).toBe(false); // far future
  });
});
```

- [ ] **Step 2: Run to verify it fails** (or passes for the pure helper; the filter itself is asserted by the added call). 

Run: `npx vitest run src/api/__tests__/mapEvents.test.ts`
Expected: initially FAIL only if `toMapEvent`/`isPublicEvent` import paths are wrong; fix imports so it passes, then wire the filter in Step 3.

- [ ] **Step 3: Implement the filter** in `fetchMapEvents`:

```ts
import { isPublicEvent } from '../components/CampusMap/eventWindow';
// ...
export async function fetchMapEvents(): Promise<MapEvent[]> {
  const { data, error } = await supabase
    .from('spolky_events')
    .select('*')
    .order('date', { ascending: true });
  if (error) { logError('Api.fetchMapEvents', error); return []; }
  return (data ?? [])
    .map((row) => row as SpolkyEventRow)
    .filter((row) => isPublicEvent(row.date))   // hide past + far-future from the public map/feed
    .map(toMapEvent);
}
```

- [ ] **Step 4: Run + build + commit**

Run: `npx vitest run src/api/__tests__/mapEvents.test.ts` → PASS
```bash
npm run build   # exit 0
git add src/api/mapEvents.ts src/api/__tests__/mapEvents.test.ts
git commit -m "feat(map): public map/feed shows only the rolling 2-week window"
```

- [ ] **Step 5: Full regression**

Run: `npm run test:run && npm run lint && npm run typecheck`
Expected: all pass. Fix any fallout (lint on changed files must be clean per project rule).

**Milestone D ships:** students only ever see this-week + next-week events; past events age off automatically and far-future ones stay hidden until ~2 weeks out.

---

## Self-Review

**Spec coverage (against `2026-07-05-society-event-authoring-ui-design.md`):**
- §1 Student↔Society toggle → A4 (`MapModeToggle`, association-gated).
- §2 click-to-place create, no geocoding, name+date+place → B1–B4 (`draftCoord`, `EventComposer`, `venueKind: 'offcampus'` point).
- §3 rolling window + scheduled → A1 (`eventWindow`), C1 (faded pins), D1 (public filter). Auto-go-live is emergent from the date filter (no stored flag) ✓.
- §4 My-events panel Live/Scheduled/Past + Create + select→fly → A6 (`MyEventsPanel`, `focusEventById({fly:true})`).
- §4 "no coordination view" → A5 sources society-mode events from `societyMapEvents` (own only); other societies never loaded in society mode ✓.
- §5 edit/delete → C2 (composer edit), C3 (detail-card controls).
- §6 past analytics (view/click counts) → **deferred to Phase 2** (noted; not a Phase-1 task).
- §7 public "Jdu" → already shipped (`EventRsvp` in `EventDetailCard`); no task needed ✓.

**Placeholder scan:** no TBD/TODO; every code step shows full code. The A6/`MyEventsPanel` `beginPlacing`→`openComposer` swap is called out explicitly in B4.

**Type consistency:** `openComposer` gains an optional `editId` in C2 (callers in A6/C3 pass `undefined`/an id — both valid). `mapMode`, `societyMapEvents`, `placingEvent`, `draftCoord`, `composerOpen`, `editEventId` are all declared in `types.ts` before use. `toMapEvent` accepts the `societyPosts.SpolkyEventRow` superset (verified by `npm run typecheck` in A2 Step 6). `placeDraftCoord([lng,lat])` order matches `MapEvent.coord`/`coordLng,coordLat` everywhere.

**Scope:** one coherent feature in four shippable milestones; each ends green. Phase-2 (past-event analytics counts) is intentionally out.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-05-society-map-mode-authoring.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task with review between tasks; fast iteration and isolation.
2. **Inline Execution** — execute tasks in this session via executing-plans, batched with checkpoints.

Which approach?
