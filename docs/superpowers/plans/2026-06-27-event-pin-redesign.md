# Event Pin Redesign + Pan Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the floating-balloon-on-a-rope event pin with a society-coloured teardrop that sits on the exact spot and carries a lucide event-type badge, and fix the bug where pins drift with the viewport during a map drag.

**Architecture:** A new `EventCategory` enum + `inferCategory(title)` heuristic + a lucide icon lookup feed both the redesigned `EventPin` (teardrop: society logo in the head, type badge top-right, count badge bottom-right, tip = anchor) and the existing list/detail surfaces. The pan fix binds `EventLayer` to Leaflet's *continuous* `move`/`zoom` events (rAF-throttled) so HTML-overlay pins reproject every frame.

**Tech Stack:** React 19, TypeScript (strict), lucide-react, Leaflet, Vitest + happy-dom + @testing-library/react.

## Global Constraints

- Max 200 lines per file; split if larger.
- Direct imports only — no re-export barrels.
- No custom CSS — DaisyUI semantic classes; inline `style` only for map-overlay colour literals.
- Map overlay colours are **fixed literals, not theme vars** (basemap is always light).
- No `useEffect` for data fetching (the existing `loadMapEvents` effect in `EventLayer` stays as-is).
- Test first: write the failing test before implementation.
- Icons come from `lucide-react` only (single icon set), filled/thick, readable at ~14px.
- Run a single test file with: `npx vitest run <path>`.
- After changes, `npm run build` must exit 0 before re-testing in the browser.

## File Structure

| File | Responsibility |
|------|----------------|
| `src/types/events.ts` *(modify)* | Add `EventCategory` union; add `category` field to `MapEvent`. |
| `src/data/eventCategories.ts` *(create)* | `CATEGORY_ICON` lookup (category → lucide component) + `inferCategory(title)` keyword heuristic. |
| `src/data/__tests__/eventCategories.test.ts` *(create)* | Tests for `inferCategory` + lookup completeness. |
| `src/api/mapEvents.ts` *(modify)* | Add optional `category` to `Seed`; populate `MapEvent.category` (explicit override ?? inferred). |
| `src/api/__tests__/mapEvents.test.ts` *(create)* | Every mock event has a category; spot-check known titles. |
| `src/components/CampusMap/EventPin.tsx` *(rewrite internals)* | Teardrop: head + pointer + type badge + count badge; tip anchored at `(x,y)`. |
| `src/components/CampusMap/__tests__/EventPin.test.tsx` *(create)* | Renders right type icon; count badge only when group > 1. |
| `src/components/CampusMap/EventLayer.tsx` *(modify)* | Bind continuous `move zoom moveend zoomend` → rAF `schedule`. |
| `src/components/CampusMap/__tests__/EventLayer.test.tsx` *(create)* | Binds the continuous `move`/`zoom` tokens (regression guard). |
| `src/components/CampusMap/EventsList.tsx` *(modify)* | Replace the society-colour dot with a society-coloured category icon. |
| `src/components/CampusMap/EventDetailCard.tsx` *(modify)* | Add a category row (icon + label) above the society chip. |
| `src/i18n/locales/{cs,en}.json` *(modify)* | `map.category.*` labels. |

---

### Task 1: Event category type, icon lookup, and inferCategory

**Files:**
- Modify: `src/types/events.ts`
- Create: `src/data/eventCategories.ts`
- Test: `src/data/__tests__/eventCategories.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `EventCategory = 'party' | 'boardgames' | 'trip' | 'quiz' | 'sports' | 'film' | 'karaoke' | 'culture' | 'social' | 'other'`
  - `MapEvent.category: EventCategory` (new required field)
  - `CATEGORY_ICON: Record<EventCategory, LucideIcon>`
  - `inferCategory(title: string): EventCategory`

- [ ] **Step 1: Write the failing test**

Create `src/data/__tests__/eventCategories.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { inferCategory, CATEGORY_ICON } from '../eventCategories';
import type { EventCategory } from '../../types/events';

describe('inferCategory', () => {
  const cases: Array<[string, EventCategory]> = [
    ['Deskovky', 'boardgames'],
    ['Trip to Ostrava', 'trip'],
    ['PEF Kvíz', 'quiz'],
    ['Akademické středy — ASY-Quiz', 'quiz'],
    ['Erasmus Cup: Basketball', 'sports'],
    ['Erasmus Cup: Volleyball', 'sports'],
    ['Filmový klubík', 'film'],
    ['BU Karaoke', 'karaoke'],
    ['Country Presentation', 'culture'],
    ['Tématické dny — Taiwanský den', 'culture'],
    ['NEON Party', 'party'],
    ['Tram Party', 'party'],
    ['Beer Pong', 'party'],
    ['International Student Ball', 'party'],
    ['Tour de Pub', 'social'],
    ['TINDELU', 'social'],
    ['Únikovka', 'social'],
    ['Something Unmapped', 'other'],
  ];
  it.each(cases)('maps %s → %s', (title, expected) => {
    expect(inferCategory(title)).toBe(expected);
  });
});

describe('CATEGORY_ICON', () => {
  it('has an icon for every category used by inferCategory', () => {
    const all: EventCategory[] = ['party', 'boardgames', 'trip', 'quiz', 'sports', 'film', 'karaoke', 'culture', 'social', 'other'];
    for (const c of all) expect(CATEGORY_ICON[c]).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/__tests__/eventCategories.test.ts`
Expected: FAIL — cannot resolve `../eventCategories`.

- [ ] **Step 3: Add the type to `src/types/events.ts`**

Add the union above `MendeluEvent`:

```ts
export type EventCategory =
  | 'party' | 'boardgames' | 'trip' | 'quiz' | 'sports'
  | 'film' | 'karaoke' | 'culture' | 'social' | 'other';
```

Add the `category` field to `MapEvent` (inside the existing interface):

```ts
export interface MapEvent extends MendeluEvent {
  id: string;
  societyId: string;
  coord: [number, number] | null; // [lng, lat]
  roomCode: string | null;
  venueKind: 'campus' | 'online' | 'offcampus';
  category: EventCategory;
}
```

- [ ] **Step 4: Create `src/data/eventCategories.ts`**

```ts
import {
  PartyPopper, Dices, Bus, Brain, Volleyball,
  Clapperboard, Mic, Globe, Beer, Sparkles, type LucideIcon,
} from 'lucide-react';
import type { EventCategory } from '../types/events';

// One lucide icon per category. Monochrome + consistent so the icon doubles as
// the map's legend (drawn in the society colour on the pin's white badge).
export const CATEGORY_ICON: Record<EventCategory, LucideIcon> = {
  party: PartyPopper,
  boardgames: Dices,
  trip: Bus,
  quiz: Brain,
  sports: Volleyball,
  film: Clapperboard,
  karaoke: Mic,
  culture: Globe,
  social: Beer,
  other: Sparkles,
};

// Keyword → category, first match wins (specific before generic). The real
// backend will carry an organizer-picked category; this is the mock seam.
const RULES: Array<[EventCategory, RegExp]> = [
  ['boardgames', /deskov|board\s?game/i],
  ['trip', /\btrip\b|výlet|zájezd/i],
  ['quiz', /kvíz|quiz/i],
  ['karaoke', /karaoke/i],
  ['film', /film|movie|kino/i],
  ['sports', /sport|basket|volej|volley|fotbal|football|běh|\brun\b/i],
  ['culture', /country|\bden\b|\bday\b|prezentace|presentation|tématick|kultur/i],
  ['party', /party|párty|ples|ball|neon|tram|beer\s?pong|beerpong/i],
  ['social', /pub|tinder|tindelu|únikov|escape|seznam|mixer|drink/i],
];

export function inferCategory(title: string): EventCategory {
  for (const [cat, re] of RULES) if (re.test(title)) return cat;
  return 'other';
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/data/__tests__/eventCategories.test.ts`
Expected: PASS (all `inferCategory` cases + lookup completeness).

> Note: leaving `category` required on `MapEvent` will make `src/api/mapEvents.ts` fail typecheck until Task 2 — that is expected and fixed there. Do not run `npm run typecheck` between Task 1 and Task 2.

- [ ] **Step 6: Commit**

```bash
git add src/types/events.ts src/data/eventCategories.ts src/data/__tests__/eventCategories.test.ts
git commit -m "feat(map): event category type, lucide icon lookup, inferCategory"
```

---

### Task 2: Populate category in the mock provider

**Files:**
- Modify: `src/api/mapEvents.ts`
- Test: `src/api/__tests__/mapEvents.test.ts`

**Interfaces:**
- Consumes: `inferCategory` (Task 1), `MapEvent.category` (Task 1).
- Produces: every `MOCK_MAP_EVENTS[i].category` is a valid `EventCategory`.

- [ ] **Step 1: Write the failing test**

Create `src/api/__tests__/mapEvents.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MOCK_MAP_EVENTS } from '../mapEvents';

describe('MOCK_MAP_EVENTS categories', () => {
  it('gives every event a category', () => {
    for (const e of MOCK_MAP_EVENTS) expect(e.category).toBeTruthy();
  });

  it('categorises known titles correctly', () => {
    const byTitle = (t: string) => MOCK_MAP_EVENTS.find((e) => e.title === t);
    expect(byTitle('Deskovky')?.category).toBe('boardgames');
    expect(byTitle('Trip to Ostrava')?.category).toBe('trip');
    expect(byTitle('Tram Party')?.category).toBe('party');
    expect(byTitle('PEF Kvíz')?.category).toBe('quiz');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/__tests__/mapEvents.test.ts`
Expected: FAIL — `e.category` is `undefined`.

- [ ] **Step 3: Add the import and Seed field**

At the top of `src/api/mapEvents.ts`, extend the type import:

```ts
import type { MapEvent, FacultyKey, EventCategory } from '../types/events';
import { inferCategory } from '../data/eventCategories';
```

Add an optional override to the `Seed` interface (one new line):

```ts
interface Seed {
  title: string;
  societyId: string;
  date: string; // ISO yyyy-mm-dd
  time: string | null;
  venue: keyof typeof VENUE | null; // null = off-campus, list-only
  room?: string;
  category?: EventCategory; // override; defaults to inferCategory(title)
}
```

- [ ] **Step 4: Set category in `toEvent`**

In the returned object inside `toEvent`, add the field (after `venueKind`):

```ts
    venueKind: s.venue ? 'campus' : 'offcampus',
    category: s.category ?? inferCategory(s.title),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/api/__tests__/mapEvents.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify typecheck is now clean for these files**

Run: `npm run typecheck`
Expected: exit 0 (the `category` field added in Task 1 is now satisfied everywhere).

- [ ] **Step 7: Commit**

```bash
git add src/api/mapEvents.ts src/api/__tests__/mapEvents.test.ts
git commit -m "feat(map): tag mock events with a category"
```

---

### Task 3: Teardrop EventPin with type + count badges

**Files:**
- Rewrite internals: `src/components/CampusMap/EventPin.tsx`
- Test: `src/components/CampusMap/__tests__/EventPin.test.tsx`

**Interfaces:**
- Consumes: `VenueGroup` + `parseEventDate` (`./eventHelpers`), `societyById` (`../../data/societies`), `CATEGORY_ICON` (`../../data/eventCategories`), `MapEvent.category` (Task 1).
- Produces: `EventPin` with unchanged props `{ group, x, y, selected, locale, onSelect }`. The bottom tip of the pin sits at `(x, y)`. Lucide icons render an `<svg>` with class `lucide-<kebab-name>` (e.g. `lucide-dices`, `lucide-party-popper`).

- [ ] **Step 1: Write the failing test**

Create `src/components/CampusMap/__tests__/EventPin.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventPin } from '../EventPin';
import type { VenueGroup } from '../eventHelpers';
import type { MapEvent, EventCategory } from '../../../types/events';

function ev(id: string, category: EventCategory, title = id): MapEvent {
  return {
    id, title, url: '', date: '2026-11-04', endDate: null, time: '17:00',
    location: 'Q23', imageUrl: null, organizerKey: 'pef', societyId: 'supef',
    coord: [16.614247, 49.209592], roomCode: 'Q23', venueKind: 'campus', category,
  };
}
function group(events: MapEvent[]): VenueGroup {
  return { key: 'k', coord: [16.614247, 49.209592], events };
}

describe('EventPin', () => {
  it('renders the lead event type icon', () => {
    const { container } = render(
      <EventPin group={group([ev('Deskovky', 'boardgames')])} x={100} y={100} selected={false} locale="en-US" onSelect={() => {}} />,
    );
    expect(container.querySelector('.lucide-dices')).toBeTruthy();
  });

  it('shows a count badge only when the group has more than one event', () => {
    const { rerender } = render(
      <EventPin group={group([ev('a', 'party')])} x={0} y={0} selected={false} locale="en-US" onSelect={() => {}} />,
    );
    expect(screen.queryByText('2')).toBeNull();
    rerender(
      <EventPin group={group([ev('a', 'party'), ev('b', 'quiz')])} x={0} y={0} selected={false} locale="en-US" onSelect={() => {}} />,
    );
    expect(screen.getByText('2')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/EventPin.test.tsx`
Expected: FAIL — the old EventPin renders no `.lucide-dices` (it draws a rope + poster ring).

- [ ] **Step 3: Rewrite `src/components/CampusMap/EventPin.tsx`**

Replace the entire file with:

```tsx
import type { VenueGroup } from './eventHelpers';
import { societyById } from '../../data/societies';
import { parseEventDate } from './eventHelpers';
import { CATEGORY_ICON } from '../../data/eventCategories';

interface EventPinProps {
  group: VenueGroup;
  x: number; // tip screen x (container px) = exact coordinate
  y: number; // tip screen y
  selected: boolean;
  locale: string;
  onSelect: (id: string) => void;
}

// A society-coloured teardrop whose pointed tip sits on the exact spot — no rope,
// no floating. The round head carries the society logo; a white badge (top-right)
// shows the soonest event's type icon; a count badge (bottom-right) appears only
// when several events share the venue. Wrapper is translated so its bottom tip
// lands at (x, y).
export function EventPin({ group, x, y, selected, locale, onSelect }: EventPinProps) {
  const lead = group.events[0];
  const soc = societyById(lead.societyId);
  const count = group.events.length;
  const Icon = CATEGORY_ICON[lead.category];
  const dateLabel = parseEventDate(lead.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <button
      className="group pointer-events-auto absolute flex flex-col items-center"
      style={{ left: x, top: y, transform: 'translate(-50%, -100%)' }}
      title={lead.title}
      onClick={() => onSelect(lead.id)}
    >
      {/* Head: society colour + logo, with badges. */}
      <span
        className="relative flex items-center justify-center rounded-full text-white shadow-md ring-2 ring-white transition-transform group-hover:scale-110"
        style={{
          width: 38, height: 38, backgroundColor: soc.color,
          boxShadow: selected ? `0 0 0 4px ${soc.color}55, 0 2px 8px rgba(0,0,0,.4)` : undefined,
        }}
      >
        {lead.imageUrl || soc.logo
          ? <img src={lead.imageUrl ?? soc.logo} alt="" className="h-full w-full rounded-full object-cover" />
          : <span className="text-xs font-extrabold leading-none">{soc.glyph}</span>}

        {/* Type badge (top-right). */}
        <span
          className="absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-white ring-1 ring-base-300"
          style={{ width: 18, height: 18 }}
        >
          <Icon size={11} color={soc.color} strokeWidth={2.5} />
        </span>

        {/* Count badge (bottom-right) — only when co-located. */}
        {count > 1 && (
          <span
            className="absolute -bottom-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-base-content ring-1 ring-base-300"
          >
            {count}
          </span>
        )}

        {/* Sneak-peek bubble on hover (above the head). */}
        <span
          className="pointer-events-none absolute bottom-[46px] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-base-100 px-2 py-1 text-left text-base-content shadow-popover-heavy group-hover:block"
        >
          <span className="block text-[11px] font-bold leading-tight">{lead.title}</span>
          <span className="block text-[10px] font-semibold leading-tight" style={{ color: soc.color }}>
            {dateLabel}{lead.time ? ` · ${lead.time}` : ''}{count > 1 ? ` · +${count - 1}` : ''}
          </span>
        </span>
      </span>

      {/* Pointer: solid society-colour triangle; its bottom point is the tip. */}
      <span
        style={{
          width: 0, height: 0, marginTop: -1,
          borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
          borderTop: `8px solid ${soc.color}`,
        }}
      />
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/CampusMap/__tests__/EventPin.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CampusMap/EventPin.tsx src/components/CampusMap/__tests__/EventPin.test.tsx
git commit -m "feat(map): teardrop event pin with type + count badges (drop the rope)"
```

---

### Task 4: Fix pins drifting during a map drag

**Files:**
- Modify: `src/components/CampusMap/EventLayer.tsx:55-56`
- Test: `src/components/CampusMap/__tests__/EventLayer.test.tsx`

**Interfaces:**
- Consumes: `setMapInstance` (`../mapInstance`), `MOCK_MAP_EVENTS` (`../../../api/mapEvents`).
- Produces: `EventLayer` binds the continuous `move` and `zoom` Leaflet events (in addition to `moveend`/`zoomend`).

- [ ] **Step 1: Write the failing test**

Create `src/components/CampusMap/__tests__/EventLayer.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../hooks/useEventsFacultySettings', () => ({
  useEventsFacultySettings: () => ({ subscribedFaculties: ['mendelu', 'pef'], isLoading: false }),
}));
import { render } from '@testing-library/react';
import { EventLayer } from '../EventLayer';
import { setMapInstance } from '../mapInstance';
import { useAppStore } from '../../../store/useAppStore';
import { MOCK_MAP_EVENTS } from '../../../api/mapEvents';

const fakeMap = {
  on: vi.fn(),
  off: vi.fn(),
  latLngToContainerPoint: () => ({ x: 10, y: 20 }),
};

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({
    mapEvents: MOCK_MAP_EVENTS, eventFilter: 'all',
    activeBuildingId: null, mapSelection: null, language: 'en',
  });
  setMapInstance(fakeMap as never);
});

afterEach(() => { setMapInstance(null); });

describe('EventLayer pan binding', () => {
  it('binds the continuous move and zoom events (not only moveend/zoomend)', () => {
    render(<EventLayer />);
    const eventArg = fakeMap.on.mock.calls[0][0] as string;
    const tokens = eventArg.split(' ');
    expect(tokens).toContain('move');
    expect(tokens).toContain('zoom');
    expect(tokens).toContain('moveend');
    expect(tokens).toContain('zoomend');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/EventLayer.test.tsx`
Expected: FAIL — bound string is `'moveend zoomend'`; `tokens` does not contain `'move'` or `'zoom'`.

- [ ] **Step 3: Bind the continuous events**

In `src/components/CampusMap/EventLayer.tsx`, change the two binding lines (currently lines 55–56). Note we now route every event through the rAF-throttled `schedule` (instead of calling `recompute` directly) so continuous events don't thrash layout:

Replace:

```ts
    const bind = (m: L.Map) => { m.on('moveend zoomend', recompute); schedule(); };
    const unbind = (m: L.Map) => { m.off('moveend zoomend', recompute); };
```

with:

```ts
    const bind = (m: L.Map) => { m.on('move zoom moveend zoomend', schedule); schedule(); };
    const unbind = (m: L.Map) => { m.off('move zoom moveend zoomend', schedule); };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/CampusMap/__tests__/EventLayer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CampusMap/EventLayer.tsx src/components/CampusMap/__tests__/EventLayer.test.tsx
git commit -m "fix(map): keep event pins glued to their spot while panning/zooming"
```

---

### Task 5: Type icon on the list rows and detail card

**Files:**
- Modify: `src/components/CampusMap/EventsList.tsx:1`, `:12`, `:20`
- Modify: `src/components/CampusMap/EventDetailCard.tsx`
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`
- Test: `src/components/CampusMap/__tests__/EventsList.test.tsx` (extend existing)

**Interfaces:**
- Consumes: `CATEGORY_ICON` (Task 1), `MapEvent.category` (Task 1), translation keys `map.category.*`.
- Produces: list rows and the detail card render the event-type icon — the legend is consistent across pin, list, and detail.

- [ ] **Step 1: Add a failing assertion to the EventsList test**

In `src/components/CampusMap/__tests__/EventsList.test.tsx`, add this test inside the `describe('EventsList', ...)` block:

```tsx
  it('renders a category icon on rows', () => {
    const { container } = render(<EventsList />);
    // Deskovky (SU PEF) is visible under the default 'all' filter → boardgames icon.
    expect(container.querySelector('.lucide-dices')).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/EventsList.test.tsx`
Expected: FAIL — no `.lucide-dices` yet (rows show a plain colour dot).

- [ ] **Step 3: Swap the row dot for a category icon in `EventsList.tsx`**

Change the import on line 1 from:

```tsx
import { CalendarOff } from 'lucide-react';
```

to:

```tsx
import { CalendarOff } from 'lucide-react';
import { CATEGORY_ICON } from '../../data/eventCategories';
```

Inside `EventRow`, after `const soc = societyById(event.societyId);` add:

```tsx
  const Icon = CATEGORY_ICON[event.category];
```

Replace the colour-dot span (currently line 20):

```tsx
      <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: soc.color }} />
```

with the category icon in the society colour:

```tsx
      <Icon size={15} color={soc.color} strokeWidth={2.25} className="mt-0.5 flex-shrink-0" />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/CampusMap/__tests__/EventsList.test.tsx`
Expected: PASS (all existing tests + the new icon test).

- [ ] **Step 5: Add category labels to both locale files**

In `src/i18n/locales/en.json`, inside the `"map": { ... }` object (next to `"moreInfo"`), add:

```json
    "category": {
      "party": "Party",
      "boardgames": "Board games",
      "trip": "Trip",
      "quiz": "Quiz",
      "sports": "Sports",
      "film": "Film",
      "karaoke": "Karaoke",
      "culture": "Culture",
      "social": "Social",
      "other": "Event"
    },
```

In `src/i18n/locales/cs.json`, inside the matching `"map": { ... }` object, add:

```json
    "category": {
      "party": "Párty",
      "boardgames": "Deskovky",
      "trip": "Výlet",
      "quiz": "Kvíz",
      "sports": "Sport",
      "film": "Film",
      "karaoke": "Karaoke",
      "culture": "Kultura",
      "social": "Společenská akce",
      "other": "Akce"
    },
```

> Make sure the preceding key inside `map` keeps its trailing comma so the JSON stays valid.

- [ ] **Step 6: Add a category row to `EventDetailCard.tsx`**

Change the import on line 1 from:

```tsx
import { MapPin, ExternalLink, Clock } from 'lucide-react';
```

to:

```tsx
import { MapPin, ExternalLink, Clock } from 'lucide-react';
import { CATEGORY_ICON } from '../../data/eventCategories';
```

After `const soc = societyById(event.societyId);` add:

```tsx
  const CategoryIcon = CATEGORY_ICON[event.category];
```

Add a category row directly after the date/time block (after the `<div className="flex items-center gap-1.5 text-sm text-base-content/70"> ... Clock ... </div>` closing tag, before the `event.roomCode` block):

```tsx
        <div className="flex items-center gap-1.5 text-sm text-base-content/70">
          <CategoryIcon size={13} style={{ color: soc.color }} />
          <span>{t(`map.category.${event.category}`)}</span>
        </div>
```

- [ ] **Step 7: Verify the build and full suite**

Run: `npm run typecheck && npx vitest run src/components/CampusMap src/data src/api/__tests__/mapEvents.test.ts`
Expected: typecheck exit 0; all CampusMap / category / mapEvents tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/CampusMap/EventsList.tsx src/components/CampusMap/EventDetailCard.tsx src/components/CampusMap/__tests__/EventsList.test.tsx src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(map): show event-type icon on list rows and detail card"
```

---

### Task 6: Build + verification gate

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck + lint + test run**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: all exit 0.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: exit 0. (Per project convention, the build must pass before browser re-test.)

- [ ] **Step 3: Manual smoke (browser)**

Load the extension on `is.mendelu.cz`, open the campus map:
- Event pins render as teardrops sitting on their buildings, no rope, society logo in the head, a type icon badge top-right, a count badge where events share a venue.
- **Drag the map** — pins stay locked to their buildings (the bug is gone), not drifting with the viewport.
- Hover a pin → sneak-peek bubble; click → flies + opens the detail card showing the category row.
- The Events list rows show the category icon in the society colour.

---

## Self-Review

**Spec coverage:**
- Pin redesign (teardrop, society logo head, type badge, count badge, tip anchor, hover, selected halo) → Task 3. ✓
- Event-type taxonomy + `EventCategory` + `inferCategory` + lucide mapping → Task 1; populated in mock → Task 2. ✓
- Pan bug root cause + continuous `move`/`zoom` fix, `EventLayer` only → Task 4. ✓
- Consistent type icon across pin / list / detail → Tasks 3 + 5. ✓
- i18n labels → Task 5. ✓
- Tests (inferCategory, mock category, EventPin icon/count, EventLayer reprojection) → Tasks 1–5. ✓
- Out-of-scope items (backend picker, clustering threshold, RSVP, bell feed) → untouched. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; every command has expected output. ✓

**Type consistency:** `EventCategory` union, `MapEvent.category`, `CATEGORY_ICON`, `inferCategory(title)` names match across Tasks 1→5. `EventPin` props unchanged. `setMapInstance`/`subscribeMapInstance` names match `mapInstance.ts`. Lucide class names (`lucide-dices`) used consistently in tests. ✓
